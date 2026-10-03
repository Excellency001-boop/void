export interface NetworkConfig {
  id: string;
  chainId: number;
  name: string;
  apiUrl: string;
  explorerBase: string;
  /// Testnets get the demo faucet and no beta limits. Mainnets are real money, capped, unaudited.
  testnet: boolean;
}

// Each network is served by its own deployed API instance (see api/README.md) — not one
// multi-chain service. Keeping the API single-chain-per-process was the deliberate call: it's the
// shape that's already proven, and duplicating a simple proven service per chain is a smaller,
// safer diff under time pressure than generalizing it. This file is the one place the dashboard
// knows there's more than one.
export const NETWORKS: NetworkConfig[] = [
  {
    id: "base-sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    apiUrl: process.env.NEXT_PUBLIC_BASE_API_URL ?? "https://void-api-production-fc5e.up.railway.app",
    explorerBase: "https://sepolia.basescan.org",
    testnet: true,
  },
  {
    id: "arbitrum-sepolia",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    apiUrl: process.env.NEXT_PUBLIC_ARBITRUM_API_URL ?? "https://void-api-arbitrum-production.up.railway.app",
    explorerBase: "https://sepolia.arbiscan.io",
    testnet: true,
  },
  // Mainnets appear only once their API URL is configured, so the switcher never offers a chain
  // that has nothing behind it.
  ...(process.env.NEXT_PUBLIC_BASE_MAINNET_API_URL
    ? [
        {
          id: "base",
          chainId: 8453,
          name: "Base",
          apiUrl: process.env.NEXT_PUBLIC_BASE_MAINNET_API_URL,
          explorerBase: "https://basescan.org",
          testnet: false,
        },
      ]
    : []),
  ...(process.env.NEXT_PUBLIC_ARBITRUM_MAINNET_API_URL
    ? [
        {
          id: "arbitrum-one",
          chainId: 42161,
          name: "Arbitrum One",
          apiUrl: process.env.NEXT_PUBLIC_ARBITRUM_MAINNET_API_URL,
          explorerBase: "https://arbiscan.io",
          testnet: false,
        },
      ]
    : []),
];

export const DEFAULT_NETWORK = NETWORKS[0];

export function networkById(id: string): NetworkConfig {
  return NETWORKS.find((n) => n.id === id) ?? DEFAULT_NETWORK;
}

export function networkByChainId(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.chainId === chainId);
}

export function explorerAddressUrl(network: NetworkConfig, address: string) {
  return `${network.explorerBase}/address/${address}`;
}

export function explorerTxUrl(network: NetworkConfig, hash: string) {
  return `${network.explorerBase}/tx/${hash}`;
}
