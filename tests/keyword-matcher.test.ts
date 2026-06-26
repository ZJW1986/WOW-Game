import { describe, expect, it } from "vitest";
import { buildKeywordMatcher } from "../src/services/keywordMatcher";
import { sanitizeProviderPrompt } from "../src/services/productionPromptPacks";

describe("keyword matcher", () => {
  it("matches mixed Chinese and English tokens without dynamic RegExp parsing", () => {
    const matches = buildKeywordMatcher(["塔防", "炮塔", "tower defense", "turret", "base defense", "wave"]);

    expect(matches("未来科幻塔防，建造炮塔守住基地")).toBe(true);
    expect(matches("premium tower defense with wave pressure")).toBe(true);
    expect(matches("platform jumper")).toBe(false);
  });

  it("treats question mark tokens as literal text instead of regex quantifiers", () => {
    const matches = buildKeywordMatcher(["??", "tower?defense"]);

    expect(matches("broken ?? mojibake token")).toBe(true);
    expect(matches("tower?defense literal")).toBe(true);
  });

  it("sanitizes provider terms with escaped regular expressions", () => {
    expect(() => sanitizeProviderPrompt("Three.js ??? Phaser scene lifecycle")).not.toThrow();
    expect(sanitizeProviderPrompt("Three.js ??? Phaser scene lifecycle")).not.toMatch(/Three\.js|Phaser/);
  });
});
