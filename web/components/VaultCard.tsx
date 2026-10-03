"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { VaultRecord } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { formatDuration, pctOf, truncateAddress, weiToEthDisplay } from "@/lib/format";
import { Badge, BudgetBar } from "@/components/ui";
import { GateStrip, type GateArm } from "@/components/GateStrip";
import { PerimeterRing } from "@/components/PerimeterRing";

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
  const total = Math.max(1, vault.policy.validUntil - vault.policy.validAfter);
  const sessionLeft = ended ? 0 : Math.max(0.04, Math.min(1, remaining / total));
  const gates: GateArm[] = ended ? ["closed", "off", "off", "off", "off"] : ["armed", "armed", "armed", "armed", "armed"];

  return (
    <Link
      href={`/vaults/${vault.vaultAddress}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-sm border transition duration-300 ${
        ended
          ? "border-dashed border-void-border bg-void-bg/60 saturate-0 hover:border-void-borderStrong"
          : "border-void-success/40 bg-gradient-to-b from-void-successDim/40 via-void-surface to-void-surface shadow-[0_0_0_1px_rgba(52,211,153,0.08),0_20px_60px_-22px_rgba(52,211,153,0.6)] hover:-translate-y-1 hover:border-void-success/70 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.2),0_28px_70px_-20px_rgba(52,211,153,0.75)]"
      }`}
    >
      {!ended && (
        <>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(110,255,200,0.9),transparent)]" />
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 animate-sheen bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)]" />
        </>
      )}
      <div className="relative flex items-center justify-between px-5 pt-5">
        <span className={`font-mono text-sm ${ended ? "text-void-dim line-through decoration-void-border" : "text-void-text"}`}>
          {truncateAddress(vault.vaultAddress, 5)}
        </span>
        <Badge tone={tone}>
          {tone === "active" && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-void-success opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-void-success" />
            </span>
          )}
          {ended && <span className="text-[10px] leading-none">✕</span>}
          {label}
        </Badge>
      </div>

      <div className="relative flex items-center gap-4 px-5 pb-5 pt-4">
        <div className="min-w-0 flex-1">
          <span className={`font-display text-3xl font-bold tracking-tight ${ended ? "text-void-dim" : "text-void-text"}`}>
            {weiToEthDisplay(spent)}
            <span className="ml-1.5 font-mono text-xs font-normal tracking-normal text-void-dim">
              / {weiToEthDisplay(cap)} ETH
            </span>
          </span>
          <div className="mt-4">
            <GateStrip states={gates} />
          </div>
          <div className={`mt-3 ${ended ? "opacity-30" : ""}`}>
            <BudgetBar pct={spentPct} tone={revoked ? "revoked" : spentPct > 80 ? "warn" : "active"} />
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
          <PerimeterRing progress={sessionLeft} size={84} state={ended ? "dead" : "sealed"} duration={1.1} />
          <span className={`font-mono text-[11px] ${ended ? "text-void-dim" : "text-void-success"}`}>
            {ended ? "ended" : `${formatDuration(remaining)} left`}
          </span>
        </div>
      </div>

      <div className="relative mt-auto flex items-center justify-between border-t border-void-border px-5 py-3 text-xs">
        <span className="font-mono text-void-dim">
          {s ? `${s.txCount}/${s.maxTxCount} tx` : `owner ${truncateAddress(vault.ownerAddress)}`}
        </span>
        <span className={`font-medium transition group-hover:translate-x-0.5 ${ended ? "text-void-muted" : "text-void-cta"}`}>
          {ended ? "View history →" : "Open console →"}
        </span>
      </div>
    </Link>
  );
}
