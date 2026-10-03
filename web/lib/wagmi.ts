import { createConfig, http } from "wagmi";
import { baseSepolia, arbitrumSepolia, base, arbitrum } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, arbitrumSepolia, base, arbitrum],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

/// The chain IDs wagmi actually knows about — narrower than networks.ts's plain `number`, so
/// passing a NetworkConfig's chainId into a wagmi call (switchChain, connect) needs an explicit
/// cast through this type rather than silently widening. Keeping it here, next to the config it
/// describes, rather than inferring it ad hoc at each call site.
export type SupportedChainId = (typeof wagmiConfig)["chains"][number]["id"];
