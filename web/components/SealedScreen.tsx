"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ApiClient } from "@/lib/api";
import { explorerAddressUrl, explorerTxUrl, type NetworkConfig } from "@/lib/networks";
import { ethToWei, formatTimestamp, truncateAddress } from "@/lib/format";
import { copyText } from "@/lib/clipboard";
import { setHandoff } from "@/lib/handoff";
import { useNetwork } from "@/lib/network-context";
import { GateStrip } from "@/components/GateStrip";
import { VaultSeal } from "@/components/VaultSeal";
import { Card, Label, PrimaryButton, SecondaryButton, CopyButton } from "@/components/ui";

/// A deliberately not-whitelisted address. The "simulate a rejection" step pre-fills it so the very
/// first click produces a real on-chain rejection instead of an empty form.
const UNAUTHORIZED_DEMO_TARGET = "0x00000000000000000000000000000000deadbeef";
const FUND_CAP_ETH = 0.05;

export interface SealedPolicy {
  budgetEth: string;
  maxTx: number;
  durationSeconds: number;
  durationLabel: string;
  deployedAt: number;
  allowedTarget?: string;
  allowedSignature?: string;
}

/// The post-deploy screen. Everything here is pinned to the network the vault was created on
/// (`network` / `api` are snapshots, not the live header selection), because the vault only exists
/// on that chain: following the header switcher would send funding and explorer links to a chain
/// where this address is empty. The summary is not an echo of the form either; it is checked
/// against what the contract actually stored.
export function SealedScreen({
  vaultAddress,
  sessionKey,
  deployTxHash,
  network,
  api,
  policy,
}: {
  vaultAddress: string;
  sessionKey: string;
  deployTxHash: string;
  network: NetworkConfig;
  api: ApiClient;
  policy: SealedPolicy;
}) {
  const { network: live, setNetworkId } = useNetwork();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [keySaved, setKeySaved] = useState(false);
  const expiresAt = policy.deployedAt + policy.durationSeconds;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // The key is shown exactly once. Until it has been copied, a reload, tab close, or in-app link
  // is a one-way door, so say so before it happens.
  useEffect(() => {
    if (keySaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [keySaved]);

  function guardLeave(e: React.MouseEvent) {
    if (keySaved) return;
    if (!window.confirm("You have not copied the session key. It is shown once and cannot be recovered. Leave anyway?")) {
      e.preventDefault();
    }
  }

  const instructions = buildAgentInstructions({
    network,
    vaultAddress,
    sessionKey,
    expiresAt,
    policy,
  });

  const status = useQuery({
    queryKey: ["sealed-status", network.id, vaultAddress],
    queryFn: async () => {
      const st = await api.getVaultStatus(vaultAddress);
      // A just-deployed vault can read back as an empty policy from a lagging RPC replica. That is
      // "not readable yet", not a verdict, so retry instead of caching zeros as the truth.
      if (st.validUntil === 0 || /^0x0{40}$/i.test(st.owner)) throw new Error("policy not readable yet");
      return st;
    },
    retry: 10,
    retryDelay: 1500,
    staleTime: Infinity,
  });
  const onChain = status.data;
  const mismatch =
    onChain &&
    (onChain.nativeSpendCap !== ethToWei(policy.budgetEth) ||
      onChain.maxTxCount !== String(policy.maxTx) ||
      Math.abs(onChain.validUntil - expiresAt) > 180);
  const shownExpiry = onChain ? onChain.validUntil : expiresAt;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="pointer-events-none fixed inset-0 z-40 animate-flash bg-[radial-gradient(circle_at_50%_24%,rgba(52,211,153,0.4),transparent_58%)] motion-reduce:hidden" />

      <div>
        <Link href="/" onClick={guardLeave} className="text-xs text-void-muted hover:text-void-text">
          ← Back to vaults
        </Link>
      </div>

      {live.id !== network.id && (
        <div role="status" className="rounded-sm border border-void-warn/30 bg-void-warnDim/15 px-4 py-3 text-xs text-void-warn">
          The header is set to {live.name}, but this vault lives on {network.name}. Everything on this screen stays on {network.name}.
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        <VaultSeal />
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-void-success">Policy sealed</span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-5xl font-extrabold leading-none tracking-[-0.045em] text-void-text outline-none"
        >
          Your vault is{" "}
          <span className="font-serif text-[1.14em] font-normal italic tracking-[-0.02em] text-void-success">live.</span>
        </h1>
        <p className="max-w-md text-sm text-void-muted">
          On {network.name}, from this block on, the contract enforces this policy. Not this app, not the agent.
        </p>
      </div>

      <Card className="relative overflow-hidden border-void-success/30 shadow-[0_0_90px_-20px_rgba(52,211,153,0.55)]">
        <span className="pointer-events-none absolute inset-x-0 z-10 h-px animate-scan bg-[linear-gradient(90deg,transparent,rgba(110,255,200,1),transparent)] shadow-[0_0_18px_4px_rgba(52,211,153,0.5)] motion-reduce:hidden" />
        <div className="border-b border-void-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-void-dim">Policy gates</span>
            <span className="font-mono text-[11px] text-void-success">5 of 5 armed</span>
          </div>
          <GateStrip states={["armed", "armed", "armed", "armed", "armed"]} labels />
        </div>

        <div className="p-5">
          <Label>Vault address</Label>
          <div className="mt-2 flex items-start gap-3 rounded-sm border border-void-success/30 bg-void-successDim/20 px-4 py-3">
            <span className="flex-1 break-all font-mono text-[15px] leading-snug text-void-text">{vaultAddress}</span>
            <CopyButton value={vaultAddress} className="mt-0.5" />
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-void-border border-t border-void-border">
          <Stat label="Spend cap" value={`${policy.budgetEth} ETH`} />
          <Stat label="Max transactions" value={String(policy.maxTx)} />
          <Stat label="Expires" value={policy.durationLabel} sub={formatTimestamp(shownExpiry)} />
        </div>

        <div className="border-t border-void-border px-5 py-3 text-xs text-void-muted">
          {policy.allowedTarget ? (
            <>
              Pre-approved: <span className="font-mono text-void-text">{truncateAddress(policy.allowedTarget)}</span>{" "}
              <span className="font-mono text-void-dim">{policy.allowedSignature}</span>
            </>
          ) : (
            "No pre-approved calls. Everything the agent tries is rejected until you add one."
          )}
        </div>

        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 border-t px-5 py-3 font-mono text-[11px] ${
            mismatch
              ? "border-void-danger/40 bg-void-dangerDim/20 text-void-danger"
              : onChain
                ? "border-void-border text-void-success"
                : "border-void-border text-void-dim"
          }`}
        >
          {mismatch ? (
            <>The chain disagrees with this summary. Do not use this vault. Revoke it and create another.</>
          ) : onChain ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Verified on-chain: cap, limit and expiry read back from the contract match.
            </>
          ) : status.isError ? (
            <>Could not read the vault back yet. The numbers above are what you set, not yet confirmed.</>
          ) : (
            <>Reading the policy back from the chain…</>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-void-cta">Next, three steps</span>
        <span className="h-px flex-1 bg-gradient-to-r from-void-borderStrong to-transparent" />
      </div>

      <NextSteps
        vaultAddress={vaultAddress}
        sessionKey={sessionKey}
        instructions={instructions}
        keySaved={keySaved}
        onKeySaved={() => setKeySaved(true)}
        fund={(wei) => api.depositToVault(vaultAddress, wei)}
        network={network}
        onSimulate={() => {
          setNetworkId(network.id);
          setHandoff({ vault: vaultAddress, sessionKey, target: UNAUTHORIZED_DEMO_TARGET });
        }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <a href={explorerAddressUrl(network, vaultAddress)} target="_blank" rel="noreferrer" className="flex-1">
            <SecondaryButton type="button" className="w-full">
              View on explorer ↗
            </SecondaryButton>
          </a>
          <Link
            href={`/vaults/${vaultAddress}`}
            onClick={(e) => {
              guardLeave(e);
              if (!e.defaultPrevented) setNetworkId(network.id);
            }}
            className="flex-1"
          >
            <SecondaryButton type="button" className="w-full">
              Open vault
            </SecondaryButton>
          </Link>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-void-dim">
          <a
            href={explorerTxUrl(network, deployTxHash)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-void-accent underline decoration-void-accentDim underline-offset-2 hover:decoration-void-accent"
          >
            deployment tx {truncateAddress(deployTxHash)} ↗
          </a>
          <span>·</span>
          <ShareLink vaultAddress={vaultAddress} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-void-dim">{label}</div>
      <div className="mt-1 font-mono text-sm text-void-text">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-void-dim">{sub}</div>}
    </div>
  );
}

function ShareLink({ vaultAddress }: { vaultAddress: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      className="text-void-muted underline decoration-void-border underline-offset-2 hover:text-void-text"
      onClick={async () => {
        setState((await copyText(`${window.location.origin}/vaults/${vaultAddress}`)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "ok" ? "Link copied" : state === "fail" ? "Copy blocked by the browser" : "Copy share link"}
    </button>
  );
}

function StepDot({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border font-mono text-xs transition ${
        done
          ? "border-void-success bg-void-successDim text-void-success"
          : active
            ? "border-void-cta bg-void-cta/15 text-void-cta"
            : "border-void-borderStrong text-void-dim"
      }`}
    >
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        n
      )}
    </span>
  );
}

