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
  idle: "idle",
};

/// Renders PolicyValidator's fixed five-check priority order as a literal pipeline — the real
/// mechanism, not a decorative diagram. `statuses[i]` drives gate i's color/label; callers compute
/// it either from canned demo state (see the home page) or from a live simulate/execute response's
/// revert.errorName via lib/policyGates.gateIndexForError (see AgentConsole).
///
/// Phones get a vertical stack (five columns do not fit in 375px); sm and up get the horizontal row.
export function PolicyPipeline({ statuses }: { statuses: GateStatus[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start">
      {POLICY_GATES.map((gate, i) => {
        const last = i === POLICY_GATES.length - 1;
        return (
          <div
            key={gate.key}
            className="flex animate-arm items-start sm:flex-1"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
              <div className="flex flex-shrink-0 flex-col items-center sm:contents">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-300 ${BORDER[statuses[i]]} ${TEXT[statuses[i]]}`}
                >
                  {i + 1}
                </div>
                {!last && <div className="my-1 h-6 w-px bg-void-border sm:hidden" />}
              </div>
              <div className="min-w-0 flex-1 pb-1 sm:flex-none sm:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
                  <span className="text-sm font-medium text-void-text">{gate.label}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-wide sm:hidden ${TEXT[statuses[i]]}`}>
                    {STATUS_LABEL[statuses[i]]}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-void-muted sm:mt-2">{gate.sub}</div>
                <div className={`mt-2 hidden font-mono text-[10px] uppercase tracking-wide sm:block ${TEXT[statuses[i]]}`}>
                  {STATUS_LABEL[statuses[i]]}
                </div>
              </div>
            </div>
            {!last && <div className="mt-3.5 hidden h-px w-8 flex-shrink-0 bg-void-border sm:block" />}
          </div>
        );
      })}
    </div>
  );
}
