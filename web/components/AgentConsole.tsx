"use client";

import { useState } from "react";
import { isAddress, isHex } from "viem";
import { ApiError, type ExecuteResult, type SimulateResult } from "@/lib/api";
import { useNetwork } from "@/lib/network-context";
import { Card, Label, PrimaryButton, SecondaryButton, TxLink } from "@/components/ui";
import { PolicyPipeline } from "@/components/PolicyPipeline";
import { computeGateStatuses, gateIndexForError, idleGateStatuses } from "@/lib/policyGates";

interface LogEntry {
  id: number;
  time: string;
  kind: "simulate" | "execute";
  ok: boolean;
  summary: string;
  detail: SimulateResult | ExecuteResult;
}

let logId = 0;

export function AgentConsole({
  vaultAddress,
  initialSessionKey = "",
  initialTarget = "",
}: {
  vaultAddress: string;
  initialSessionKey?: string;
  initialTarget?: string;
}) {
  const { api } = useNetwork();
  const [sessionKey, setSessionKey] = useState(initialSessionKey);
  const [target, setTarget] = useState(initialTarget);
  const [valueEth, setValueEth] = useState("0");
  const [calldata, setCalldata] = useState("0x");
  const [busy, setBusy] = useState<"simulate" | "execute" | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const inputsValid =
    isHex(sessionKey) && sessionKey.length === 66 && isAddress(target) && isHex(calldata);

  function pushLog(entry: Omit<LogEntry, "id" | "time">) {
    setLog((prev) => [{ ...entry, id: logId++, time: new Date().toLocaleTimeString() }, ...prev]);
  }

  async function toWei(eth: string): Promise<string> {
    const { parseEther } = await import("viem");
    return parseEther(eth || "0").toString();
  }

  async function run(kind: "simulate" | "execute") {
    setBusy(kind);
    try {
      const value = await toWei(valueEth);
      const input = { vaultAddress, sessionPrivateKey: sessionKey, target, value, calldata };
      if (kind === "simulate") {
        const res = await api.simulateAction(input);
        pushLog({
          kind,
          ok: res.allowed,
          summary: res.allowed
            ? `allowed — risk ${res.riskScore}/100`
            : `blocked — ${res.revert?.errorName ?? "rejected"}`,
          detail: res,
        });
      } else {
        const res = await api.executeAction(input);
        pushLog({
          kind,
          ok: res.success,
          summary: res.success
            ? "executed on-chain"
            : `reverted on-chain — ${res.revert?.errorName ?? "unknown"}`,
          detail: res,
        });
      }
    } catch (err) {
      pushLog({
        kind,
        ok: false,
        summary: err instanceof ApiError ? err.message : "request failed",
        detail: { allowed: false, riskScore: 0, riskFactors: [], userOpHash: "0x" },
      });
    } finally {
      setBusy(null);
    }
  }

  const latest = log[0];
  let pipelineStatuses = idleGateStatuses();
  if (latest) {
    if (latest.ok) {
      pipelineStatuses = computeGateStatuses(undefined);
    } else {
      const blockedAt = gateIndexForError(latest.detail.revert?.errorName);
      // A revert we can't map to a gate (e.g. a request/network failure, not an on-chain
      // rejection) stays idle rather than rendering as "all gates cleared", which would read as
      // success when nothing actually passed.
      if (blockedAt !== undefined) pipelineStatuses = computeGateStatuses(blockedAt);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-void-text">Agent Console</h3>
        <p className="mt-1 text-xs text-void-dim">
          Act as the agent: propose an action with the session key. Simulate replays
          PolicyValidator.validateUserOp read-only (via eth_call) — the contract&apos;s own logic,
          not a guess. Execute submits the real UserOp; a rejection lands as a genuine
          mined-and-reverted transaction, not a silent drop.
        </p>
      </div>

      <div className="rounded-lg border border-void-border bg-void-bg px-5 py-6">
        <PolicyPipeline statuses={pipelineStatuses} />
      </div>

      <div>
        <Label>Session private key</Label>
        <input
          value={sessionKey}
          onChange={(e) => setSessionKey(e.target.value)}
          placeholder="0x… (from vault creation)"
          className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <div>
          <Label>Target contract</Label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0x…"
            className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
          />
        </div>
        <div>
          <Label>Value (ETH)</Label>
          <input
            value={valueEth}
            onChange={(e) => setValueEth(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text focus:border-void-borderStrong focus:outline-none"
          />
        </div>
      </div>

      <div>
        <Label>Calldata</Label>
        <input
          value={calldata}
          onChange={(e) => setCalldata(e.target.value)}
          placeholder="0x"
          className="mt-1 w-full rounded-sm border border-void-border bg-void-raised px-3 py-2 font-mono text-xs text-void-text placeholder:text-void-dim focus:border-void-borderStrong focus:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <SecondaryButton onClick={() => run("simulate")} disabled={!inputsValid || busy !== null}>
          {busy === "simulate" ? "Simulating…" : "Simulate"}
        </SecondaryButton>
        <PrimaryButton onClick={() => run("execute")} disabled={!inputsValid || busy !== null}>
          {busy === "execute" ? "Submitting…" : "Execute for real"}
        </PrimaryButton>
      </div>

      {log.length > 0 && (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-sm border border-void-border bg-void-bg">
          {log.map((entry) => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </Card>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const isExecute = entry.kind === "execute";
  const detail = entry.detail;

  return (
    <div className="border-b border-void-border px-3 py-2.5 font-mono text-xs last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-void-dim">{entry.time}</span>
        <span className="text-void-muted">{isExecute ? "EXECUTE" : "SIMULATE"}</span>
        <span className={entry.ok ? "text-void-success" : "text-void-danger"}>{entry.summary}</span>
      </div>

      {"riskFactors" in detail && detail.riskFactors.length > 0 && (
        <ul className="mt-1 list-inside list-disc pl-2 text-void-warn">
          {detail.riskFactors.map((f) => (
            <li key={f.code}>
              {f.description} (+{f.points})
            </li>
          ))}
        </ul>
      )}

      {detail.revert && (
        <div className="mt-1 text-void-dim">
          {detail.revert.errorName}
          {detail.revert.args.length > 0 && `(${detail.revert.args.map(String).join(", ")})`}
          {detail.revert.viaEntryPoint && " — unwrapped from EntryPoint.FailedOpWithRevert"}
        </div>
      )}

      {"txHash" in detail && detail.txHash && (
        <div className="mt-1">
          <TxLink hash={detail.txHash} />
        </div>
      )}
    </div>
  );
}
