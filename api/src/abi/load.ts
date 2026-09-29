import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Abi } from "viem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/// ABIs are vendored here as plain JSON (see contracts/README.md for the extraction command) —
/// not read live from Foundry's build output. The API is meant to be deployable on its own,
/// without a Foundry toolchain or the rest of the monorepo present at runtime; committing the ABI
/// arrays directly (regenerated whenever the contracts actually change, not on every deploy) keeps
/// that true. They're the same ABI Foundry produced — see git blame for when each was last synced.
function loadAbi(fileName: string): Abi {
  const raw = readFileSync(path.join(__dirname, "generated", fileName), "utf-8");
  return JSON.parse(raw) as Abi;
}

export const policyValidatorAbi = loadAbi("policyValidator.json");
export const kernelAbi = loadAbi("kernel.json");
export const kernelFactoryAbi = loadAbi("kernelFactory.json");
export const ecdsaValidatorAbi = loadAbi("ecdsaValidator.json");
export const entryPointAbi = loadAbi("entryPoint.json");
