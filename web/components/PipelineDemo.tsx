"use client";

import { useState } from "react";
import { PolicyPipeline } from "@/components/PolicyPipeline";
import { computeGateStatuses, gateIndexForError } from "@/lib/policyGates";
import { truncateAddress } from "@/lib/format";

/// Two real, verifiable transactions from VOID's own Arbitrum Sepolia testing — not staged copy.
/// The "illegal" one is the exact TargetSelectorNotAllowed rejection PolicyValidator produced when
/// an agent tried to act on a target outside its whitelist. Fixed to Arbiscan directly rather than
/// going through useNetwork()'s explorer link — these hashes are permanently Arbitrum Sepolia, so
/// they'd point at the wrong chain's explorer if the dashboard's active network were Base Sepolia.
const LEGAL_TX = "0x347a476a2a1553c17c2025a4893d3a93563523670d07ba44c863a07bb95e54fd";
const ILLEGAL_TX = "0x4ca890eacd8466ba2d5d7ee683dba638ba4faecb57298ce68aa24a76521e5440";
const ARBISCAN_SEPOLIA_TX = (hash: string) => `https://sepolia.arbiscan.io/tx/${hash}`;

export function PipelineDemo() {
  const [scenario, setScenario] = useState<"legal" | "illegal">("legal");
  const blockedAt = scenario === "illegal" ? gateIndexForError("TargetSelectorNotAllowed") : undefined;
  const statuses = computeGateStatuses(blockedAt);
  const ok = scenario === "legal";

  return (
    <div>
      <div className="mb-6 flex gap-2.5">
        <button
          type="button"
          onClick={() => setScenario("legal")}
          className={`rounded-sm border px-4 py-2.5 text-sm font-medium transition ${
            scenario === "legal"
              ? "border-void-accent bg-void-accent text-white"
              : "border-void-border text-void-muted hover:border-void-borderStrong"
          }`}
        >
          Simulate a legal action
        </button>
        <button
          type="button"
          onClick={() => setScenario("illegal")}
          className={`rounded-sm border px-4 py-2.5 text-sm font-medium transition ${
            scenario === "illegal"
              ? "border-void-danger bg-void-danger text-white"
              : "border-void-border text-void-muted hover:border-void-borderStrong"
          }`}
        >
          Simulate an illegal action
        </button>
      </div>

      <div className="rounded-lg border border-void-border bg-void-surface p-8">
        <PolicyPipeline statuses={statuses} />

        <div className="mt-8 flex items-start gap-3 border-t border-void-border pt-7">
          <span
            className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${ok ? "bg-void-success" : "bg-void-danger"}`}
          />
          <div>
            <div className={`text-base font-medium ${ok ? "text-void-success" : "text-void-danger"}`}>
              {ok ? "Executed on-chain" : "Reverted on-chain"}
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-void-muted">
              {ok
                ? "UserOp validated. EntryPoint.handleOps mined it for real: a genuine transaction, a genuine state change."
                : "PolicyValidator.validateUserOp reverted with TargetSelectorNotAllowed(address,bytes4). EntryPoint has no try or catch around validation, so the whole op reverts. Mined, visible, provable, not a dropped request."}
            </p>
            <div className="mt-2.5 font-mono text-xs text-void-dim">
              <a
                href={ARBISCAN_SEPOLIA_TX(ok ? LEGAL_TX : ILLEGAL_TX)}
                target="_blank"
                rel="noreferrer"
                className="text-void-accent underline decoration-void-accentDim underline-offset-2 hover:decoration-void-accent"
              >
                {ok ? "tx" : "tx (reverted)"} {truncateAddress(ok ? LEGAL_TX : ILLEGAL_TX)} ↗
              </a>
              <span className="ml-2 text-void-dim">· Arbitrum Sepolia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
