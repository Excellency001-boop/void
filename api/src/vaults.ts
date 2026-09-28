import { type Address, type Hex, keccak256, encodePacked } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { publicClient, relayerClient } from "./chain.js";
import { config } from "./config.js";
import { kernelFactoryAbi, policyValidatorAbi } from "./abi/load.js";
import {
  encodeAccountInitData,
  encodeInstallPolicyValidatorCall,
  encodePolicyInitData,
  validatorToIdentifier,
} from "./kernel.js";
import { saveVault, getVault, listVaults, type VaultRecord } from "./store.js";

export interface CreateVaultParams {
  ownerAddress: Address;
  sessionDurationSeconds: number;
  nativeSpendCapWei: bigint;
  maxTxCount: bigint;
  initialTarget?: Address;
  initialSelector?: Hex;
}

export interface CreateVaultResult {
  vaultAddress: Address;
  sessionKeyAddress: Address;
  /// Returned exactly once. The API does not persist this anywhere — the caller (the owner's
  /// dashboard / setup flow) is responsible for handing it to the agent. Losing it means the
  /// session can no longer act; the owner can still force-revoke and the funds are theirs either
  /// way, since PolicyValidator never gives the session key any authority the root key lacks.
  sessionPrivateKey: Hex;
  deployTxHash: Hex;
}

export async function createVault(params: CreateVaultParams): Promise<CreateVaultResult> {
  const sessionPrivateKey = generatePrivateKey();
  const sessionKeyAddress = privateKeyToAccount(sessionPrivateKey).address;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const validAfter = nowSeconds;
  const validUntil = nowSeconds + params.sessionDurationSeconds;

  const policyInitData = encodePolicyInitData({
    owner: params.ownerAddress,
    sessionKey: sessionKeyAddress,
    validAfter,
    validUntil,
    nativeSpendCap: params.nativeSpendCapWei,
    maxTxCount: params.maxTxCount,
    initialTarget: params.initialTarget,
    initialSelector: params.initialSelector,
  });

  const installCall = encodeInstallPolicyValidatorCall(config.deployment.policyValidator as Address, policyInitData);
  const rootValidatorId = validatorToIdentifier(config.deployment.ecdsaValidator as Address);
  const initData = encodeAccountInitData({
    rootValidatorId,
    ownerAddress: params.ownerAddress,
    initConfig: [installCall],
  });

  // Deterministic (CREATE2-derived) salt so re-deriving the same owner+policy twice is at least
  // predictable, even though we don't currently dedupe on it — each call makes a fresh vault.
  const salt = keccak256(encodePacked(["address", "uint256"], [params.ownerAddress, BigInt(Date.now())]));

  const kernelFactory = config.deployment.kernelFactory as Address;
  const vaultAddress = (await publicClient.readContract({
    address: kernelFactory,
    abi: kernelFactoryAbi,
    functionName: "getAddress",
    args: [initData, salt],
  })) as Address;

  const deployTxHash = await relayerClient.writeContract({
    address: kernelFactory,
    abi: kernelFactoryAbi,
    functionName: "createAccount",
    args: [initData, salt],
  });
  await publicClient.waitForTransactionReceipt({ hash: deployTxHash });

  const record: VaultRecord = {
    vaultAddress,
    ownerAddress: params.ownerAddress,
    sessionKeyAddress,
    createdAt: new Date().toISOString(),
    deployTxHash,
    policy: {
      validAfter,
      validUntil,
      nativeSpendCap: params.nativeSpendCapWei.toString(),
      maxTxCount: params.maxTxCount.toString(),
      initialTarget: params.initialTarget,
      initialSelector: params.initialSelector,
    },
  };
  saveVault(record);

  return { vaultAddress, sessionKeyAddress, sessionPrivateKey, deployTxHash };
}

