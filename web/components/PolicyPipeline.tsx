import { POLICY_GATES, type GateStatus } from "@/lib/policyGates";

const BORDER: Record<GateStatus, string> = {
  cleared: "border-void-success",
  blocked: "border-void-danger",
  pending: "border-void-border",
  idle: "border-void-border",
};

const TEXT: Record<GateStatus, string> = {
  cleared: "text-void-success",
  blocked: "text-void-danger",
  pending: "text-void-dim",
  idle: "text-void-dim",
};

const STATUS_LABEL: Record<GateStatus, string> = {
  cleared: "cleared",
  blocked: "blocked",
  pending: "not reached",
  idle: "—",
};

/// Renders PolicyValidator's fixed five-check priority order as a literal pipeline — the real
/// mechanism, not a decorative diagram. `statuses[i]` drives gate i's color/label; callers compute
/// it either from canned demo state (see the home page) or from a live simulate/execute response's
/// revert.errorName via lib/policyGates.gateIndexForError (see AgentConsole).
export function PolicyPipeline({ statuses }: { statuses: GateStatus[] }) {
  return (
    <div className="flex items-start">
      {POLICY_GATES.map((gate, i) => (
        <div key={gate.key} className="flex flex-1 items-start">
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs ${BORDER[statuses[i]]} ${TEXT[statuses[i]]}`}
            >
              {i + 1}
            </div>
            <div className="text-sm font-medium text-void-text">{gate.label}</div>
            <div className="text-[11px] text-void-muted">{gate.sub}</div>
            <div className={`font-mono text-[10px] uppercase tracking-wide ${TEXT[statuses[i]]}`}>
              {STATUS_LABEL[statuses[i]]}
            </div>
          </div>
          {i < POLICY_GATES.length - 1 && (
            <div className="mt-3.5 h-px w-8 flex-shrink-0 bg-void-border" />
          )}
        </div>
      ))}
    </div>
  );
}
