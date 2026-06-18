import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import {
  createDebugProtocol,
  recordDebugProtocolEntry
} from "../src/services/debugProtocol";
import { getTemplateSkill } from "../src/services/templateSkills";
import { runDynamicVerification } from "../src/services/verificationBench";

describe("OpenGame-style maturity upgrades", () => {
  it("exposes bounded template skills for each physics-first family", () => {
    const platformer = getTemplateSkill("platformer");
    const towerDefense = getTemplateSkill("tower_defense");

    expect(platformer.runtimeContract.requiredMechanics).toContain("gravity");
    expect(platformer.allowedHooks).toEqual([
      "setupEntities",
      "setupCollisions",
      "handleCustomRules",
      "onWin",
      "onLose"
    ]);
    expect(towerDefense.runtimeContract.requiredMechanics).toContain("waves");
    expect(towerDefense.forbiddenActions).toContain("rewrite Phaser lifecycle");
  });

  it("records reusable debug protocol entries with hit counts", () => {
    const protocol = createDebugProtocol();

    const first = recordDebugProtocolEntry(protocol, {
      errorSignature: "asset-key-missing:item.collectible",
      templateFamily: "top_down",
      failedStage: "asset-pack",
      rootCause: "game-config referenced an asset key absent from asset-pack",
      verifiedFix: "regenerate asset requirements and keep asset-pack as source of truth",
      detectionRule: "validateAssetReferences reports a missing key"
    });
    const second = recordDebugProtocolEntry(first, {
      errorSignature: "asset-key-missing:item.collectible",
      templateFamily: "top_down",
      failedStage: "asset-pack",
      rootCause: "game-config referenced an asset key absent from asset-pack",
      verifiedFix: "regenerate asset requirements and keep asset-pack as source of truth",
      detectionRule: "validateAssetReferences reports a missing key"
    });

    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].hitCount).toBe(2);
    expect(second.entries[0].lastSeenAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("adds dynamic verification evidence to QA reports", () => {
    const project = runMockPipeline("make a top down spaceship dodge and collect game");
    const report = runDynamicVerification(project);

    expect(report.scores.buildHealth).toBeGreaterThanOrEqual(90);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        "browser canvas non-empty",
        "keyboard input moves player",
        "collect or hazard interaction observed"
      ])
    );
    expect(report.debugProtocolEntries).toEqual(
      expect.arrayContaining(["dynamic-verification: no blocking runtime issues found"])
    );
    expect(report.evidence.canvasNonEmpty).toBe(true);
    expect(report.evidence.playerMoved).toBe(true);
  });
});
