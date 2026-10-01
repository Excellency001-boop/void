"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress, toFunctionSelector, type Hex } from "viem";
import { ApiError, type CreateVaultResult } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { explorerAddressUrl } from "@/lib/networks";
import { ethToWei } from "@/lib/format";
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
  const [copied, setCopied] = useState(false);

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
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong deploying the vault.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const simulateHref = `/vaults/${result.vaultAddress}?sessionKey=${result.sessionPrivateKey}&target=${UNAUTHORIZED_DEMO_TARGET}#console`;

    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <BackLink href="/">Back to vaults</BackLink>
        </div>

        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-void-successDim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-void-success">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-void-text">Session vault deployed</h1>
            <p className="mt-1 text-sm text-void-muted">
              Live on-chain now. The policy you just set is enforced by the contract, not by any
              app — including this one.
            </p>
          </div>
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <Field label="Vault address" value={result.vaultAddress} />
          <div className="text-xs">
            <a
              href={explorerAddressUrl(network, result.vaultAddress)}
              target="_blank"
              rel="noreferrer"
              className="text-void-accent underline decoration-void-accentDim underline-offset-2 hover:decoration-void-accent"
            >
              View on {network.name} explorer ↗
            </a>
            <span className="mx-2 text-void-dim">·</span>
            <TxLink hash={result.deployTxHash} label="deployment tx" />
          </div>
        </Card>

        <Card className="flex flex-col gap-3 border-void-warn/25 bg-void-warnDim/10 p-5">
          <div>
            <Label>Session private key — shown once, never stored</Label>
            <p className="mt-1.5 text-xs leading-relaxed text-void-muted">
              Give this to your agent. It signs with this key, but can never produce a valid
              signature for anything outside the policy above — the contract rejects it, not your
              code. Copy it now; if it's lost, force-revoke still works and your funds are
              untouched either way.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-sm border border-void-warn/30 bg-void-raised px-3 py-2 font-mono text-xs text-void-text">
              {result.sessionPrivateKey}
            </code>
            <SecondaryButton
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(result.sessionPrivateKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </SecondaryButton>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Link href={simulateHref}>
            <PrimaryButton className="w-full">Simulate a rejected action →</PrimaryButton>
          </Link>
          <div className="flex gap-3">
            <Link href={`/vaults/${result.vaultAddress}`} className="flex-1">
              <SecondaryButton type="button" className="w-full">
                View vault
              </SecondaryButton>
            </Link>
            <ShareLinkButton vaultAddress={result.vaultAddress} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <BackLink href="/">Back to vaults</BackLink>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-void-text">New Session Vault</h1>
        <p className="mt-1 text-sm text-void-muted">
          Define the policy once. It's compiled into the vault's on-chain validator — the agent
          that receives the session key literally cannot produce a valid signature for anything
          outside it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <Label className="mb-2.5">Policy</Label>
          <Card className="flex flex-col gap-4 p-5">
          <div>
            <Label>Owner address</Label>
            <div className="mt-1 flex gap-2">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={address ?? "0x…"}
                className="flex-1 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
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
                className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-sm text-void-text focus:border-void-borderStrong focus:outline-none"
              />
            </div>
            <div>
              <Label>Max transactions</Label>
              <input
                value={maxTx}
                onChange={(e) => setMaxTx(Number(e.target.value) || 0)}
                type="number"
                min={1}
                className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-sm text-void-text focus:border-void-borderStrong focus:outline-none"
              />
            </div>
          </div>
          </Card>
        </div>

        <div>
          <Label className="mb-2.5">First permission (optional)</Label>
          <Card className="flex flex-col gap-4 p-5">
          <p className="text-xs text-void-dim">
            One contract + function the agent can call immediately — installed atomically with the
            policy. Add more permissions later.
          </p>
          <div>
            <Label>Contract address</Label>
            <input
              value={allowedTarget}
              onChange={(e) => setAllowedTarget(e.target.value)}
              placeholder="0x…"
              className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
            />
          </div>
          <div>
            <Label>Function signature</Label>
            <input
              value={allowedSignature}
              onChange={(e) => setAllowedSignature(e.target.value)}
              placeholder="transfer(address,uint256)"
              className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
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
    </div>
  );
}

function ShareLinkButton({ vaultAddress }: { vaultAddress: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <SecondaryButton
      type="button"
      className="flex-1"
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/vaults/${vaultAddress}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Link copied" : "Copy share link"}
    </SecondaryButton>
  );
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
