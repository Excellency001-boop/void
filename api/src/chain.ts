import { createPublicClient, createWalletClient, http, defineChain, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia, arbitrumSepolia } from "viem/chains";
import { config } from "./config.js";

const KNOWN_CHAINS: Chain[] = [foundry, baseSepolia, arbitrumSepolia];

function resolveChain(): Chain {
  const known = KNOWN_CHAINS.find((c) => c.id === config.CHAIN_ID);
  if (known) return known;
  // Fall back to a minimal custom chain definition so an unlisted testnet still works as long as
  // RPC_URL/CHAIN_ID are set correctly — only the name is cosmetic.
  return defineChain({
    id: config.CHAIN_ID,
    name: `chain-${config.CHAIN_ID}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.RPC_URL] } },
  });
}

export const chain: Chain = resolveChain();

export const relayerAccount = privateKeyToAccount(config.RELAYER_PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain,
  transport: http(config.RPC_URL),
});

export const relayerClient = createWalletClient({
  account: relayerAccount,
  chain,
  transport: http(config.RPC_URL),
});
