import { describe, expect, it } from "vitest";
import { awardForRun, type ScoreTierRunResult } from "../src/ui/ScoreTierOverlay";
import type { GameHooks } from "../src/core/types";

const tiers: NonNullable<GameHooks["scoreTiers"]> = {
  targetDurationMs: 75000,
  gold: { minScore: 6, maxDeathCount: 0, maxDurationMs: 56000 },
  silver: { minScore: 4, maxDeathCount: 1 },
  bronze: { minScore: 2 },
  rationale: "test"
};

function run(outcome: ScoreTierRunResult["outcome"], score: number, deaths: number, durationMs: number): ScoreTierRunResult {
  return { outcome, score, deaths, durationMs };
}

describe("ScoreTierOverlay.awardForRun", () => {
  it("awards gold when the player meets all gold thresholds", () => {
    expect(awardForRun(run("won", 8, 0, 50000), tiers)).toBe("gold");
  });

  it("falls back to silver when gold time is exceeded", () => {
    expect(awardForRun(run("won", 8, 0, 60000), tiers)).toBe("silver");
  });

  it("falls back to silver when gold death cap is exceeded", () => {
    expect(awardForRun(run("won", 6, 1, 40000), tiers)).toBe("silver");
  });

  it("awards bronze when only the bronze score is met", () => {
    expect(awardForRun(run("won", 2, 3, 90000), tiers)).toBe("bronze");
  });

  it("returns none when the player loses", () => {
    expect(awardForRun(run("lost", 5, 1, 30000), tiers)).toBe("none");
  });

  it("defaults to bronze when scoreTiers are missing but the run is won", () => {
    expect(awardForRun(run("won", 1, 0, 30000), undefined)).toBe("bronze");
  });

  it("returns none when score is below all tiers", () => {
    expect(awardForRun(run("won", 1, 0, 30000), tiers)).toBe("none");
  });
});
