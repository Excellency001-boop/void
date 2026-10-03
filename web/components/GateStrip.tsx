import { POLICY_GATES } from "@/lib/policyGates";

export type GateArm = "armed" | "closed" | "off";

const SEG: Record<GateArm, string> = {
  armed: "bg-void-accent",
  closed: "bg-void-danger",
  off: "bg-void-border",
};

/// Five segments, one per PolicyValidator gate. On a live vault every gate is armed. Once a session
/// expires or is revoked, gate 1 (expiry) is the one that rejects everything, so it goes red and the
/// rest go quiet. `labels` adds the gate names and staggers an arm-in animation (used on the success
/// screen); without it this is a compact status glyph for cards.
export function GateStrip({ states, labels = false }: { states: GateArm[]; labels?: boolean }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={states.every((s) => s === "armed") ? "All five policy gates armed" : "Policy gates closed"}>
      {POLICY_GATES.map((g, i) => (
        <div
          key={g.key}
          className={labels ? "flex-1 animate-arm" : "flex-1"}
          style={labels ? { animationDelay: `${0.5 + i * 0.12}s` } : undefined}
        >
          <div className={`h-1 rounded-full ${SEG[states[i]]}`} />
          {labels && (
            <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-void-muted">
              {g.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
