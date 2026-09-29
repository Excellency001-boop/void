import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
/// Not idempotent: re-running against a chain that already has vaults deploys a SEPARATE, fresh
/// set of infra and overwrites the address file — existing vaults would still work on-chain
/// (nothing about them changes) but would no longer be reachable through the new deployment file
/// unless you keep track of both. Fine for local dev; a real environment deploys once.

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

  const entryPoint = await deploy("EntryPoint.sol", "EntryPoint");
  const kernelImpl = await deploy("Kernel.sol", "Kernel", [entryPoint]);
  const kernelFactory = await deploy("KernelFactory.sol", "KernelFactory", [kernelImpl]);
  const ecdsaValidator = await deploy("ECDSAValidator.sol", "ECDSAValidator");
  const policyValidator = await deploy("PolicyValidator.sol", "PolicyValidator");

  const deployment = { chainId, entryPoint, kernelImpl, kernelFactory, ecdsaValidator, policyValidator };

  const outDir = path.join(CONTRACTS_DIR, "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${chainId}.json`);
  writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
