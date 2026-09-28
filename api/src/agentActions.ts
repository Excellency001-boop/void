import {
  type Address,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  encodeFunctionData,
  keccak256,
} from "viem";
import { publicClient, relayerClient } from "./chain.js";
import { config } from "./config.js";
import { policyValidatorAbi, entryPointAbi } from "./abi/load.js";
import { buildUnsignedUserOp, getUserOpHash, signUserOpHash } from "./userop.js";
import { scoreAction } from "./risk.js";

export interface RevertInfo {
  errorName: string;
  args: unknown[];
  /// Set when the real revert reason came from PolicyValidator but surfaced wrapped inside
  /// EntryPoint's own FailedOpWithRevert — i.e. exactly what happens on the real /agent/execute
  /// path, since EntryPoint is the direct callee there, not PolicyValidator.
  viaEntryPoint?: boolean;
}

/// Unwraps EntryPoint's FailedOpWithRevert(opIndex, reason, inner) to decode the INNER revert —
/// the actual PolicyValidator custom error — rather than surfacing the opaque "AA23 reverted"
/// wrapper to the caller.
function tryUnwrapEntryPointRevert(errorName: string, args: readonly unknown[]): RevertInfo | undefined {
  if (errorName !== "FailedOpWithRevert") return undefined;
  const inner = args[2] as Hex | undefined;
  if (!inner || inner === "0x") return undefined;
  try {
    const decoded = decodeErrorResult({ abi: policyValidatorAbi, data: inner });
    return { errorName: decoded.errorName, args: (decoded.args as unknown[]) ?? [], viaEntryPoint: true };
  } catch {
    return undefined;
  }
}

function decodeRevert(err: unknown): RevertInfo {
  if (err instanceof BaseError) {
    const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName ?? "UnknownRevert";
      const args = (revertError.data?.args as unknown[]) ?? [];
      return tryUnwrapEntryPointRevert(errorName, args) ?? { errorName, args };
    }
  }
  return { errorName: "UnknownRevert", args: [String(err)] };
}

async function readPolicySnapshot(vaultAddress: Address) {
  const [owner, sessionKey, validAfter, validUntil, nativeSpendCap, nativeSpent, maxTxCount, txCount, revoked] =
    (await publicClient.readContract({
      address: config.deployment.policyValidator as Address,
      abi: policyValidatorAbi,
      functionName: "sessionPolicies",
      args: [vaultAddress],
    })) as [Address, Address, number, number, bigint, bigint, bigint, bigint, boolean];

  return { owner, sessionKey, validAfter, validUntil, nativeSpendCap, nativeSpent, maxTxCount, txCount, revoked };
}

export interface ActionInput {
  vaultAddress: Address;
  sessionPrivateKey: Hex;
  target: Address;
  value: bigint;
  calldata: Hex;
}

export interface SimulateResult {
  allowed: boolean;
  revert?: RevertInfo;
  riskScore: number;
  riskFactors: ReturnType<typeof scoreAction>["factors"];
  userOpHash: Hex;
}

/// A true dry run: builds the exact UserOp an /agent/execute call would submit, signs it with the
/// real session key, then replays PolicyValidator.validateUserOp via eth_call with `account`
/// spoofed to the vault address — the same authorization check the real on-chain path enforces.
/// This is not a reimplementation of the policy logic in TypeScript (which could drift from the
/// contract); it's the contract's own logic, called read-only.
export async function simulateAction(input: ActionInput): Promise<SimulateResult> {
  const policyValidator = config.deployment.policyValidator as Address;
  const op = await buildUnsignedUserOp({
    vaultAddress: input.vaultAddress,
    policyValidator,
    target: input.target,
    value: input.value,
    innerCalldata: input.calldata,
  });
  const userOpHash = await getUserOpHash(op);
  const signature = await signUserOpHash(userOpHash, input.sessionPrivateKey);
  const signedOp = { ...op, signature };

  let allowed = true;
  let revert: RevertInfo | undefined;
  try {
    await publicClient.simulateContract({
      address: policyValidator,
      abi: policyValidatorAbi,
      functionName: "validateUserOp",
      args: [signedOp, userOpHash],
      account: input.vaultAddress,
    });
  } catch (err) {
    allowed = false;
    revert = decodeRevert(err);
  }

  const policy = await readPolicySnapshot(input.vaultAddress);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const remainingNativeBudget = policy.nativeSpendCap > policy.nativeSpent ? policy.nativeSpendCap - policy.nativeSpent : 0n;
  const { score, factors } = scoreAction({
    value: input.value,
    remainingNativeBudget,
    txCount: policy.txCount,
    maxTxCount: policy.maxTxCount,
    validUntil: policy.validUntil,
    validAfter: policy.validAfter,
    nowSeconds,
  });

  return { allowed, revert, riskScore: score, riskFactors: factors, userOpHash };
}

