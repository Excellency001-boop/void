"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress, toFunctionSelector, type Hex } from "viem";
import { ApiError, type ApiClient } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import type { NetworkConfig } from "@/lib/networks";
import { ethToWei, truncateAddress } from "@/lib/format";
import { GateStrip, type GateArm } from "@/components/GateStrip";
import { PerimeterRing } from "@/components/PerimeterRing";
import { SealedScreen, type SealedPolicy } from "@/components/SealedScreen";
import { Card, PrimaryButton, SecondaryButton, Label, BackLink } from "@/components/ui";

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
  const [sealed, setSealed] = useState<{
    vaultAddress: string;
    sessionKey: string;
    deployTxHash: string;
    network: NetworkConfig;
    api: ApiClient;
    policy: SealedPolicy;
  } | null>(null);

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
    // Pin the chain at click time: the header switcher can change while the transaction is pending.
    const pinnedNetwork = network;
    const pinnedApi = api;
    try {
      const res = await pinnedApi.createVault({
        ownerAddress: ownerValue,
        sessionDurationSeconds: duration,
        nativeSpendCapWei: ethToWei(budgetEth),
        maxTxCount: maxTx,
        initialTarget: targetProvided ? (allowedTarget as `0x${string}`) : undefined,
        initialSelector: targetProvided ? selectorPreview ?? undefined : undefined,
      });
      setSealed({
        vaultAddress: res.vaultAddress,
        sessionKey: res.sessionPrivateKey,
        deployTxHash: res.deployTxHash,
        network: pinnedNetwork,
        api: pinnedApi,
        policy: {
          budgetEth,
          maxTx,
          durationSeconds: duration,
          durationLabel: DURATIONS.find((d) => d.seconds === duration)?.label ?? `${duration}s`,
          deployedAt: Math.floor(Date.now() / 1000),
          allowedTarget: targetProvided ? allowedTarget : undefined,
          allowedSignature: targetProvided ? allowedSignature.trim() : undefined,
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? `Deployment failed. Nothing was sealed. Reason: ${err.message}.` : "Deployment failed. Nothing was sealed. Check the owner address and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sealed) {
    return (
      <SealedScreen
        vaultAddress={sealed.vaultAddress}
        sessionKey={sealed.sessionKey}
        deployTxHash={sealed.deployTxHash}
        network={sealed.network}
        api={sealed.api}
        policy={sealed.policy}
      />
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

        <PrimaryButton type="submit" disabled={!canSubmit || submitting} className="py-3.5 text-base">
          {submitting ? "Sealing the perimeter…" : "Seal this policy on-chain"}
        </PrimaryButton>
        <p className="-mt-3 text-center font-mono text-[11px] text-void-dim">
          One transaction. Policy and permissions install together, so there is no unguarded moment.
        </p>
      </form>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <PolicyPreview
          armed={canSubmit}
          ownerOk={ownerValid}
          sealing={submitting}
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

const SEAL_STEPS = [
  "Compiling the policy",
  "Deploying the smart account",
  "Installing the validator",
  "Arming five gates",
];

function PolicyPreview({
  armed,
  sealing,
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
  sealing: boolean;
  ownerOk: boolean;
  limitsOk: boolean;
  permissionOk: boolean;
  budgetEth: string;
  maxTx: number;
  durationLabel: string;
  target: string;
  signature: string;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!sealing) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((n) => Math.min(n + 1, SEAL_STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [sealing]);
  const progress = sealing ? 1 : (ownerOk ? 0.4 : 0) + (limitsOk ? 0.3 : 0) + (permissionOk ? 0.3 : 0);
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
          {sealing ? "sealing" : `${Math.round(progress * 100)}% closed`}
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
      {sealing ? (
        <div className="flex flex-col gap-2.5 px-5 py-5 font-mono text-xs">
          {SEAL_STEPS.map((label, i) => (
            <div key={label} className={`flex items-center gap-2.5 transition ${i <= step ? "text-void-text" : "text-void-dim/50"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-void-success" : i === step ? "animate-pulse bg-void-cta" : "bg-void-border"}`} />
              {label}
            </div>
          ))}
        </div>
      ) : (
      <div className="flex flex-col gap-3 px-5 py-5 font-mono text-xs">
        <PreviewRow k="Spend cap" v={`${Number(budgetEth) > 0 ? budgetEth : "0"} ETH`} />
        <PreviewRow k="Transactions" v={`${maxTx || 0} max`} />
        <PreviewRow k="Session" v={durationLabel} />
        <PreviewRow k="Pre-approved" v={target ? `${truncateAddress(target)}` : "none"} />
        {signature && target && <PreviewRow k="Function" v={signature} />}
      </div>
      )}
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
