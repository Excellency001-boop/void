"use client";

import { useState } from "react";
import Link from "next/link";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/networks";
import { useNetwork } from "@/lib/network-context";
import { truncateAddress } from "@/lib/format";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-void-border bg-void-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_-14px_rgba(0,0,0,0.8)] ${className}`}>{children}</div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-void-border px-4 py-3">
      {children}
    </div>
  );
}

export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] uppercase tracking-wider text-void-dim ${className}`}>{children}</div>;
}

export function AddressLink({ address, chars = 4 }: { address: string; chars?: number }) {
  const { network } = useNetwork();
  return (
    <a
      href={explorerAddressUrl(network, address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-void-text underline decoration-void-border underline-offset-2 hover:decoration-void-accent"
    >
      {truncateAddress(address, chars)}
    </a>
  );
}

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy to clipboard"
      className={`text-void-dim hover:text-void-text ${className}`}
    >
      {copied ? (
        <span className="text-[10px] text-void-success">copied</span>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="1.5" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      )}
    </button>
  );
}

export function CopyableAddress({
  address,
  chars = 4,
  className = "",
}: {
  address: string;
  chars?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <AddressLink address={address} chars={chars} />
      <CopyButton value={address} />
    </span>
  );
}

export function TxLink({ hash, label = "tx" }: { hash: string; label?: string }) {
  const { network } = useNetwork();
  return (
    <a
      href={explorerTxUrl(network, hash)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-void-accent underline decoration-void-accentDim underline-offset-2 hover:decoration-void-accent"
    >
      {label} {truncateAddress(hash)} ↗
    </a>
  );
}

type BadgeTone = "active" | "revoked" | "expired" | "warn" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  active: "border-void-success/70 bg-void-successDim/70 text-void-success shadow-[0_0_16px_-4px_rgba(52,211,153,0.7)]",
  revoked: "border-void-danger/40 bg-void-dangerDim/30 text-void-danger",
  expired: "border-void-dim/40 bg-void-raised text-void-dim",
  warn: "border-void-warn/40 bg-void-warnDim/30 text-void-warn",
  neutral: "border-void-border bg-void-raised text-void-muted",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function BudgetBar({ pct, tone = "active" }: { pct: number; tone?: BadgeTone }) {
  const barColor =
    tone === "revoked" ? "bg-void-danger" : tone === "warn" ? "bg-void-warn" : "bg-void-success";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-void-raised">
      <div
        className={`h-full rounded-full ${barColor} transition-all`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-sm bg-void-cta px-4 py-2 text-sm font-semibold text-void-bg shadow-[0_0_0_1px_rgba(255,107,44,0.35),0_10px_28px_-10px_rgba(255,107,44,0.55)] transition duration-150 hover:-translate-y-px hover:bg-void-ctaHover hover:shadow-[0_0_0_1px_rgba(255,130,71,0.6),0_14px_34px_-10px_rgba(255,107,44,0.75)] active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-sm border border-void-danger/50 bg-void-dangerDim/20 px-4 py-2 text-sm font-medium text-void-danger transition duration-150 hover:bg-void-dangerDim/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-sm border border-void-border bg-void-raised px-4 py-2 text-sm font-medium text-void-text transition duration-150 hover:-translate-y-px hover:border-void-borderStrong active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs text-void-muted hover:text-void-text">
      ← {children}
    </Link>
  );
}
