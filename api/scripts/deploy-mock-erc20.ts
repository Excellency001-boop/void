import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicClient, createWalletClient, http, defineChain, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia, arbitrumSepolia } from "viem/chains";

// One-off: deploys the MockERC20 test fixture as a target contract for exercising the API's agent
// routes against something real. Same explicit-gas / explicit-nonce pattern as scripts/deploy.ts,
// for the same reason (public RPC replica staleness on back-to-back writes).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, "../../contracts");
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
const KNOWN_CHAINS: Chain[] = [foundry, baseSepolia, arbitrumSepolia];

async function main() {
  const artifact = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, "out/MockERC20.sol/MockERC20.json"), "utf-8"));
  const account = privateKeyToAccount(KEY);
  const probe = createPublicClient({ transport: http(RPC_URL) });
  const liveChainId = await probe.getChainId();
  const chain =
    KNOWN_CHAINS.find((c) => c.id === liveChainId) ??
    defineChain({
      id: liveChainId,
      name: `chain-${liveChainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    });
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    gas: 2_000_000n,
    nonce,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("MockERC20 deployed at:", receipt.contractAddress);
  console.log("tx:", hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
