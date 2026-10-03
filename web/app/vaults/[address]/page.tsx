"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, createApiClient } from "@/lib/api";
import { NETWORKS, networkById } from "@/lib/networks";
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
  CopyButton,
  TxLink,
  BackLink,
  SecondaryButton,
} from "@/components/ui";
import { RevokePanel } from "@/components/RevokePanel";
import { SweepPanel } from "@/components/SweepPanel";
import { AgentConsole } from "@/components/AgentConsole";
import { takeHandoff, type Handoff } from "@/lib/handoff";
import { PerimeterRing } from "@/components/PerimeterRing";
import { GateStrip, type GateArm } from "@/components/GateStrip";

export default function VaultDetailPage() {
  const { address } = useParams<{ address: string }>();
  const queryClient = useQueryClient();
  const { network, api, setNetworkId } = useNetwork();

  // The success screen hands the session key over through sessionStorage, once, instead of a URL.
  const [handoff, setHandoffState] = useState<Handoff | null>(null);
  const taken = useRef<{ address: string; value: Handoff | null } | null>(null);
  useEffect(() => {
    // takeHandoff deletes the entry, so a second effect run (React strict mode) must reuse the first read.
    if (!taken.current || taken.current.address !== address) {
      taken.current = { address, value: takeHandoff(address) };
    }
    setHandoffState(taken.current.value);
  }, [address]);

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

  // A vault lives on exactly one chain. If this address is not on the active one, ask the other
  // chains' APIs before telling the visitor it does not exist, so a shared link just works.
  // The API answers 200 with an all-zero policy for any address that is not a vault on this chain.
  const emptyPolicy =
    !!statusQuery.data && (statusQuery.data.validUntil === 0 || /^0x0{40}$/i.test(statusQuery.data.owner));
  const notHere = statusQuery.isError || emptyPolicy;

  const elsewhereQuery = useQuery({
    queryKey: ["vault-elsewhere", address, network.id],
    enabled: notHere,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const others = NETWORKS.filter((n) => n.id !== network.id);
      const hits = await Promise.all(
        others.map(async (n) => {
          try {
            const st = await createApiClient(n.apiUrl).getVaultStatus(address);
            return st && st.validUntil !== 0 ? n.id : null;
          } catch {
            return null;
          }
        })
      );
      return hits.find((id): id is string => id !== null) ?? null;
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["vault-status", network.id, address] });
    queryClient.invalidateQueries({ queryKey: ["vault-history", network.id, address] });
  }

  if (statusQuery.isLoading) {
    return <div className="font-mono text-sm text-void-dim">Reading the chain…</div>;
  }

  if (notHere || !statusQuery.data) {
    if (elsewhereQuery.isLoading) {
      return <div className="font-mono text-sm text-void-dim">Checking the other chains…</div>;
    }
    const foundId = elsewhereQuery.data;
    if (foundId) {
      const found = networkById(foundId);
      return (
        <div className="flex flex-col gap-4 rounded-sm border border-void-accent/40 bg-void-surface px-5 py-5">
          <div>
            <div className="font-display text-xl font-bold text-void-text">This vault lives on {found.name}.</div>
            <p className="mt-1 text-sm text-void-muted">
              You are viewing {network.name}. A vault exists on exactly one chain, so switch to see it.
            </p>
          </div>
          <div>
            <SecondaryButton onClick={() => setNetworkId(found.id)}>Switch to {found.name}</SecondaryButton>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 px-4 py-3 text-sm text-void-danger">
        No vault found at this address on any supported chain. Check the address and try again.
      </div>
    );
  }

  const s = statusQuery.data;
  const now = Math.floor(Date.now() / 1000);
  const remaining = s.validUntil - now;
  const spentPct = pctOf(s.nativeSpent, s.nativeSpendCap);
  const txPct = pctOf(s.txCount, s.maxTxCount);

  const tone = s.revoked ? "revoked" : s.expired ? "expired" : "active";
  const ended = s.revoked || s.expired;
  const total = Math.max(1, s.validUntil - s.validAfter);
  const sessionLeft = ended ? 0 : Math.max(0.03, Math.min(1, remaining / total));
  const gates: GateArm[] = ended ? ["closed", "off", "off", "off", "off"] : ["armed", "armed", "armed", "armed", "armed"];

  const theme = s.revoked
    ? {
        frame: "border-void-danger/35 shadow-[0_0_100px_-30px_rgba(240,71,92,0.6)]",
        glow: "rgba(240,71,92,0.28)",
        word: "revoked.",
        wordClass: "text-void-danger",
        lead: "Session",
        sub: "Gate 1 now rejects every action this key tries. The agent is locked out, and the funds were never in its hands.",
      }
    : s.expired
      ? {
          frame: "border-void-borderStrong shadow-none",
          glow: "rgba(107,107,118,0.18)",
          word: "ended.",
          wordClass: "text-void-muted",
          lead: "Session",
          sub: "Gate 1 now rejects every action. Anything left in the vault can be swept back to the owner.",
        }
      : {
          frame: "border-void-success/35 shadow-[0_0_100px_-30px_rgba(52,211,153,0.6)]",
          glow: "rgba(52,211,153,0.26)",
          word: "holding.",
          wordClass: "text-void-success",
          lead: "The perimeter is",
          sub: `${formatDuration(remaining)} left. Anything outside this policy is rejected on-chain, in the same order, every time.`,
        };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/">Back to vaults</BackLink>
      </div>

      <section className={`relative overflow-hidden rounded-lg border bg-void-surface ${theme.frame}`}>
        <span
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${theme.glow}, transparent)` }}
        />
        <div className="relative grid items-center gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-void-dim">
                Session vault · {network.name}
              </span>
              <Badge tone={tone}>{s.revoked ? "Revoked" : s.expired ? "Expired" : "Active"}</Badge>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-void-text sm:text-5xl">
              {theme.lead}{" "}
              <span className={`font-serif text-[1.14em] font-normal italic tracking-[-0.02em] ${theme.wordClass}`}>
                {theme.word}
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-void-muted">{theme.sub}</p>
            <div className="mt-5 flex flex-col gap-2 text-xs text-void-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-void-dim">vault</span>
                <span className="break-all font-mono text-void-text">{s.vaultAddress}</span>
                <CopyButton value={s.vaultAddress} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-void-dim">owner</span>
                <CopyableAddress address={s.owner} />
                <span className="ml-3 text-void-dim">session key</span>
                <CopyableAddress address={s.sessionKeyAddress} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PerimeterRing progress={sessionLeft} size={150} state={ended ? "dead" : "sealed"} duration={1.3} />
            <span className={`font-mono text-xs ${ended ? "text-void-dim" : "text-void-success"}`}>
              {ended ? (s.revoked ? "revoked" : "ended") : `${formatDuration(remaining)} left`}
            </span>
          </div>
        </div>

        <div className="relative grid grid-cols-1 divide-y divide-void-border border-t border-void-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-7 py-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-void-dim">Spent</div>
            <div className={`mt-1 font-display text-3xl font-bold tracking-tight ${ended ? "text-void-muted" : "text-void-text"}`}>
              {weiToEthDisplay(s.nativeSpent)}
              <span className="ml-1.5 font-mono text-xs font-normal text-void-dim">/ {weiToEthDisplay(s.nativeSpendCap)} ETH</span>
            </div>
            <div className="mt-3">
              <BudgetBar pct={spentPct} tone={s.revoked ? "revoked" : spentPct > 80 ? "warn" : "active"} />
            </div>
          </div>
          <div className="px-7 py-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-void-dim">Transactions</div>
            <div className={`mt-1 font-display text-3xl font-bold tracking-tight ${ended ? "text-void-muted" : "text-void-text"}`}>
              {s.txCount}
              <span className="ml-1.5 font-mono text-xs font-normal text-void-dim">/ {s.maxTxCount} allowed</span>
            </div>
            <div className="mt-3">
              <BudgetBar pct={txPct} tone={s.revoked ? "revoked" : txPct > 80 ? "warn" : "active"} />
            </div>
          </div>
          <div className="px-7 py-5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-void-dim">Hard expiry</div>
            <div className={`mt-1 font-display text-3xl font-bold tracking-tight ${ended ? "text-void-muted" : "text-void-text"}`}>
              {formatTimestamp(s.validUntil)}
            </div>
            <p className="mt-3 font-mono text-xs text-void-dim">
              {weiToEthDisplay(s.remainingNativeBudget)} ETH of budget unspent
            </p>
          </div>
        </div>

        <div className="relative border-t border-void-border px-7 py-5">
          <GateStrip states={gates} labels />
        </div>
      </section>

      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-void-dim">Owner controls</div>
      <div className="flex flex-wrap items-center gap-3">
        <RevokePanel vaultAddress={s.vaultAddress} onRevoked={invalidate} />
        <DepositButton vaultAddress={s.vaultAddress} onDeposited={invalidate} />
        <SweepPanel vaultAddress={s.vaultAddress} onSwept={invalidate} />
      </div>
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
          key={handoff ? "handoff" : "manual"}
          vaultAddress={s.vaultAddress}
          initialSessionKey={handoff?.sessionKey ?? ""}
          initialTarget={handoff?.target ?? ""}
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
