import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  pad,
  toFunctionSelector,
  toHex,
} from "viem";
import { kernelAbi, entryPointAbi } from "./abi/load.js";

/// Everything in this file mirrors, byte for byte, the encoding Kernel v3.3 / ERC-4337 v0.7
/// expect. It exists to keep that knowledge in ONE place — the Foundry integration test
/// (contracts/test/integration/PolicyValidatorKernelIntegration.t.sol) proves the exact same
/// shapes against the real contracts; this is the TypeScript side of that same contract.

export const MODULE_TYPE_VALIDATOR = 1n;

const EXECUTE_SELECTOR = toFunctionSelector("execute(bytes32,bytes)");
const SINGLE_CALL_MODE: Hex = pad("0x00", { size: 32 }); // CALLTYPE_SINGLE(0x00) + EXECTYPE_DEFAULT(0x00) + zero rest

/// ValidationId is Kernel's bytes21 tag: 0x01 (VALIDATION_TYPE_VALIDATOR) ++ the validator's
/// 20-byte address. See ValidatorLib.validatorToIdentifier in kernel/utils/ValidationTypeLib.sol.
export function validatorToIdentifier(validator: Address): Hex {
  return concatHex(["0x01", validator]) as Hex;
}

/// Packs Kernel's 192-bit UserOp nonce "key": mode(1B) ++ vType(1B) ++ validator address(20B) ++
/// parallel nonceKey(2B). See ValidatorLib.encodeAsNonceKey — this is the exact bit layout,
/// cross-checked against a real EntryPoint.getNonce() call in the Foundry integration test.
export function encodeNonceKey(mode: number, vType: number, validator: Address, parallelKey = 0): bigint {
  const addressUint = BigInt(validator);
  return (
    (BigInt(mode) << 184n) | (BigInt(vType) << 176n) | (addressUint << 16n) | BigInt(parallelKey)
  );
}

/// The nonce "key" for PolicyValidator acting on a given Session Vault, in default (non-enable)
/// mode — used for every ordinary agent action once the vault has been created.
export function policyValidatorNonceKey(policyValidator: Address): bigint {
  return encodeNonceKey(0x00, 0x01, policyValidator);
}

/// abi.encode(owner, sessionKey, validAfter, validUntil, nativeSpendCap, maxTxCount,
/// initialTarget, initialSelector) — must match PolicyValidator.onInstall exactly (256 bytes).
export function encodePolicyInitData(params: {
  owner: Address;
  sessionKey: Address;
  validAfter: number;
  validUntil: number;
  nativeSpendCap: bigint;
  maxTxCount: bigint;
  initialTarget?: Address;
  initialSelector?: Hex;
}): Hex {
  return encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint48" },
      { type: "uint48" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address" },
      { type: "bytes4" },
    ],
    [
      params.owner,
      params.sessionKey,
      params.validAfter,
      params.validUntil,
      params.nativeSpendCap,
      params.maxTxCount,
      params.initialTarget ?? ("0x0000000000000000000000000000000000000000" as Address),
      params.initialSelector ?? ("0x00000000" as Hex),
    ]
  );
}

/// Kernel.installModule(MODULE_TYPE_VALIDATOR, module, hookAddr(20B) ++ abi.encode(validatorData,
/// hookData, selectorData)) — a 4-byte selectorData grants Kernel's own top-level-selector gate in
/// the same call (see Kernel.installModule's MODULE_TYPE_VALIDATOR branch). We always grant
/// `execute` since that's the only selector VOID's agent flow ever uses.
export function encodeInstallPolicyValidatorCall(policyValidator: Address, policyInitData: Hex): Hex {
  const initData = concatHex([
    pad("0x01", { size: 20 }), // hook sentinel: address(1), "no hook required"
    encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
      [policyInitData, "0x", EXECUTE_SELECTOR]
    ),
  ]);

  return encodeFunctionData({
    abi: kernelAbi,
    functionName: "installModule",
    args: [MODULE_TYPE_VALIDATOR, policyValidator, initData],
  });
}

/// Kernel.initialize(rootValidatorId, rootHook, rootValidatorData, rootHookData, initConfig) — the
/// single transaction that deploys AND fully configures a Session Vault: root key installed,
/// PolicyValidator installed with its policy, one initial permission seeded, execute() granted.
export function encodeAccountInitData(params: {
  rootValidatorId: Hex;
  ownerAddress: Address;
  initConfig: Hex[];
}): Hex {
  return encodeFunctionData({
    abi: kernelAbi,
    functionName: "initialize",
    args: [
      params.rootValidatorId,
      pad("0x01", { size: 20 }), // no hook on the root validator either
      concatHex([params.ownerAddress]), // ECDSAValidator.onInstall data: just the owner address
      "0x",
      params.initConfig,
    ],
  });
}

/// Kernel.execute(single-call mode, target ++ value ++ innerCalldata) — the calldata an agent's
/// UserOp carries for every action. ERC-7579 single-call execution is packed (encodePacked), not
/// ABI-encoded — see ExecutionLib.sol on the contracts side for the matching decoder.
export function encodeExecuteSingle(target: Address, value: bigint, innerCalldata: Hex): Hex {
  const executionCalldata = concatHex([target, pad(toHex(value), { size: 32 }), innerCalldata]);
  return encodeFunctionData({
    abi: kernelAbi,
    functionName: "execute",
    args: [SINGLE_CALL_MODE, executionCalldata],
  });
}

export { entryPointAbi };
