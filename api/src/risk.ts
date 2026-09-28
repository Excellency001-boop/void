export interface RiskFactor {
  code: string;
  points: number;
  description: string;
}

export interface RiskInput {
  value: bigint;
  remainingNativeBudget: bigint;
  txCount: bigint;
  maxTxCount: bigint;
  validUntil: number;
  validAfter: number;
  nowSeconds: number;
}

/// Deliberately simple and fully explainable — every point on the score traces back to one named,
/// human-readable factor. This is NOT a model; it's a checklist. The on-chain contract is what
/// actually stops an out-of-policy action; this score exists to flag "technically allowed, but
/// you probably want a human to glance at this one" before an agent burns a big chunk of budget
/// with no push-back.
export function scoreAction(input: RiskInput): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];

  if (input.remainingNativeBudget > 0n) {
    const pctOfBudget = Number((input.value * 10000n) / input.remainingNativeBudget) / 100;
    if (pctOfBudget > 90) {
      factors.push({
        code: "BUDGET_MAJORITY_90",
        points: 40,
        description: `Uses ${pctOfBudget.toFixed(1)}% of the remaining native budget in one action`,
      });
    } else if (pctOfBudget > 50) {
      factors.push({
        code: "BUDGET_MAJORITY_50",
        points: 20,
        description: `Uses ${pctOfBudget.toFixed(1)}% of the remaining native budget in one action`,
      });
    }
  } else if (input.value > 0n) {
    factors.push({
      code: "BUDGET_EXHAUSTED",
      points: 40,
      description: "No native budget remains, but this action attempts to spend a positive value",
    });
  }

  if (input.maxTxCount > 0n && input.txCount + 1n >= input.maxTxCount) {
    factors.push({
      code: "FINAL_ALLOWED_TX",
      points: 15,
      description: "This would be the last transaction the session's tx-count cap allows",
    });
  }

  const totalWindow = input.validUntil - input.validAfter;
  const remaining = input.validUntil - input.nowSeconds;
  if (totalWindow > 0 && remaining > 0 && remaining < totalWindow * 0.1) {
    factors.push({
      code: "NEAR_EXPIRY",
      points: 10,
      description: "Session expires in under 10% of its original time window",
    });
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  return { score, factors };
}
