"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useNetwork } from "@/lib/network-context";
import { type SupportedChainId } from "@/lib/wagmi";
import { truncateAddress } from "@/lib/format";

export function ConnectWalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { network } = useNetwork();

  if (isConnected && address) {
    const wrongChain = chainId !== network.chainId;
    return (
      <div className="flex items-center gap-2">
        {wrongChain && (
          <button
            onClick={() => switchChain({ chainId: network.chainId as SupportedChainId })}
            className="rounded-sm border border-void-warn/40 bg-void-warnDim/30 px-2.5 py-1.5 text-xs font-medium text-void-warn hover:bg-void-warnDim/50"
          >
            Switch to {network.name}
          </button>
        )}
        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 rounded-sm border border-void-border bg-void-raised px-3 py-1.5 font-mono text-xs text-void-text hover:border-void-borderStrong"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-void-accent" />
          {truncateAddress(address)}
        </button>
      </div>
    );
  }

  const connector = connectors[0];
  return (
    <button
      onClick={() => connector && connect({ connector, chainId: network.chainId as SupportedChainId })}
      disabled={isPending || !connector}
      className="rounded-sm border border-void-border bg-void-raised px-3 py-1.5 text-xs font-medium text-void-text hover:border-void-borderStrong disabled:opacity-50"
    >
      {isPending ? "Connecting…" : connector ? "Connect Wallet" : "No wallet found"}
    </button>
  );
}
