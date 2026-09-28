import { type Address, type Hex, concatHex, pad, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "./chain.js";
import { config } from "./config.js";
import { entryPointAbi } from "./abi/load.js";
import { encodeExecuteSingle, policyValidatorNonceKey } from "./kernel.js";

export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

const DEFAULT_VERIFICATION_GAS_LIMIT = 2_000_000n;
const DEFAULT_CALL_GAS_LIMIT = 2_000_000n;
const DEFAULT_PRE_VERIFICATION_GAS = 200_000n;
const DEFAULT_PRIORITY_FEE = 1_000_000_000n; // 1 gwei
const DEFAULT_MAX_FEE = 1_000_000_000n;

function packTwo128(a: bigint, b: bigint): Hex {
  return concatHex([pad(toHex(a), { size: 16 }), pad(toHex(b), { size: 16 })]) as Hex;
}

/// Builds an unsigned UserOp for a single agent action. The vault's actual on-chain nonce is
/// fetched live — this is the one field that MUST be fresh per submission, since ERC-4337 nonces
/// are per-(sender, key) and each successful action advances it.
export async function buildUnsignedUserOp(params: {
  vaultAddress: Address;
  policyValidator: Address;
  target: Address;
  value: bigint;
  innerCalldata: Hex;
}): Promise<PackedUserOperation> {
  const key = policyValidatorNonceKey(params.policyValidator);
  const nonce = await publicClient.readContract({
    address: config.deployment.entryPoint as Address,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [params.vaultAddress, key],
  });

  return {
    sender: params.vaultAddress,
    nonce: nonce as bigint,
    initCode: "0x",
    callData: encodeExecuteSingle(params.target, params.value, params.innerCalldata),
    accountGasLimits: packTwo128(DEFAULT_VERIFICATION_GAS_LIMIT, DEFAULT_CALL_GAS_LIMIT),
    preVerificationGas: DEFAULT_PRE_VERIFICATION_GAS,
    gasFees: packTwo128(DEFAULT_PRIORITY_FEE, DEFAULT_MAX_FEE),
    paymasterAndData: "0x",
    signature: "0x",
  };
}

export async function getUserOpHash(op: PackedUserOperation): Promise<Hex> {
  return publicClient.readContract({
    address: config.deployment.entryPoint as Address,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [op],
  }) as Promise<Hex>;
}

/// Signs a userOpHash the same way PolicyValidator.validateUserOp expects: EIP-191
/// personal-sign-style prefixing (MessageHashUtils.toEthSignedMessageHash on the contract side),
/// not a raw ECDSA signature over the bare hash.
export async function signUserOpHash(hash: Hex, sessionPrivateKey: Hex): Promise<Hex> {
  const account = privateKeyToAccount(sessionPrivateKey);
  return account.signMessage({ message: { raw: hash } });
}
