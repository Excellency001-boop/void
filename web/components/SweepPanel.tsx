"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { weiToEthDisplay } from "@/lib/format";
import { PrimaryButton } from "@/components/ui";

/// Surfaces ExpirySweepExecutor's permissionless sweep in the UI — same guarantee as force-revoke
/// (funds return to the owner), just for the "nobody clicked anything" case: expiry. The on-chain
/// automatic keeper (api/src/keeper.ts) already does this without a human in the loop; this button
/// exists so the demo doesn't have to wait out a keeper poll interval to show it happening, and so
/// anyone — not just the owner — can see the mechanism is really callable by anyone.
export function SweepPanel({ vaultAddress, onSwept }: { vaultAddress: string; onSwept: () => void }) {
  const { api } = useNetwork();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sweptAmount, setSweptAmount] = useState<string>("0");

  const sweepQuery = useQuery({
    queryKey: ["sweep-status", vaultAddress],
    queryFn: () => api.getSweepStatus(vaultAddress),
    refetchInterval: 8_000,
  });

  const status = sweepQuery.data;

  if (txHash) {
    return <p className="text-xs text-void-accent">Swept {weiToEthDisplay(sweptAmount)} ETH back to the owner.</p>;
  }

  if (!status?.installed || !status.eligible || status.amountWei === "0") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <PrimaryButton
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await api.sweepVault(vaultAddress);
            setTxHash(res.txHash);
            setSweptAmount(res.amountWei);
            onSwept();
          } catch (err) {
            // The sweep is permissionless and an automatic keeper also races to call it (see
            // api/src/keeper.ts) — a failed manual click here can simply mean the keeper (or
            // someone else) already swept it first, not that anything is actually wrong.
            // Re-check live status before showing an error, so that race reads as success.
            const fresh = await api.getSweepStatus(vaultAddress).catch(() => undefined);
            if (fresh && fresh.amountWei === "0") {
              setTxHash("already-swept");
              setSweptAmount(status.amountWei);
            } else {
              setError(err instanceof ApiError ? err.message : "Sweep failed");
            }
            onSwept();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sweeping…" : `Sweep ${weiToEthDisplay(status.amountWei)} ETH to owner`}
      </PrimaryButton>
      {error && <span className="text-xs text-void-danger">{error}</span>}
    </div>
  );
}