export interface ExecuteResult {
  success: boolean;
  txHash?: Hex;
  userOpHash: Hex;
  revert?: RevertInfo;
}

/// Submits the UserOp for real, via our own relayer calling EntryPoint.handleOps directly — VOID
/// self-relays rather than depending on a third-party bundler for the hackathon build (see
/// contracts/README.md). This matters for the demo specifically: a real bundler estimates gas
/// before including anything, which means a would-revert op is silently dropped and never
/// produces an on-chain transaction to point at.
///
/// We sign the transaction ourselves (rather than calling `writeContract`, which estimates gas
/// and would refuse to send something that reverts) so we know its hash BEFORE broadcasting —
/// some nodes (this project's local Anvil included) surface an RPC-level error for a transaction
/// that reverts even though they still mine it, which would otherwise look identical to "never
/// broadcast." Knowing the hash up front means we always check the real receipt regardless of
/// whether the send call itself complained.
export async function executeAction(input: ActionInput): Promise<ExecuteResult> {
  const policyValidator = config.deployment.policyValidator as Address;
  const op = await buildUnsignedUserOp({
    vaultAddress: input.vaultAddress,
    policyValidator,
    target: input.target,
    value: input.value,
    innerCalldata: input.calldata,
  });
  const userOpHash = await getUserOpHash(op);
  const signature = await signUserOpHash(userOpHash, input.sessionPrivateKey);
  const signedOp = { ...op, signature };

  const entryPoint = config.deployment.entryPoint as Address;
  const data = encodeFunctionData({
    abi: entryPointAbi,
    functionName: "handleOps",
    args: [[signedOp], relayerClient.account.address],
  });

  const request = await relayerClient.prepareTransactionRequest({
    to: entryPoint,
    data,
    gas: 3_000_000n,
  });
  const serializedTransaction = await relayerClient.signTransaction(request);
  const txHash = keccak256(serializedTransaction);

  try {
    await publicClient.sendRawTransaction({ serializedTransaction });
  } catch {
    // Some nodes (this project's local Anvil, notably) report an RPC-level error for any
    // transaction that reverts, in addition to still mining it — so a thrown error here is not
    // proof the transaction was never broadcast. The receipt check below is authoritative.
  }

  const receipt = await publicClient
    .waitForTransactionReceipt({ hash: txHash, timeout: 15_000 })
    .catch(() => undefined);

  if (!receipt) {
    // Genuinely never made it into a block (e.g. the node rejected it before assigning a nonce).
    return { success: false, userOpHash, revert: { errorName: "NotBroadcast", args: [] } };
  }
  if (receipt.status === "success") {
    return { success: true, txHash, userOpHash };
  }

  // Mined but reverted. Re-run the identical call read-only at that block to recover a decoded
  // reason for the response, while still reporting the real (failed) txHash as proof it landed.
  let revert: RevertInfo | undefined;
  try {
    await publicClient.simulateContract({
      address: entryPoint,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[signedOp], relayerClient.account.address],
      blockNumber: receipt.blockNumber,
    });
  } catch (err) {
    revert = decodeRevert(err);
  }
  return { success: false, txHash, userOpHash, revert };
}
