"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { weiToEthDisplay, formatDuration, formatTimestamp, pctOf, ethToWei } from "@/lib/format";
import {
  Card,
  CardHeader,
  Label,
  Badge,
  BudgetBar,
  AddressLink,
  CopyableAddress,
  TxLink,
  BackLink,
  SecondaryButton,
} from "@/components/ui";
import { RevokePanel } from "@/components/RevokePanel";
import { SweepPanel } from "@/components/SweepPanel";
import { AgentConsole } from "@/components/AgentConsole";

export default function VaultDetailPage() {
  const { address } = useParams<{ address: string }>();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { network, api } = useNetwork();

  const statusQuery = useQuery({
    queryKey: ["vault-status", network.id, address],
    queryFn: () => api.getVaultStatus(address),
    refetchInterval: 8_000,
  });

  const historyQuery = useQuery({
    queryKey: ["vault-history", network.id, address],
    queryFn: () => api.getVaultHistory(address),
    refetchInterval: 8_000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["vault-status", network.id, address] });
    queryClient.invalidateQueries({ queryKey: ["vault-history", network.id, address] });
  }

  if (statusQuery.isLoading) {
    return <div className="text-sm text-void-dim">Loading vault…</div>;
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 px-4 py-3 text-sm text-void-danger">
        Couldn&apos;t load this vault. Wrong address, or the API can&apos;t reach the chain.
      </div>
    );
  }

  const s = statusQuery.data;
  const now = Math.floor(Date.now() / 1000);
  const remaining = s.validUntil - now;
  const spentPct = pctOf(s.nativeSpent, s.nativeSpendCap);
  const txPct = pctOf(s.txCount, s.maxTxCount);

  const tone = s.revoked ? "revoked" : s.expired ? "expired" : "active";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/">Back to vaults</BackLink>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl text-void-text">
            <CopyableAddress address={s.vaultAddress} chars={6} />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-void-muted">
            <span>owner</span>
            <CopyableAddress address={s.owner} />
            <span>· session key</span>
            <CopyableAddress address={s.sessionKeyAddress} />
          </p>
        </div>
        <Badge tone={tone}>{s.revoked ? "Revoked" : s.expired ? "Expired" : "Active"}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="text-sm font-medium text-void-text">Native budget</span>
            <span className="font-mono text-xs text-void-muted">
              {weiToEthDisplay(s.nativeSpent)} / {weiToEthDisplay(s.nativeSpendCap)} ETH
            </span>
          </CardHeader>
          <div className="p-4">
            <BudgetBar pct={spentPct} tone={tone === "revoked" ? "revoked" : spentPct > 80 ? "warn" : "active"} />
            <p className="mt-2 text-xs text-void-dim">
              {weiToEthDisplay(s.remainingNativeBudget)} ETH remaining
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-sm font-medium text-void-text">Transactions</span>
            <span className="font-mono text-xs text-void-muted">
              {s.txCount} / {s.maxTxCount}
            </span>
          </CardHeader>
          <div className="p-4">
            <BudgetBar pct={txPct} tone={tone === "revoked" ? "revoked" : txPct > 80 ? "warn" : "active"} />
            <p className="mt-2 text-xs text-void-dim">
              expires {formatTimestamp(s.validUntil)} ({formatDuration(remaining)} left)
            </p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RevokePanel vaultAddress={s.vaultAddress} onRevoked={invalidate} />
        <DepositButton vaultAddress={s.vaultAddress} onDeposited={invalidate} />
        <SweepPanel vaultAddress={s.vaultAddress} onSwept={invalidate} />
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-void-text">Action history</span>
          <span className="text-xs text-void-dim">from ActionValidated logs</span>
        </CardHeader>
        <div className="divide-y divide-void-border">
          {historyQuery.data?.actions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-void-dim">No actions yet.</div>
          )}
          {historyQuery.data?.actions.map((a) => (
            <div key={a.transactionHash} className="flex items-center justify-between px-4 py-3 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-void-text">
                  <AddressLink address={a.target} /> <span className="text-void-dim">{a.selector}</span>
                </span>
                <span className="text-void-dim">block {a.blockNumber}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {Number(a.value) > 0 && (
                  <span className="font-mono text-void-muted">{weiToEthDisplay(a.value)} ETH</span>
                )}
                <TxLink hash={a.transactionHash} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div id="console" className="scroll-mt-8">
        <AgentConsole
          vaultAddress={s.vaultAddress}
          initialSessionKey={searchParams.get("sessionKey") ?? ""}
          initialTarget={searchParams.get("target") ?? ""}
        />
      </div>
    </div>
  );
}

function DepositButton({ vaultAddress, onDeposited }: { vaultAddress: string; onDeposited: () => void }) {
  const { api } = useNetwork();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0.005");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <SecondaryButton type="button" onClick={() => setOpen(true)}>
        Deposit (demo)
      </SecondaryButton>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="w-24 rounded-sm border border-void-border bg-void-raised px-2 py-1.5 font-mono text-xs text-void-text focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
      />
      <SecondaryButton
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.depositToVault(vaultAddress, ethToWei(amount));
            onDeposited();
            setOpen(false);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Deposit failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Send ETH"}
      </SecondaryButton>
      {error && <span className="text-xs text-void-danger">{error}</span>}
    </div>
  );
}
