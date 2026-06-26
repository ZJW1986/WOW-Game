import { describe, expect, it } from "vitest";
import { createRetryBudget, RetryBudgetExceededError } from "../src/services/retryBudget";

describe("retry budget", () => {
  it("allows configured retry attempts and rejects attempts over budget", () => {
    const budget = createRetryBudget({ asset: 2, dsl: 2, llmValidation: 2 });

    expect(budget.consume("asset").attempt).toBe(1);
    expect(budget.consume("asset").attempt).toBe(2);
    expect(() => budget.consume("asset")).toThrow(RetryBudgetExceededError);
  });

  it("reports budget state for generation diagnostics", () => {
    const budget = createRetryBudget({ asset: 1, dsl: 2, llmValidation: 2 });
    budget.consume("asset");

    expect(budget.snapshot()).toMatchObject({
      asset: { used: 1, limit: 1 },
      dsl: { used: 0, limit: 2 },
      llmValidation: { used: 0, limit: 2 }
    });
  });
});
