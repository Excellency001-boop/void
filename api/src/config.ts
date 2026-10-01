import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");
const LOCAL_DEPLOYMENTS_DIR = path.resolve(__dirname, "../deployments");

// Anvil's well-known default account #0 — deterministic from the standard "test test test ...
// junk" mnemonic every `anvil` instance boots with. Safe to hardcode because it is, by
// construction, never used for anything but local development chains with no real value on them.
const ANVIL_DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  RPC_URL: z.string().default("http://127.0.0.1:8545"),
  CHAIN_ID: z.coerce.number().default(31337),
  RELAYER_PRIVATE_KEY: z.string().default(ANVIL_DEFAULT_KEY),
});

const env = envSchema.parse(process.env);

if (env.CHAIN_ID !== 31337 && env.RELAYER_PRIVATE_KEY === ANVIL_DEFAULT_KEY) {
  throw new Error(
    `Refusing to start against chain ${env.CHAIN_ID} using the public Anvil dev key. ` +
      "Set RELAYER_PRIVATE_KEY to a real, funded key for anything other than local chain 31337."
  );
}

const deploymentSchema = z.object({
  chainId: z.number(),
  entryPoint: z.string(),
  kernelImpl: z.string(),
  kernelFactory: z.string(),
  ecdsaValidator: z.string(),
  policyValidator: z.string(),
  // Optional: deployment files written before ExpirySweepExecutor existed won't have this field
  // yet. Vault creation checks for its presence before trying to install the module — see
  // vaults.ts — rather than failing config load entirely for an otherwise-valid older file.
  expirySweepExecutor: z.string().optional(),
});

function loadDeployment() {
  // Prefer the copy vendored inside api/ — this is what makes the API deployable on its own
  // (Railway, etc.) without the rest of the monorepo checked out. Fall back to the shared
  // contracts/deployments/ file for local dev, so a fresh `npm run deploy:local` there is picked
  // up without needing to remember to copy it over every time.
  const candidates = [
    path.join(LOCAL_DEPLOYMENTS_DIR, `${env.CHAIN_ID}.json`),
    path.join(CONTRACTS_DIR, "deployments", `${env.CHAIN_ID}.json`),
  ];
  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      return deploymentSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") continue;
      throw err;
    }
  }
  throw new Error(
    `No deployment file for chain ${env.CHAIN_ID} in ${LOCAL_DEPLOYMENTS_DIR} or ` +
      `${CONTRACTS_DIR}/deployments. Run \`npm run deploy:local\` (or the equivalent for your ` +
      `target chain) first, or copy an existing deployments/<chainId>.json into api/deployments/.`
  );
}

export const config = {
  ...env,
  contractsDir: CONTRACTS_DIR,
  deployment: loadDeployment(),
};

export type Config = typeof config;
