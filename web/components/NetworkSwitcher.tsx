"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useNetwork } from "@/lib/network-context";
import { NETWORKS } from "@/lib/networks";
import { type SupportedChainId } from "@/lib/wagmi";

export function NetworkSwitcher() {
  const { network, setNetworkId } = useNetwork();
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  function choose(id: string, targetChainId: number) {
    setNetworkId(id);
    setOpen(false);
    // Best-effort: if a wallet is connected, offer to follow the dashboard's selection so the
    // revoke-signing flow doesn't silently fail from being on the wrong chain. The user can
    // decline in their wallet without breaking anything else here.
    if (isConnected && chainId !== targetChainId) {
      switchChain({ chainId: targetChainId as SupportedChainId });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-void-border bg-void-raised px-2.5 py-1 text-[11px] font-medium text-void-muted hover:border-void-borderStrong"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-void-accent" />
        {network.name}
        <span className="text-void-dim">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-sm border border-void-border bg-void-surface py-1 shadow-lg">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                onClick={() => choose(n.id, n.chainId)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-void-raised ${
                  n.id === network.id ? "text-void-text" : "text-void-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${n.id === network.id ? "bg-void-accent" : "bg-void-dim"}`}
                />
                {n.name}
                {!n.testnet && (
                  <span className="ml-auto rounded-full border border-void-warn/40 px-1.5 py-px font-mono text-[9px] uppercase text-void-warn">
                    real
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
