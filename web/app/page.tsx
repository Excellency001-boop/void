"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isAddress } from "viem";
import { useNetwork } from "@/lib/network-context";
import { truncateAddress, weiToEthDisplay, formatDuration } from "@/lib/format";
import { Card, PrimaryButton, SecondaryButton, Label } from "@/components/ui";

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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 border-b border-void-border pb-8">
        <h1 className="text-2xl font-semibold text-void-text">Session Vaults</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-void-muted">
          Each vault is a real ERC-4337 smart account with a spending policy compiled directly into
          an on-chain validator. An agent holding the session key can only ever act within that
          policy — the contract rejects anything else, no trust required.
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
      </section>

      <section>
        <Label>Created this session</Label>
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
