"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { isAddress, toFunctionSelector, type Hex } from "viem";
import { api, ApiError, type CreateVaultResult } from "@/lib/api";
import { ethToWei } from "@/lib/format";
import { Card, PrimaryButton, SecondaryButton, Label, BackLink, TxLink, CopyButton } from "@/components/ui";

const DURATIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
];

export default function CreateVaultPage() {
  const { address } = useAccount();

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
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <BackLink href="/">Back to vaults</BackLink>
        </div>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-void-accent">Session Vault deployed</h2>
          <p className="mt-1 text-sm text-void-muted">
            Real transaction, real contract, live on-chain now.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <Field label="Vault address" value={result.vaultAddress} />
            <Field label="Session key address" value={result.sessionKeyAddress} />

            <div>
              <Label>Session private key — shown once</Label>
              <p className="mt-1 text-xs text-void-warn">
                This API does not store this key anywhere. Copy it now and hand it to your agent —
                if you lose it, the session can no longer act (you can still force-revoke and your
                funds are untouched either way).
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-sm border border-void-warn/30 bg-void-warnDim/10 px-3 py-2 font-mono text-xs text-void-text">
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
            </div>

            <div className="text-xs text-void-muted">
              Deployment: <TxLink hash={result.deployTxHash} />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link href={`/vaults/${result.vaultAddress}`}>
              <PrimaryButton>Go to vault</PrimaryButton>
            </Link>
            <Link href="/">
              <SecondaryButton type="button">Back home</SecondaryButton>
            </Link>
          </div>
        </Card>
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
              Retains full control at all times via its own root key — force-revoke, withdraw,
              reconfigure. The session key can never do more than this policy allows.
            </p>
          </div>

          <div>
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

          <div className="grid grid-cols-2 gap-4">
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

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <Label>Initial permission (optional but recommended)</Label>
            <p className="mt-1 text-xs text-void-dim">
              One contract + function the agent can call from its very first action. Kernel
              installs the policy and authorizes this in the same transaction — see the README for
              why that atomicity matters. You can grant more permissions later.
            </p>
          </div>
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
