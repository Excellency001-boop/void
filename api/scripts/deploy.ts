import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicClient, createWalletClient, http, defineChain, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia, arbitrumSepolia } from "viem/chains";

const KNOWN_CHAINS: Chain[] = [foundry, baseSepolia, arbitrumSepolia];

/// Deploys VOID's fixed shared infrastructure to a chain: a real ERC-4337 v0.7 EntryPoint, a real
/// Kernel v3.3 implementation + factory, a real ECDSAValidator, and our own PolicyValidator
/// singleton. Written in TypeScript/viem rather than as a Foundry script because `forge script`
/// against this environment's anvil build hits an RPC incompatibility in its balance-check
/// pre-flight (an `eth_getBalance` call with a block hash where anvil expects a block tag) — a
/// tooling bug, not a project constraint. viem's `deployContract` talks to the same RPC directly
/// and sidesteps it; it's also the same stack the rest of the API already uses.
///
/// Incrementally idempotent: re-running against a chain with an existing deployment file reuses
/// every address already on record and only deploys whatever's missing from it (e.g. a module
/// added after the chain's first deploy) — existing vaults are unaffected either way, since each
/// one has its module addresses baked in at creation, not looked up live. Delete the chain's
/// deployment file first to force a genuinely fresh set of infra.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");

const ANVIL_DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const DEPLOYER_KEY = (process.env.RELAYER_PRIVATE_KEY ?? ANVIL_DEFAULT_KEY) as `0x${string}`;

function loadArtifact(sourceFile: string, contractName: string) {
  const p = path.join(CONTRACTS_DIR, "out", sourceFile, `${contractName}.json`);
  const raw = JSON.parse(readFileSync(p, "utf-8"));
  return { abi: raw.abi, bytecode: raw.bytecode.object as `0x${string}` };
}

async function main() {
  // Resolve the real chain BEFORE building any client — a client built with the wrong `chain`
  // will happily sign transactions with the wrong chain ID baked in, which every real RPC (unlike
  // permissive local Anvil) rejects outright as "invalid chain ID". Query it directly rather than
  // trusting CHAIN_ID env to match what RPC_URL actually points at.
  const probe = createPublicClient({ transport: http(RPC_URL) });
  const liveChainId = await probe.getChainId();
  const chain: Chain =
    KNOWN_CHAINS.find((c) => c.id === liveChainId) ??
    defineChain({
      id: liveChainId,
      name: `chain-${liveChainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    });

  const account = privateKeyToAccount(DEPLOYER_KEY);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  const chainId = liveChainId;
  console.log(`Deploying to chain ${chainId} (${chain.name}) via ${RPC_URL} as ${account.address}`);

  // Explicit, locally-tracked nonce rather than letting viem ask the RPC for "next nonce" before
  // each call: on a load-balanced public RPC, back-to-back deployments can have that lookup land
  // on a replica that hasn't yet seen the previous transaction, handing out a nonce that's already
  // in use and producing "replacement transaction underpriced". Fetching once and incrementing
  // ourselves removes the dependency on replica consistency entirely. The same class of staleness
  // was also showing up as apparent "execution reverted" on a constructor referencing a
  // just-deployed address (confirmed present via a direct eth_getCode) — fixed the same way, by
  // not asking the RPC to estimate/re-derive anything mid-sequence.
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

  async function deploy(sourceFile: string, contractName: string, args: unknown[] = []): Promise<Address> {
    const { abi, bytecode } = loadArtifact(sourceFile, contractName);
    const hash = await walletClient.deployContract({ abi, bytecode, args, gas: 6_000_000n, nonce: nonce++ });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error(`${contractName} deployment produced no address`);
    console.log(`  ${contractName}: ${receipt.contractAddress}`);
    return receipt.contractAddress;
  }

  // Incremental mode: if this chain already has a deployment record, reuse its already-proven
  // addresses (vaults created against them keep working regardless — the address is baked into
  // each vault at creation, not looked up live) rather than standing up a whole second set of
  // shared infra just to add one new module. Only the pieces missing from the existing file get
  // deployed. A genuinely new chain still deploys everything, same as before.
  const apiDeploymentsDir = path.resolve(__dirname, "../deployments");
  const existingPath = path.join(apiDeploymentsDir, `${chainId}.json`);
  const existing = existsSync(existingPath) ? JSON.parse(readFileSync(existingPath, "utf-8")) : undefined;

  const entryPoint: Address = existing?.entryPoint ?? (await deploy("EntryPoint.sol", "EntryPoint"));
  const kernelImpl: Address = existing?.kernelImpl ?? (await deploy("Kernel.sol", "Kernel", [entryPoint]));
  const kernelFactory: Address =
    existing?.kernelFactory ?? (await deploy("KernelFactory.sol", "KernelFactory", [kernelImpl]));
  const ecdsaValidator: Address =
    existing?.ecdsaValidator ?? (await deploy("ECDSAValidator.sol", "ECDSAValidator"));
  const policyValidator: Address =
    existing?.policyValidator ?? (await deploy("PolicyValidator.sol", "PolicyValidator"));
  const expirySweepExecutor: Address =
    existing?.expirySweepExecutor ??
    (await deploy("ExpirySweepExecutor.sol", "ExpirySweepExecutor", [policyValidator]));

  const deployment = {
    chainId,
    entryPoint,
    kernelImpl,
    kernelFactory,
    ecdsaValidator,
    policyValidator,
    expirySweepExecutor,
  };
  const deploymentJson = JSON.stringify(deployment, null, 2);

  // Written to both locations: contracts/deployments/ is the canonical record alongside the
  // source; api/deployments/ is what the API actually reads at runtime, kept self-contained so
  // the API is deployable on its own without the rest of the monorepo present (see config.ts).
  for (const dir of [path.join(CONTRACTS_DIR, "deployments"), path.resolve(__dirname, "../deployments")]) {
    mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${chainId}.json`);
    writeFileSync(outPath, deploymentJson);
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
