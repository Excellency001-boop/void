export interface GateDef {
  key: string;
  label: string;
  sub: string;
}

/// The exact fixed priority order PolicyValidator.validateUserOp enforces on-chain — see
/// contracts/src/PolicyValidator.sol. Mirrored here so the dashboard can visualize the real
/// mechanism instead of describing it in prose.
export const POLICY_GATES: GateDef[] = [
  { key: "expiry", label: "Expiry", sub: "session still valid" },
  { key: "spendCap", label: "Spend cap", sub: "within budget" },
  { key: "whitelist", label: "Whitelist", sub: "target + selector allowed" },
  { key: "txCount", label: "Tx count", sub: "under limit" },
  { key: "rateLimit", label: "Rate limit", sub: "per-recipient cap" },
];

/// Maps a PolicyValidator custom error name (as returned by the API's RevertInfo.errorName) to
/// the gate index it belongs to. This is a direct reflection of the contract's own priority
/// order, not a guess — see the numbered comments in validateUserOp.
const ERROR_TO_GATE: Record<string, number> = {
  SessionRevoked: 0,
  SessionNotYetValid: 0,
  SessionExpired: 0,
  NativeSpendCapExceeded: 1,
  TokenNotAllowed: 1,
  TokenSpendCapExceeded: 1,
  TargetSelectorNotAllowed: 2,
  MaxTxCountExceeded: 3,
  RateLimitExceeded: 4,
};

export function gateIndexForError(errorName?: string): number | undefined {
  if (!errorName) return undefined;
  return ERROR_TO_GATE[errorName];
}

export type GateStatus = "cleared" | "blocked" | "pending" | "idle";

/// `blockedAt` undefined means the action cleared every gate (allowed). Otherwise gates before it
/// cleared, the gate at that index is where it was blocked, and gates after it were never reached
/// — PolicyValidator reverts immediately, it doesn't keep checking.
export function computeGateStatuses(blockedAt: number | undefined): GateStatus[] {
  return POLICY_GATES.map((_, i) => {
    if (blockedAt === undefined) return "cleared";
    if (i < blockedAt) return "cleared";
    if (i === blockedAt) return "blocked";
    return "pending";
  });
}

export function idleGateStatuses(): GateStatus[] {
  return POLICY_GATES.map(() => "idle");
}
