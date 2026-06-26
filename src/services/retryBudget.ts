export type RetryBudgetKind = "asset" | "dsl" | "llmValidation";

export type RetryBudgetLimits = Record<RetryBudgetKind, number>;

export interface RetryBudgetSnapshot {
  asset: { used: number; limit: number };
  dsl: { used: number; limit: number };
  llmValidation: { used: number; limit: number };
}

export class RetryBudgetExceededError extends Error {
  constructor(readonly kind: RetryBudgetKind, readonly limit: number) {
    super(`Retry budget exceeded for ${kind}: ${limit}`);
    this.name = "RetryBudgetExceededError";
  }
}

export function createRetryBudget(limits: Partial<RetryBudgetLimits> = {}) {
  const resolved: RetryBudgetLimits = {
    asset: limits.asset ?? 2,
    dsl: limits.dsl ?? 2,
    llmValidation: limits.llmValidation ?? 2
  };
  const used: Record<RetryBudgetKind, number> = {
    asset: 0,
    dsl: 0,
    llmValidation: 0
  };

  return {
    consume(kind: RetryBudgetKind) {
      if (used[kind] >= resolved[kind]) {
        throw new RetryBudgetExceededError(kind, resolved[kind]);
      }
      used[kind] += 1;
      return { attempt: used[kind], limit: resolved[kind] };
    },
    snapshot(): RetryBudgetSnapshot {
      return {
        asset: { used: used.asset, limit: resolved.asset },
        dsl: { used: used.dsl, limit: resolved.dsl },
        llmValidation: { used: used.llmValidation, limit: resolved.llmValidation }
      };
    }
  };
}
