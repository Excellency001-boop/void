"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isAddress } from "viem";
import { useNetwork } from "@/lib/network-context";
import { truncateAddress, weiToEthDisplay, formatDuration } from "@/lib/format";
import { Card, PrimaryButton, SecondaryButton, Label } from "@/components/ui";
import { PipelineDemo } from "@/components/PipelineDemo";

export default function HomePage() {
  const router = useRouter();
  const [jumpAddress, setJumpAddress] = useState("");
  const { network, api } = useNetwork();

  const vaultsQuery = useQuery({
    queryKey: ["vaults", network.id],
    queryFn: api.listVaults,
    refetchInterval: 15_000,
  });

  function goToVault(e: React.FormEvent) {
    e.preventDefault();
    if (isAddress(jumpAddress)) router.push(`/vaults/${jumpAddress}`);
  }

  return (
    <div className="flex flex-col gap-20">
      <section className="flex flex-col gap-6 pt-4">
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight text-void-text sm:text-6xl">
          An agent can propose anything. The contract decides what&apos;s real.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-void-muted">
          VOID compiles a spending policy directly into an on-chain ERC-4337 validator. Outside
          that policy there is no signature the agent&apos;s session key can produce that the
          contract will accept — not a review step, a mathematical guarantee.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/create">
            <PrimaryButton className="px-6 py-3 text-base">Create a session vault</PrimaryButton>
          </Link>
          <a
            href="#pipeline"
            className="inline-flex min-h-[44px] items-center rounded-sm border border-void-border px-6 py-3 text-base font-medium text-void-text transition hover:border-void-borderStrong"
          >
            Watch it reject a transaction ↓
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 divide-y divide-void-border overflow-hidden rounded-lg border border-void-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-6">
          <div className="font-mono text-3xl font-medium text-void-text">5</div>
          <div className="mt-1.5 text-sm text-void-muted">
            priority-ordered checks enforced on-chain, not in app code
          </div>
        </div>
        <div className="p-6">
          <div className="font-mono text-3xl font-medium text-void-text">2</div>
          <div className="mt-1.5 text-sm text-void-muted">
            live testnets — Base Sepolia and Arbitrum Sepolia
          </div>
        </div>
        <div className="p-6">
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
            This is PolicyValidator.validateUserOp, the real contract logic — not a simulation of
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
              className="w-64 rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
            />
            <SecondaryButton type="submit" disabled={!isAddress(jumpAddress)}>
              View
            </SecondaryButton>
          </form>
        </div>

        <Label className="mt-6">Created this session</Label>
        <p className="mb-4 mt-1 text-xs text-void-dim">
          This list is a convenience index kept in the API's memory, not the source of truth —
          it resets when the API restarts. Every vault's real status always lives on-chain; paste
          its address above to look it up directly.
        </p>

        {vaultsQuery.isLoading && <div className="text-sm text-void-dim">Loading…</div>}

        {vaultsQuery.isError && (
          <div className="rounded-sm border border-void-danger/30 bg-void-dangerDim/10 px-4 py-3 text-sm text-void-danger">
            Couldn&apos;t reach the {network.name} API ({network.apiUrl}).
          </div>
        )}

        {vaultsQuery.data && vaultsQuery.data.length === 0 && (
          <div className="rounded-sm border border-dashed border-void-border px-4 py-8 text-center text-sm text-void-dim">
            No vaults created yet in this session.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vaultsQuery.data?.map((v) => {
            const remaining = Number(v.policy.validUntil) - Math.floor(Date.now() / 1000);
            return (
              <Link key={v.vaultAddress} href={`/vaults/${v.vaultAddress}`}>
                <Card className="h-full p-4 transition hover:border-void-borderStrong">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-void-text">
                      {truncateAddress(v.vaultAddress)}
                    </span>
                    <span className="text-[11px] text-void-dim">{formatDuration(remaining)} left</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-void-muted">Budget</span>
                    <span className="font-mono text-void-text">
                      {weiToEthDisplay(v.policy.nativeSpendCap)} ETH
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-void-muted">Owner</span>
                    <span className="font-mono text-void-dim">{truncateAddress(v.ownerAddress)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
