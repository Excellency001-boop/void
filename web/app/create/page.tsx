"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress, toFunctionSelector, type Hex } from "viem";
import { ApiError, type CreateVaultResult } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { explorerAddressUrl } from "@/lib/networks";
import { ethToWei, formatTimestamp, truncateAddress } from "@/lib/format";
import { GateStrip, type GateArm } from "@/components/GateStrip";
import { PerimeterRing } from "@/components/PerimeterRing";
import { VaultSeal } from "@/components/VaultSeal";
import { Card, PrimaryButton, SecondaryButton, Label, BackLink, TxLink, CopyButton } from "@/components/ui";

/// A deliberately not-whitelisted address — clicking the post-deploy "simulate a rejection" CTA
/// pre-fills this as the target so the very first click produces a real on-chain rejection, not an
/// empty form the user has to figure out what to type into.
const UNAUTHORIZED_DEMO_TARGET = "0x00000000000000000000000000000000deadbeef";

const DURATIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
];

export default function CreateVaultPage() {
  const { address } = useAccount();
  const { api, network } = useNetwork();

  const [owner, setOwner] = useState("");
  const [duration, setDuration] = useState(86400);
  const [budgetEth, setBudgetEth] = useState("0.01");
  const [maxTx, setMaxTx] = useState(5);
  const [allowedTarget, setAllowedTarget] = useState("");
  const [allowedSignature, setAllowedSignature] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVaultResult | null>(null);
  const [deployedAt, setDeployedAt] = useState(0);

  const ownerValue = owner || address || "";
  const ownerValid = isAddress(ownerValue);
  const targetProvided = allowedTarget.trim().length > 0 || allowedSignature.trim().length > 0;
  const targetValid = !targetProvided || (isAddress(allowedTarget) && allowedSignature.trim().length > 0);

  let selectorPreview: Hex | null = null;
  let selectorError: string | null = null;
  if (allowedSignature.trim()) {
    try {
      selectorPreview = toFunctionSelector(allowedSignature.trim());
    } catch {
      selectorError = "Not a valid function signature, e.g. transfer(address,uint256)";
    }
  }

  const canSubmit = ownerValid && targetValid && !selectorError && Number(budgetEth) > 0 && maxTx > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createVault({
        ownerAddress: ownerValue,
        sessionDurationSeconds: duration,
        nativeSpendCapWei: ethToWei(budgetEth),
        maxTxCount: maxTx,
        initialTarget: targetProvided ? (allowedTarget as `0x${string}`) : undefined,
        initialSelector: targetProvided ? selectorPreview ?? undefined : undefined,
      });
      setDeployedAt(Math.floor(Date.now() / 1000));
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong deploying the vault.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const simulateHref = `/vaults/${result.vaultAddress}?sessionKey=${result.sessionPrivateKey}&target=${UNAUTHORIZED_DEMO_TARGET}#console`;
    const durationLabel = DURATIONS.find((d) => d.seconds === duration)?.label ?? `${duration}s`;
    const expiresAt = deployedAt + duration;
    const explorerUrl = explorerAddressUrl(network, result.vaultAddress);
    const instructions = buildAgentInstructions({
      networkName: network.name,
      chainId: network.chainId,
      apiUrl: network.apiUrl,
      vaultAddress: result.vaultAddress,
      sessionKey: result.sessionPrivateKey,
      budgetEth,
      maxTx,
      expiresAt,
      allowedTarget: targetProvided ? allowedTarget : undefined,
      allowedSignature: targetProvided ? allowedSignature.trim() : undefined,
    });

    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="pointer-events-none fixed inset-0 z-40 animate-flash bg-[radial-gradient(circle_at_50%_24%,rgba(52,211,153,0.4),transparent_58%)] motion-reduce:hidden" />
        <div>
          <BackLink href="/">Back to vaults</BackLink>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <VaultSeal />
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-void-success">Policy sealed</span>
          <h1 className="text-5xl font-extrabold leading-none tracking-[-0.045em] text-void-text">
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
              <span className="flex-1 break-all font-mono text-[15px] leading-snug text-void-text">{result.vaultAddress}</span>
              <CopyButton value={result.vaultAddress} className="mt-0.5" />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-void-border border-t border-void-border">
            <SummaryStat label="Spend cap" value={`${budgetEth} ETH`} />
            <SummaryStat label="Max transactions" value={String(maxTx)} />
            <SummaryStat label="Expires in" value={durationLabel} sub={formatTimestamp(expiresAt)} />
          </div>
          <div className="border-t border-void-border px-5 py-3 text-xs text-void-muted">
            {targetProvided ? (
              <>
                Pre-approved: <span className="font-mono text-void-text">{truncateAddress(allowedTarget)}</span>{" "}
                <span className="font-mono text-void-dim">{allowedSignature.trim()}</span>
              </>
            ) : (
              "No pre-approved calls. Everything the agent tries will be rejected until you add one."
            )}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-void-cta">Next, three steps</span>
          <span className="h-px flex-1 bg-gradient-to-r from-void-borderStrong to-transparent" />
        </div>

        <NextSteps
          vaultAddress={result.vaultAddress}
          sessionKey={result.sessionPrivateKey}
          instructions={instructions}
          simulateHref={simulateHref}
          fund={(wei) => api.depositToVault(result.vaultAddress, wei)}
        />

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="flex-1">
              <SecondaryButton type="button" className="w-full">
                View on explorer ↗
              </SecondaryButton>
            </a>
            <Link href={`/vaults/${result.vaultAddress}`} className="flex-1">
              <SecondaryButton type="button" className="w-full">
                Open vault
              </SecondaryButton>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-void-dim">
            <TxLink hash={result.deployTxHash} label="deployment tx" />
            <span>·</span>
            <ShareLinkButton vaultAddress={result.vaultAddress} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <BackLink href="/">Back to vaults</BackLink>
      </div>

      <div className="max-w-2xl">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-void-cta">New session vault</span>
        <h1 className="mt-3 text-5xl font-extrabold leading-[1.0] tracking-[-0.045em] text-void-text">
          Write the rules.{" "}
          <span className="font-serif text-[1.14em] font-normal italic tracking-[-0.02em] text-void-muted">
            The contract keeps them.
          </span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-void-muted">
          Define the policy once. It is compiled into the vault&apos;s on-chain validator, and the agent that
          receives the session key cannot produce a valid signature for anything outside it.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <Label className="mb-2.5">Policy</Label>
          <Card className="flex flex-col gap-4 p-5 transition duration-300 focus-within:border-void-accent/40 focus-within:shadow-[0_0_60px_-26px_rgba(108,99,255,0.7)]">
          <div>
            <Label>Owner address</Label>
            <div className="mt-1 flex gap-2">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={address ?? "0x…"}
                className="flex-1 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
              />
              {address && (
                <SecondaryButton type="button" onClick={() => setOwner(address)}>
                  Use connected
                </SecondaryButton>
              )}
            </div>
            <p className="mt-1 text-xs text-void-dim">
              Keeps full control via its own root key. The session key can never exceed this
              policy.
            </p>
          </div>

          <div className="border-t border-void-border pt-4">
            <Label>Session duration</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.seconds}
                  type="button"
                  onClick={() => setDuration(d.seconds)}
                  className={`rounded-sm border px-3 py-1.5 text-xs ${
                    duration === d.seconds
                      ? "border-void-accent/50 bg-void-accentDim/30 text-void-accent"
                      : "border-void-border bg-void-raised text-void-muted hover:border-void-borderStrong"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-void-border pt-4">
            <div>
              <Label>Native spend cap (ETH)</Label>
              <input
                value={budgetEth}
                onChange={(e) => setBudgetEth(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-sm text-void-text focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
              />
            </div>
            <div>
              <Label>Max transactions</Label>
              <input
                value={maxTx}
                onChange={(e) => setMaxTx(Number(e.target.value) || 0)}
                type="number"
                min={1}
                className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-sm text-void-text focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
              />
            </div>
          </div>
          </Card>
        </div>

        <div>
          <Label className="mb-2.5">First permission (optional)</Label>
          <Card className="flex flex-col gap-4 p-5 transition duration-300 focus-within:border-void-accent/40 focus-within:shadow-[0_0_60px_-26px_rgba(108,99,255,0.7)]">
          <p className="text-xs text-void-dim">
            One contract + function the agent can call immediately, installed atomically with the
            policy. Add more permissions later.
          </p>
          <div>
            <Label>Contract address</Label>
            <input
              value={allowedTarget}
              onChange={(e) => setAllowedTarget(e.target.value)}
              placeholder="0x…"
              className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
            />
          </div>
          <div>
            <Label>Function signature</Label>
            <input
              value={allowedSignature}
              onChange={(e) => setAllowedSignature(e.target.value)}
              placeholder="transfer(address,uint256)"
              className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
            />
            {selectorError && <p className="mt-1 text-xs text-void-danger">{selectorError}</p>}
            {selectorPreview && !selectorError && (
              <p className="mt-1 text-xs text-void-dim">
                Selector: <span className="font-mono text-void-muted">{selectorPreview}</span>
              </p>
            )}
          </div>
          </Card>
        </div>

        {error && (
          <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 px-4 py-3 text-sm text-void-danger">
            {error}
          </div>
        )}

        <PrimaryButton type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Deploying…" : "Deploy Session Vault"}
        </PrimaryButton>
      </form>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <PolicyPreview
          armed={canSubmit}
          ownerOk={ownerValid}
          limitsOk={Number(budgetEth) > 0 && maxTx > 0}
          permissionOk={targetProvided && targetValid && !selectorError}
          budgetEth={budgetEth}
          maxTx={maxTx}
          durationLabel={DURATIONS.find((d) => d.seconds === duration)?.label ?? ""}
          target={targetProvided && targetValid ? allowedTarget : ""}
          signature={allowedSignature.trim()}
        />
      </aside>
      </div>
    </div>
  );
}

function PolicyPreview({
  armed,
  ownerOk,
  limitsOk,
  permissionOk,
  budgetEth,
  maxTx,
  durationLabel,
  target,
  signature,
}: {
  armed: boolean;
  ownerOk: boolean;
  limitsOk: boolean;
  permissionOk: boolean;
  budgetEth: string;
  maxTx: number;
  durationLabel: string;
  target: string;
  signature: string;
}) {
  const progress = (ownerOk ? 0.4 : 0) + (limitsOk ? 0.3 : 0) + (permissionOk ? 0.3 : 0);
  const states: GateArm[] = armed ? ["armed", "armed", "armed", "armed", "armed"] : ["off", "off", "off", "off", "off"];
  return (
    <div
      className={`overflow-hidden rounded-sm border transition duration-500 ${
        armed
          ? "border-void-accent/40 bg-void-surface shadow-[0_0_80px_-24px_rgba(108,99,255,0.8)]"
          : "border-void-border bg-void-surface/70"
      }`}
    >
      <div className="flex items-center justify-between border-b border-void-border px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-void-dim">Policy perimeter</span>
        <span className={`font-mono text-[11px] ${armed ? "text-void-success" : "text-void-dim"}`}>
          {Math.round(progress * 100)}% closed
        </span>
      </div>
      <div className="relative flex flex-col items-center px-5 pb-2 pt-6">
        <span className="pointer-events-none absolute left-1/2 top-4 -z-0 h-32 w-32 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(108,99,255,0.35),transparent)] blur-2xl" />
        <div className="relative">
          <PerimeterRing progress={progress} size={150} state="building" duration={0.7} />
        </div>
        <div className="mt-4 w-full">
          <GateStrip states={states} />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5 py-5 font-mono text-xs">
        <PreviewRow k="Spend cap" v={`${Number(budgetEth) > 0 ? budgetEth : "0"} ETH`} />
        <PreviewRow k="Transactions" v={`${maxTx || 0} max`} />
        <PreviewRow k="Session" v={durationLabel} />
        <PreviewRow k="Pre-approved" v={target ? `${truncateAddress(target)}` : "none"} />
        {signature && target && <PreviewRow k="Function" v={signature} />}
      </div>
      <div className="border-t border-void-border px-5 py-3 text-xs leading-relaxed text-void-muted">
        {permissionOk
          ? "Everything outside this is rejected on-chain, in the same fixed order, every time."
          : "With no pre-approved call, the agent can do nothing at all until you add one."}
      </div>
    </div>
  );
}

function PreviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-void-dim">{k}</span>
      <span className="truncate text-right text-void-text">{v}</span>
    </div>
  );
}

function CopyTextButton({
  text,
  label,
  copiedLabel,
  className = "",
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <SecondaryButton
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? copiedLabel : label}
    </SecondaryButton>
  );
}

function ShareLinkButton({ vaultAddress }: { vaultAddress: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-void-muted underline decoration-void-border underline-offset-2 hover:text-void-text"
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/vaults/${vaultAddress}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Link copied" : "Copy share link"}
    </button>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-void-dim">{label}</div>
      <div className="mt-1 font-mono text-sm text-void-text">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-void-dim">{sub}</div>}
    </div>
  );
}

function buildAgentInstructions(p: {
  networkName: string;
  chainId: number;
  apiUrl: string;
  vaultAddress: string;
  sessionKey: string;
  budgetEth: string;
  maxTx: number;
  expiresAt: number;
  allowedTarget?: string;
  allowedSignature?: string;
}): string {
  const body = JSON.stringify({
    vaultAddress: p.vaultAddress,
    sessionPrivateKey: p.sessionKey,
    target: p.allowedTarget ?? "0x...",
    value: "0",
    calldata: "0x",
  });
  return [
    `VOID session vault on ${p.networkName} (chain ${p.chainId})`,
    ``,
    `Vault:        ${p.vaultAddress}`,
    `Session key:  ${p.sessionKey}  (secret, never share it)`,
    `API:          ${p.apiUrl}`,
    `Policy:       ${p.budgetEth} ETH cap, ${p.maxTx} tx max, expires ${new Date(p.expiresAt * 1000).toISOString()}`,
    `Pre-approved: ${p.allowedTarget ? `${p.allowedTarget} ${p.allowedSignature ?? ""}`.trim() : "none"}`,
    ``,
    `Dry run (read only, replays the contract's own validation):`,
    `curl -X POST ${p.apiUrl}/agent/simulate -H 'Content-Type: application/json' -d '${body}'`,
    ``,
    `Execute for real: same body, POST ${p.apiUrl}/agent/execute`,
    ``,
    `Anything outside the policy is rejected on-chain by PolicyValidator.`,
  ].join("\n");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2 rounded-sm border border-void-border bg-void-raised px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-void-text">{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
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

function NextSteps({
  vaultAddress,
  sessionKey,
  instructions,
  simulateHref,
  fund,
}: {
  vaultAddress: string;
  sessionKey: string;
  instructions: string;
  simulateHref: string;
  fund: (wei: string) => Promise<{ txHash: string }>;
}) {
  const [amount, setAmount] = useState("0.006");
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fund(ethToWei(amount));
      setFunded(res.txHash);
    } catch {
      setError("Couldn't send that. Check the amount and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="divide-y divide-void-border overflow-hidden">
      <div className="flex gap-4 p-5">
        <StepDot n={1} done={!!funded} active={!funded} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Fund the vault</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            The agent pays gas from the vault, so give it a little. On mainnet you would send ETH from your own
            wallet to <span className="font-mono text-void-text">{truncateAddress(vaultAddress)}</span>.
          </p>
          {funded ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-void-success">
              <span className="font-mono">{amount} ETH in the vault</span>
              <span className="text-void-dim">·</span>
              <TxLink hash={funded} label="tx" />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-28 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
              />
              <span className="text-xs text-void-dim">ETH</span>
              <SecondaryButton type="button" disabled={busy || !(Number(amount) > 0)} onClick={send}>
                {busy ? "Sending…" : "Send test ETH"}
              </SecondaryButton>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-void-danger">{error}</p>}
        </div>
      </div>

      <div className="flex gap-4 border-void-warn/20 bg-void-warnDim/10 p-5">
        <StepDot n={2} done={keyCopied} active={!!funded && !keyCopied} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Hand the agent its key</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            Shown once, never stored. It can sign for this vault but never outside the policy. Lose it and the
            session simply stops. Your funds stay yours.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm border border-void-warn/30 bg-void-raised px-3 py-2 font-mono text-xs text-void-text">
              {sessionKey}
            </code>
            <SecondaryButton
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sessionKey);
                setKeyCopied(true);
              }}
            >
              {keyCopied ? "Copied" : "Copy"}
            </SecondaryButton>
          </div>
          <CopyTextButton text={instructions} label="Copy agent instructions" copiedLabel="Instructions copied" className="mt-2 w-full" />
        </div>
      </div>

      <div className="flex gap-4 p-5">
        <StepDot n={3} done={false} active={!!funded && keyCopied} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-void-text">Watch it get rejected</div>
          <p className="mt-1 text-xs leading-relaxed text-void-muted">
            Open the console as the agent and try something the policy never allowed. The contract says no, on-chain.
          </p>
          <Link href={simulateHref} className="mt-3 block">
            <PrimaryButton className="w-full py-3 text-base">Simulate a rejected action →</PrimaryButton>
          </Link>
        </div>
      </div>
    </Card>
  );
}
