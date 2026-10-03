"use client";

import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@/lib/api";
import { NETWORKS, explorerAddressUrl, type NetworkConfig } from "@/lib/networks";
import { truncateAddress } from "@/lib/format";

/// Proof the "multichain" claim is real, not a dropdown: for each chain, the live API's own
/// /health answer (so the dot is a real probe) and the deployed contracts, each linked to the
/// block explorer so anyone can read the code that enforces the policy.
export function Deployments() {
  return (
    <section id="deployments" className="scroll-mt-8">
      <div className="mb-8 max-w-2xl">
        <div className="mb-2.5 font-mono text-xs uppercase tracking-wider text-void-accent">Deployments</div>
        <h2 className="text-2xl font-bold tracking-tight text-void-text sm:text-3xl">
          Live on two chains. Same contracts, same guarantee.
        </h2>
        <p className="mt-2 text-sm text-void-muted">
          Each chain has its own validator and its own API. Open the addresses and read the code yourself.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {NETWORKS.map((n) => (
          <ChainCard key={n.id} network={n} />
        ))}
      </div>
    </section>
  );
}

function ChainCard({ network }: { network: NetworkConfig }) {
  const q = useQuery({
    queryKey: ["health", network.id],
    queryFn: () => createApiClient(network.apiUrl).health(),
    refetchInterval: 30_000,
    retry: 1,
  });
  const up = q.data?.status === "ok";
  const c = q.data?.contracts;

  const rows: { label: string; address?: string }[] = [
    { label: "PolicyValidator", address: c?.policyValidator },
    { label: "ExpirySweepExecutor", address: c?.expirySweepExecutor },
    { label: "Kernel factory", address: c?.kernelFactory },
    { label: "EntryPoint v0.7", address: c?.entryPoint },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-void-border bg-void-surface">
      <div className="flex items-center justify-between gap-3 border-b border-void-border px-5 py-4">
        <div className="min-w-0">
          <div className="font-display text-lg font-bold text-void-text">{network.name}</div>
          <div className="font-mono text-[11px] text-void-dim">chain {network.chainId}</div>
        </div>
        <span
          className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] ${
            q.isLoading
              ? "border-void-border text-void-dim"
              : up
                ? "border-void-success/40 text-void-success"
                : "border-void-danger/40 text-void-danger"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${q.isLoading ? "bg-void-dim" : up ? "bg-void-success" : "bg-void-danger"}`}
          />
          {q.isLoading ? "checking" : up ? "API live" : "API down"}
        </span>
      </div>
      <ul className="divide-y divide-void-border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="text-void-muted">{r.label}</span>
            {r.address ? (
              <a
                href={explorerAddressUrl(network, r.address)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-void-text underline decoration-void-border underline-offset-4 transition hover:decoration-void-accent"
              >
                {truncateAddress(r.address, 5)} ↗
              </a>
            ) : (
              <span className="font-mono text-xs text-void-dim">{q.isLoading ? "…" : "unavailable"}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
