"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { VaultRecord } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { formatDuration, pctOf, truncateAddress, weiToEthDisplay } from "@/lib/format";
import { Badge, BudgetBar } from "@/components/ui";

export function VaultCard({ vault }: { vault: VaultRecord }) {
  const { network, api } = useNetwork();

  // Same query key as the vault detail page, so opening a card is instant and both stay in sync.
  const statusQuery = useQuery({
    queryKey: ["vault-status", network.id, vault.vaultAddress],
    queryFn: () => api.getVaultStatus(vault.vaultAddress),
    refetchInterval: 30_000,
  });
  const s = statusQuery.data;

  const now = Math.floor(Date.now() / 1000);
  const validUntil = s?.validUntil ?? vault.policy.validUntil;
  const remaining = validUntil - now;
  const revoked = s?.revoked ?? false;
  const ended = revoked || remaining <= 0;

  const tone = revoked ? "revoked" : ended ? "expired" : "active";
  const label = revoked ? "Revoked" : ended ? "Expired" : "Active";

  const cap = s?.nativeSpendCap ?? vault.policy.nativeSpendCap;
  const spent = s?.nativeSpent ?? "0";
  const spentPct = pctOf(spent, cap);

  return (
    <Link
      href={`/vaults/${vault.vaultAddress}`}
      className="group flex h-full flex-col rounded-sm border border-void-border bg-void-surface transition hover:border-void-borderStrong"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <span className={`font-mono text-sm ${ended ? "text-void-muted" : "text-void-text"}`}>
          {truncateAddress(vault.vaultAddress, 5)}
        </span>
        <Badge tone={tone}>
          {tone === "active" && <span className="h-1.5 w-1.5 rounded-full bg-void-success" />}
          {label}
        </Badge>
      </div>

      <div className="px-4 pb-4 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-lg text-void-text">
            {weiToEthDisplay(spent)}
            <span className="text-void-dim"> / {weiToEthDisplay(cap)} ETH</span>
          </span>
          <span className="text-xs text-void-dim">{ended ? "ended" : `${formatDuration(remaining)} left`}</span>
        </div>
        <div className={`mt-2.5 ${ended && !revoked ? "opacity-40" : ""}`}>
          <BudgetBar pct={spentPct} tone={revoked ? "revoked" : spentPct > 80 ? "warn" : "active"} />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-void-border px-4 py-2.5 text-xs">
        <span className="text-void-dim">
          {s ? `${s.txCount}/${s.maxTxCount} tx` : `owner ${truncateAddress(vault.ownerAddress)}`}
        </span>
        <span className="text-void-accent transition group-hover:translate-x-0.5">
          {ended ? "View history →" : "Open console →"}
        </span>
      </div>
    </Link>
  );
}
