import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { Abi } from "viem";

/// Loads ABIs straight from Foundry's build artifacts rather than hand-copying them — the
/// contracts/ repo is the single source of truth, and a stale hand-copied ABI is exactly the
/// class of bug that's invisible until a specific function call breaks in production.
function loadAbi(sourceFile: string, contractName: string): Abi {
  const artifactPath = path.join(config.contractsDir, "out", sourceFile, `${contractName}.json`);
  const raw = readFileSync(artifactPath, "utf-8");
  return JSON.parse(raw).abi as Abi;
}

export const policyValidatorAbi = loadAbi("PolicyValidator.sol", "PolicyValidator");
export const kernelAbi = loadAbi("Kernel.sol", "Kernel");
export const kernelFactoryAbi = loadAbi("KernelFactory.sol", "KernelFactory");
export const ecdsaValidatorAbi = loadAbi("ECDSAValidator.sol", "ECDSAValidator");
export const entryPointAbi = loadAbi("EntryPoint.sol", "EntryPoint");
