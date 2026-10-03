"use client";

import { useNetwork } from "@/lib/network-context";

/// Shown on every page while a real-money chain is selected. Says plainly what the limits are, so
/// nobody discovers them by losing money.
export function MainnetBanner() {
  const { network } = useNetwork();
  if (network.testnet) return null;
  return (
    <div role="status" className="border-b border-void-warn/30 bg-void-warnDim/20 px-6 py-2 text-xs text-void-warn">
      <span className="font-mono uppercase tracking-wider">Mainnet beta</span>
      <span className="mx-2 text-void-warn/50">·</span>
      Real ETH on {network.name}. Unaudited contracts. Vaults are capped at 0.005 ETH and 7 days. Only put in what you
      can afford to lose.
    </div>
  );
}