function maskKey(k: string) {
  return `${k.slice(0, 6)}${"•".repeat(24)}${k.slice(-4)}`;
}

function NextSteps({
  vaultAddress,
  sessionKey,
  instructions,
  keySaved,
  onKeySaved,
  fund,
  network,
  onSimulate,
}: {
  vaultAddress: string;
  sessionKey: string;
  instructions: string;
  keySaved: boolean;
  onKeySaved: () => void;
  fund: (wei: string) => Promise<{ txHash: string }>;
  network: NetworkConfig;
  onSimulate: () => void;
}) {
  const [amount, setAmount] = useState("0.006");
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState<{ tx: string; eth: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [instrState, setInstrState] = useState<"idle" | "ok" | "fail">("idle");

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= FUND_CAP_ETH;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fund(ethToWei(amount));
      setFunded({ tx: res.txHash, eth: amount });
    } catch {
      setError("Funding failed. Check the amount and the relayer balance, then try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    const ok = await copyText(sessionKey);
    setCopyState(ok ? "ok" : "fail");
    if (ok) onKeySaved();
    else setRevealed(true);
    setTimeout(() => setCopyState("idle"), 2200);
  }

  async function copyInstructions() {
    const ok = await copyText(instructions);
    setInstrState(ok ? "ok" : "fail");
    if (ok) onKeySaved();
    setTimeout(() => setInstrState("idle"), 2200);
  }

  return (
    <Card className="divide-y divide-void-border overflow-hidden">
      <div className="flex gap-4 p-5">
        <StepDot n={1} done={!!funded} active={!funded} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Fund the vault</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            The agent pays gas from the vault, so give it a little. On mainnet you would send ETH from your own wallet to{" "}
            <span className="font-mono text-void-text">{truncateAddress(vaultAddress)}</span>.
          </p>
          <div aria-live="polite">
            {funded ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-void-success">
                <span className="font-mono">{funded.eth} ETH in the vault</span>
                <span className="text-void-dim">·</span>
                <a
                  href={explorerTxUrl(network, funded.tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-void-accent underline decoration-void-accentDim underline-offset-2"
                >
                  tx {truncateAddress(funded.tx)} ↗
                </a>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  aria-label="Amount of test ETH to send"
                  className="w-28 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
                />
                <span className="text-xs text-void-dim">ETH</span>
                <SecondaryButton type="button" disabled={busy || !amountValid} onClick={send}>
                  {busy ? "Sending…" : "Send test ETH"}
                </SecondaryButton>
              </div>
            )}
            {!funded && amount !== "" && !amountValid && (
              <p className="mt-2 text-xs text-void-warn">Demo funding takes 0 to {FUND_CAP_ETH} ETH.</p>
            )}
            {error && <p className="mt-2 text-xs text-void-danger">{error}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-void-warn/20 bg-void-warnDim/10 p-5">
        <StepDot n={2} done={keySaved} active={!!funded && !keySaved} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Hand the agent its key</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            Shown once, never stored. It signs for this vault but never outside the policy. Lose it and the session
            simply stops. Your funds stay yours.
          </p>
          <div className="mt-3 flex items-start gap-2">
            <code
              className={`min-w-0 flex-1 rounded-sm border border-void-warn/30 bg-void-raised px-3 py-2 font-mono text-xs text-void-text ${
                revealed ? "break-all" : "truncate"
              }`}
            >
              {revealed ? sessionKey : maskKey(sessionKey)}
            </code>
            <SecondaryButton type="button" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed}>
              {revealed ? "Hide" : "Reveal"}
            </SecondaryButton>
            <SecondaryButton type="button" onClick={copyKey}>
              {copyState === "ok" ? "Copied" : copyState === "fail" ? "Failed" : "Copy"}
            </SecondaryButton>
          </div>
          {copyState === "fail" && (
            <p role="alert" className="mt-2 text-xs text-void-warn">
              The browser blocked copying. The key is revealed above: select it and copy it by hand.
            </p>
          )}
          <SecondaryButton type="button" onClick={copyInstructions} className="mt-2 w-full">
            {instrState === "ok" ? "Instructions copied" : instrState === "fail" ? "Copy blocked by the browser" : "Copy agent instructions"}
          </SecondaryButton>
        </div>
      </div>

      <div className="flex gap-4 p-5">
        <StepDot n={3} done={false} active={!!funded && keySaved} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Watch it get rejected</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            Open the console as the agent and try something the policy never allowed. The contract says no, on-chain.
          </p>
          <Link href={`/vaults/${vaultAddress}#console`} onClick={onSimulate} className="mt-3 block">
            <PrimaryButton type="button" className="w-full py-3 text-base">
              Simulate a rejected action →
            </PrimaryButton>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function buildAgentInstructions(p: {
  network: NetworkConfig;
  vaultAddress: string;
  sessionKey: string;
  expiresAt: number;
  policy: SealedPolicy;
}): string {
  const body = JSON.stringify({
    vaultAddress: p.vaultAddress,
    sessionPrivateKey: p.sessionKey,
    target: p.policy.allowedTarget ?? "0x...",
    value: "0",
    calldata: "0x",
  });
  return [
    `VOID session vault on ${p.network.name} (chain ${p.network.chainId})`,
    ``,
    `Vault:        ${p.vaultAddress}`,
    `Session key:  ${p.sessionKey}  (secret, never share it)`,
    `API:          ${p.network.apiUrl}`,
    `Policy:       ${p.policy.budgetEth} ETH cap, ${p.policy.maxTx} tx max, expires ${new Date(p.expiresAt * 1000).toISOString()}`,
    `Pre-approved: ${p.policy.allowedTarget ? `${p.policy.allowedTarget} ${p.policy.allowedSignature ?? ""}`.trim() : "none"}`,
    ``,
    `Dry run (read only, replays the contract's own validation):`,
    `curl -X POST ${p.network.apiUrl}/agent/simulate -H 'Content-Type: application/json' -d '${body}'`,
    ``,
    `Execute for real: same body, POST ${p.network.apiUrl}/agent/execute`,
    ``,
    `Anything outside the policy is rejected on-chain by PolicyValidator.`,
  ].join("\n");
}
