import Link from "next/link";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import { truncateAddress } from "@/lib/format";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-void-border bg-void-surface ${className}`}>{children}</div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-void-border px-4 py-3">
      {children}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider text-void-dim">{children}</div>;
}

export function AddressLink({ address, chars = 4 }: { address: string; chars?: number }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-void-text underline decoration-void-border underline-offset-2 hover:decoration-void-accent"
    >
      {truncateAddress(address, chars)}
    </a>
  );
}

export function TxLink({ hash, label = "tx" }: { hash: string; label?: string }) {
  return (
    <a
      href={explorerTxUrl(hash)}
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
  active: "border-void-accent/40 bg-void-accentDim/30 text-void-accent",
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
    tone === "revoked" ? "bg-void-danger" : tone === "warn" ? "bg-void-warn" : "bg-void-accent";
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
      className={`rounded-sm bg-void-accent px-4 py-2 text-sm font-medium text-void-bg transition hover:bg-void-accent/90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
      className={`rounded-sm border border-void-danger/50 bg-void-dangerDim/20 px-4 py-2 text-sm font-medium text-void-danger transition hover:bg-void-dangerDim/40 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
      className={`rounded-sm border border-void-border bg-void-raised px-4 py-2 text-sm font-medium text-void-text transition hover:border-void-borderStrong disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
