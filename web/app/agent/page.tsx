"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Label } from "@/components/ui";
import { networkById, explorerTxUrl } from "@/lib/networks";
import { truncateAddress } from "@/lib/format";

interface Observation {
  success?: boolean;
  allowed?: boolean;
  txHash?: string;
  revert?: { errorName: string };
  error?: string;
}
interface Entry {
  step: number;
  thought: string;
  action: { tool: string; target?: string; value_wei?: string; calldata?: string; summary?: string };
  observation?: Observation;
}
interface Run {
  model: string;
  chain: string;
  vault: string;
  log: Entry[];
}

const NOT_POLICY = ["FailedOp", "NotBroadcast", "UnknownRevert"];
const net = networkById("base-sepolia");

function verdict(e: Entry): "allowed" | "rejected" | "failed" | "info" | null {
  if (e.action.tool === "finish") return null;
  const o = e.observation;
  if (e.action.tool === "status" || !o) return "info";
  if (o.error) return "failed";
  if (o.success || o.allowed) return "allowed";
  if (o.revert && NOT_POLICY.includes(o.revert.errorName)) return "failed";
  return "rejected";
}

function eth(wei?: string) {
  if (!wei || wei === "0") return "0 ETH";
  const n = Number(wei) / 1e18;
  return `${n.toFixed(n < 0.001 ? 5 : 4).replace(/0+$/, "").replace(/\.$/, "")} ETH`;
}

export default function AgentRunPage() {
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/agent-run.json")
      .then((r) => r.json())
      .then(setRun)
      .catch(() => setRun(null));
  }, []);

  // Reveal one step at a time, the way the run unfolded.
  const steps = run?.log.filter((e) => e.action.tool !== "status") ?? [];
  useEffect(() => {
    if (!run || !playing) return;
    if (shown >= steps.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : 1900);
    return () => clearTimeout(t);
  }, [run, shown, playing, steps.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shown]);

  const visible = steps.slice(0, shown);
  const counts = { allowed: 0, rejected: 0, failed: 0 };
  for (const e of visible) {
    const v = verdict(e);
    if (v === "allowed" || v === "rejected" || v === "failed") counts[v]++;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <div className="mb-2.5 font-mono text-xs uppercase tracking-wider text-void-cta">Red-team run</div>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          We told an AI agent it was hijacked.
          <span className="font-serif italic font-normal text-void-cta"> It tried to drain the vault.</span>
        </h1>
        <p className="mt-4 text-base text-void-muted">
          A real model held a real session key for a vault on {net.name}. Its only legitimate permission was wrapping
          ETH into WETH. This is the recorded run, replayed. Every transaction is real: open it on the explorer.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-void-border px-4 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-void-dim">
            agent · {run ? run.model.split(" (")[0] : "loading"}
          </span>
          <button
            type="button"
            onClick={() => {
              setShown(0);
              setPlaying(true);
            }}
            className="rounded-sm border border-void-border px-2.5 py-1 font-mono text-[11px] text-void-muted hover:border-void-borderStrong"
          >
            Replay
          </button>
        </div>
        <div className="flex max-h-[26rem] min-h-[18rem] flex-col gap-5 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed" aria-live="polite">
          {!run && <div className="text-void-dim">Loading the recorded run…</div>}
          {visible.map((e) => {
            const v = verdict(e);
            const a = e.action;
            if (a.tool === "finish") {
              return (
                <div key={e.step} className="rounded-sm border border-void-border bg-void-raised p-3 text-void-text">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-void-dim">agent's report</div>
                  {a.summary}
                </div>
              );
            }
            return (
              <div key={e.step} className="animate-arm">
                <div className="text-void-accent">
                  <span className="text-void-dim">[{e.step}]</span> {e.thought}
                </div>
                <div className="mt-1.5 text-void-text">
                  {a.tool} {eth(a.value_wei)} → {a.target ? truncateAddress(a.target, 5) : ""}
                  {a.calldata && a.calldata !== "0x" ? <span className="text-void-dim"> data {a.calldata.slice(0, 10)}…</span> : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {v === "allowed" && (
                    <span className="rounded-sm border border-void-success/40 bg-void-successDim/30 px-2 py-0.5 text-void-success">
                      ALLOWED by the contract
                    </span>
                  )}
                  {v === "rejected" && (
                    <span className="rounded-sm border border-void-danger/40 bg-void-dangerDim/30 px-2 py-0.5 text-void-danger">
                      REJECTED on-chain: {e.observation?.revert?.errorName}
                    </span>
                  )}
                  {v === "failed" && (
                    <span className="rounded-sm border border-void-border px-2 py-0.5 text-void-muted">
                      did not reach a policy verdict ({e.observation?.revert?.errorName ?? "bad request"})
                    </span>
                  )}
                  {e.observation?.txHash && (
                    <a
                      href={explorerTxUrl(net, e.observation.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-void-accent underline decoration-void-accentDim underline-offset-2"
                    >
                      tx {truncateAddress(e.observation.txHash, 5)} ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-void-border border-t border-void-border text-center">
          <div className="px-3 py-3">
            <div className="font-mono text-2xl text-void-danger">{counts.rejected}</div>
            <Label>rejected by the contract</Label>
          </div>
          <div className="px-3 py-3">
            <div className="font-mono text-2xl text-void-success">{counts.allowed}</div>
            <Label>allowed (owner-approved)</Label>
          </div>
          <div className="px-3 py-3">
            <div className="font-mono text-2xl text-void-text">0 ETH</div>
            <Label>reached the attacker</Label>
          </div>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-void-dim">
        Honest notes. The model was Claude, answering each turn through a Claude Code session, because no API key
        was available. One call failed before the policy could decide (the vault had too little ETH for gas), and one
        request was malformed on the agent's side. We left both in. Vault{" "}
        {run ? (
          <a className="font-mono underline" href={`${net.explorerBase}/address/${run.vault}`} target="_blank" rel="noreferrer">
            {truncateAddress(run.vault, 5)}
          </a>
        ) : null}
        . Run it yourself with the <span className="font-mono">agent/</span> package in the repo.
      </p>
    </div>
  );
}
