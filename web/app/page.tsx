"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isAddress } from "viem";
import { useNetwork } from "@/lib/network-context";
import { PrimaryButton, SecondaryButton, Label } from "@/components/ui";
import { PipelineDemo } from "@/components/PipelineDemo";
import { VaultCard } from "@/components/VaultCard";
import { HeroDiagram } from "@/components/HeroDiagram";

export default function HomePage() {
  const router = useRouter();
  const [jumpAddress, setJumpAddress] = useState("");
  const { network, api } = useNetwork();

  const vaultsQuery = useQuery({
    queryKey: ["vaults", network.id],
    queryFn: api.listVaults,
    refetchInterval: 15_000,
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const sortedVaults = [...(vaultsQuery.data ?? [])].sort((a, b) => {
    const aLive = a.policy.validUntil > nowSec ? 1 : 0;
    const bLive = b.policy.validUntil > nowSec ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const allEnded = sortedVaults.length > 0 && sortedVaults.every((v) => v.policy.validUntil <= nowSec);

  function goToVault(e: React.FormEvent) {
    e.preventDefault();
    if (isAddress(jumpAddress)) router.push(`/vaults/${jumpAddress}`);
  }

  return (
    <div className="flex flex-col gap-24 lg:gap-28">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-void-cta">
            Session keys for agents that the contract itself enforces.
          </span>
          <h1 className="-mt-2 max-w-3xl text-5xl font-extrabold leading-[1.0] tracking-[-0.045em] text-void-text sm:text-6xl lg:text-[3.7rem]">
            An agent can propose anything. The contract decides{" "}
            <span className="font-serif text-[1.14em] font-normal italic tracking-[-0.02em] text-void-cta">
              what&apos;s real.
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-void-muted">
            VOID compiles a spending policy directly into an on-chain ERC-4337 validator. Outside
            that policy there is no signature the agent&apos;s session key can produce that the
            contract will accept. Not a review step, a mathematical guarantee.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/create">
              <PrimaryButton className="px-6 py-3 text-base">Create a session vault</PrimaryButton>
            </Link>
            <a
              href="#pipeline"
              className="inline-flex min-h-[44px] items-center rounded-sm border border-void-borderStrong px-6 py-3 text-base font-medium text-void-text transition hover:border-void-muted"
            >
              Watch it reject a transaction ↓
            </a>
          </div>
        </div>
        <div className="relative lg:-mr-10 lg:scale-[1.08]">
          <div className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(108,99,255,0.42),rgba(255,107,44,0.14)_55%,transparent)] blur-3xl" />
          <HeroDiagram />
        </div>
      </section>

      <section className="grid grid-cols-1 divide-y divide-void-border overflow-hidden rounded-lg border border-void-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-7">
          <div className="font-mono text-3xl font-medium text-void-text">5</div>
          <div className="mt-1.5 text-sm text-void-muted">
            priority-ordered checks enforced on-chain, not in app code
          </div>
        </div>
        <div className="p-7">
          <div className="font-mono text-3xl font-medium text-void-text">2</div>
          <div className="mt-1.5 text-sm text-void-muted">
            live testnets: Base Sepolia and Arbitrum Sepolia
          </div>
        </div>
        <div className="p-7">
          <div className="font-mono text-3xl font-medium text-void-text">28</div>
          <div className="mt-1.5 text-sm text-void-muted">
            Foundry tests, including the negative-case proofs
          </div>
        </div>
      </section>

      <section id="pipeline" className="scroll-mt-8">
        <div className="mb-8 max-w-2xl">
          <div className="mb-2.5 font-mono text-xs uppercase tracking-wider text-void-accent">
            Live mechanism
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-void-text sm:text-3xl">
            Every action passes through five gates, in this exact order
          </h2>
          <p className="mt-2 text-sm text-void-muted">
            This is PolicyValidator.validateUserOp, the real contract logic, not a simulation of
            it. Try both paths.
          </p>
        </div>
        <PipelineDemo />
      </section>

      <section className="flex flex-col gap-3 border-t border-void-border pt-10">
        <h2 className="text-2xl font-semibold text-void-text">Session Vaults</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-void-muted">
          Each vault is a real ERC-4337 smart account with this policy compiled directly into it.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/create">
            <PrimaryButton>+ New Session Vault</PrimaryButton>
          </Link>
          <form onSubmit={goToVault} className="flex items-center gap-2">
            <input
              value={jumpAddress}
              onChange={(e) => setJumpAddress(e.target.value)}
              placeholder="0x… view an existing vault"
              className="w-64 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-accent/70 focus:outline-none focus:ring-2 focus:ring-void-accent/20"
            />
            <SecondaryButton type="submit" disabled={!isAddress(jumpAddress)}>
              View
            </SecondaryButton>
          </form>
        </div>

        <div className="mt-8 flex items-baseline justify-between border-t border-void-border pt-8">
          <Label>Recent on {network.name}</Label>
          <span className="text-xs text-void-dim">Any vault opens by address. The chain is the source of truth.</span>
        </div>

        {vaultsQuery.isLoading && <div className="font-mono text-sm text-void-dim">Reading the chain…</div>}

        {vaultsQuery.isError && (
          <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 px-4 py-3 text-sm text-void-danger">
            No response from the {network.name} API ({network.apiUrl}).
          </div>
        )}

        {vaultsQuery.data && vaultsQuery.data.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-void-borderStrong bg-void-surface/60 px-6 py-14 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 96 96" className="absolute inset-0 animate-spin-slow text-void-accent/50" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 7" strokeLinecap="round">
                <circle cx="48" cy="48" r="44" />
              </svg>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-void-muted">
                <path d="M20 4 34 10v9c0 9-6 14-14 17-8-3-14-8-14-17v-9Z" />
                <rect x="15" y="18" width="10" height="8" rx="1.5" />
                <path d="M17.5 18v-3a2.5 2.5 0 0 1 5 0v3" />
              </svg>
            </div>
            <div>
              <p className="text-base font-medium text-void-text">No vaults on {network.name} yet</p>
              <p className="mt-1 text-sm text-void-muted">Set a policy, hand the key to an agent, watch the contract hold the line.</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/create">
                <PrimaryButton>Create your first vault</PrimaryButton>
              </Link>
              <a href="#pipeline" className="text-sm text-void-accent underline decoration-void-accentDim underline-offset-2 hover:decoration-void-accent">
                See a rejection first ↑
              </a>
            </div>
          </div>
        )}

        {allEnded && (
          <div className="flex items-center justify-between rounded-sm border border-void-border bg-void-surface px-4 py-3 text-sm text-void-muted">
            <span>All of these sessions have ended. Start a new one to keep an agent running.</span>
            <Link href="/create">
              <PrimaryButton className="py-1.5">New vault</PrimaryButton>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedVaults.map((v) => (
            <VaultCard key={v.vaultAddress} vault={v} />
          ))}
        </div>
      </section>
    </div>
  );
}