export interface VaultStatus {
  vaultAddress: Address;
  owner: Address;
  sessionKeyAddress: Address;
  validAfter: number;
  validUntil: number;
  nativeSpendCap: string;
  nativeSpent: string;
  remainingNativeBudget: string;
  maxTxCount: string;
  txCount: string;
  revoked: boolean;
  expired: boolean;
}

export async function getVaultStatus(vaultAddress: Address): Promise<VaultStatus> {
  const policyValidator = config.deployment.policyValidator as Address;
  const [owner, sessionKey, validAfter, validUntil, nativeSpendCap, nativeSpent, maxTxCount, txCount, revoked] =
    (await publicClient.readContract({
      address: policyValidator,
      abi: policyValidatorAbi,
      functionName: "sessionPolicies",
      args: [vaultAddress],
    })) as [Address, Address, number, number, bigint, bigint, bigint, bigint, boolean];

  const expired = Math.floor(Date.now() / 1000) > validUntil;
  const remainingNativeBudget = nativeSpendCap > nativeSpent ? nativeSpendCap - nativeSpent : 0n;

  return {
    vaultAddress,
    owner,
    sessionKeyAddress: sessionKey,
    validAfter,
    validUntil,
    nativeSpendCap: nativeSpendCap.toString(),
    nativeSpent: nativeSpent.toString(),
    remainingNativeBudget: remainingNativeBudget.toString(),
    maxTxCount: maxTxCount.toString(),
    txCount: txCount.toString(),
    revoked,
    expired,
  };
}

export interface HistoryEntry {
  target: Address;
  selector: Hex;
  value: string;
  token: Address;
  tokenAmount: string;
  blockNumber: string;
  transactionHash: Hex;
}

export async function getVaultHistory(vaultAddress: Address): Promise<HistoryEntry[]> {
  const logs = await publicClient.getContractEvents({
    address: config.deployment.policyValidator as Address,
    abi: policyValidatorAbi,
    eventName: "ActionValidated",
    args: { account: vaultAddress },
    fromBlock: 0n,
    toBlock: "latest",
  });

  return logs.map((log) => {
    const args = log.args as {
      target: Address;
      selector: Hex;
      value: bigint;
      token: Address;
      tokenAmount: bigint;
    };
    return {
      target: args.target,
      selector: args.selector,
      value: args.value.toString(),
      token: args.token,
      tokenAmount: args.tokenAmount.toString(),
      blockNumber: log.blockNumber.toString(),
      transactionHash: log.transactionHash,
    };
  });
}

/// The exact pre-image PolicyValidator.forceRevokeWithSig expects, BEFORE the EIP-191 prefix. A
/// wallet's `personal_sign` (or viem's `account.signMessage({ raw: message })`) applies that
/// prefix itself — signing this value directly with raw ECDSA would NOT match what the contract
/// recovers against.
export function computeRevokeMessage(vaultAddress: Address): Hex {
  return keccak256(encodePacked(["string", "uint256", "address"], ["VOID_REVOKE", BigInt(config.CHAIN_ID), vaultAddress]));
}

/// Demo/dev convenience only: sends the relayer's own ETH to the vault so it has something to
/// spend. In a real deployment the OWNER funds their own vault directly — it's a plain address
/// that accepts ETH transfers (Kernel's `receive()`), so no API involvement is needed at all;
/// this endpoint exists purely so a local demo doesn't require a second funded wallet.
export async function depositToVault(vaultAddress: Address, amountWei: bigint): Promise<Hex> {
  const txHash = await relayerClient.sendTransaction({ to: vaultAddress, value: amountWei });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function revokeVaultWithSignature(vaultAddress: Address, ownerSignature: Hex): Promise<Hex> {
  const txHash = await relayerClient.writeContract({
    address: config.deployment.policyValidator as Address,
    abi: policyValidatorAbi,
    functionName: "forceRevokeWithSig",
    args: [vaultAddress, ownerSignature],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export { getVault, listVaults };
