import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");

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
});

function loadDeployment() {
  const filePath = path.join(CONTRACTS_DIR, "deployments", `${env.CHAIN_ID}.json`);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(
      `No deployment file at ${filePath}. Run \`npm run deploy:local\` (or the equivalent for ` +
        `your target chain) before starting the API.`
    );
  }
  return deploymentSchema.parse(JSON.parse(raw));
}

export const config = {
  ...env,
  contractsDir: CONTRACTS_DIR,
  deployment: loadDeployment(),
};

export type Config = typeof config;
