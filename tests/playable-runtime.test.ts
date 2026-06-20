import { describe, expect, it } from "vitest";
import {
  collectPlayableItem,
  createFeedbackRules,
  createPlayableRules,
  createPlayableRuntimeState,
  hitPlayableHazard,
  PREVIEW_PRIMARY_ACTION_EVENT,
  readPreviewActionLabel,
  restartPlayableRuntime,
  startPlayableRuntime
} from "../src/ui/playableRuntime";

describe("playable runtime state", () => {
  it("exposes a stable DOM fallback event for starting the Phaser preview", () => {
    expect(PREVIEW_PRIMARY_ACTION_EVENT).toBe("wow-game-preview-primary-action");
  });

  it("shows a DOM action only when the canvas needs an explicit start or restart", () => {
    expect(readPreviewActionLabel("idle")).toBe("Start game");
    expect(readPreviewActionLabel("playing")).toBeUndefined();
    expect(readPreviewActionLabel("won")).toBe("Restart");
    expect(readPreviewActionLabel("lost")).toBe("Restart");
  });

  it("starts from idle and enters playing when the player starts", () => {
    const state = createPlayableRuntimeState();
    const playing = startPlayableRuntime(state, "2026-06-17T00:00:00.000Z");

    expect(state.phase).toBe("idle");
    expect(playing.phase).toBe("playing");
    expect(playing.startedAt).toBe("2026-06-17T00:00:00.000Z");
  });

  it("derives playable rules from game hooks and clamps invalid values", () => {
    const rules = createPlayableRules({
      configWinScore: 6,
      hookWinTarget: 4,
      collectibleValue: 2,
      hookLives: 3
    });

    expect(rules).toEqual({
      winScore: 4,
      collectibleValue: 2,
      lives: 3
    });

    expect(createPlayableRules({ configWinScore: 0, collectibleValue: -1, hookLives: 0 })).toEqual({
      winScore: 1,
      collectibleValue: 1,
      lives: 1
    });
  });

  it("prevents one generated collectible from instantly completing the whole game", () => {
    expect(createPlayableRules({ configWinScore: 6, hookWinTarget: 6, collectibleValue: 6 })).toEqual({
      winScore: 6,
      collectibleValue: 1,
      lives: 1
    });
  });

  it("derives feedback rules from game hooks and clamps unsafe values", () => {
    const rules = createFeedbackRules({
      collisionRadius: 18,
      invulnerabilityMs: 600,
      knockbackForce: 220,
      particleCount: 24,
      screenShakeIntensity: 0.02,
      collectBurstCount: 12
    });

    expect(rules).toEqual({
      collisionRadius: 18,
      invulnerabilityMs: 600,
      knockbackForce: 220,
      particleCount: 24,
      screenShakeIntensity: 0.02,
      collectBurstCount: 12
    });

    expect(createFeedbackRules({ collisionRadius: -10, particleCount: 99 })).toEqual({
      collisionRadius: 1,
      invulnerabilityMs: 450,
      knockbackForce: 160,
      particleCount: 48,
      screenShakeIntensity: 0.012,
      collectBurstCount: 12
    });
  });

  it("uses collectible value and hook win target for scoring", () => {
    const rules = createPlayableRules({
      configWinScore: 6,
      hookWinTarget: 4,
      collectibleValue: 2
    });
    let state = startPlayableRuntime(createPlayableRuntimeState(), rules, "start");

    state = collectPlayableItem(state, rules.winScore, rules.collectibleValue, "collect-1");
    expect(state.phase).toBe("playing");
    expect(state.score).toBe(2);

    state = collectPlayableItem(state, rules.winScore, rules.collectibleValue, "win");
    expect(state.phase).toBe("won");
    expect(state.score).toBe(4);
  });

  it("uses hook lives before entering the lost state", () => {
    const rules = createPlayableRules({
      configWinScore: 6,
      hookLives: 2
    });
    let state = startPlayableRuntime(createPlayableRuntimeState(), rules, "start");

    state = hitPlayableHazard(state, "first-hit");
    expect(state.phase).toBe("playing");
    expect(state.lives).toBe(1);

    state = hitPlayableHazard(state, "second-hit");
    expect(state.phase).toBe("lost");
    expect(state.result).toBe("lost");
  });

  it("wins when collected score reaches the win score and can restart", () => {
    let state = startPlayableRuntime(createPlayableRuntimeState(), "start");

    state = collectPlayableItem(state, 2, "collect-1");
    expect(state.phase).toBe("playing");
    expect(state.score).toBe(1);

    state = collectPlayableItem(state, 2, "win");
    expect(state.phase).toBe("won");
    expect(state.result).toBe("won");
    expect(state.endedAt).toBe("win");

    const restarted = restartPlayableRuntime(state);
    expect(restarted.phase).toBe("idle");
    expect(restarted.score).toBe(0);
    expect(restarted.result).toBeUndefined();
  });

  it("loses when the player hits a hazard instead of silently resetting", () => {
    const playing = startPlayableRuntime(createPlayableRuntimeState(), "start");
    const lost = hitPlayableHazard(playing, "hit");

    expect(lost.phase).toBe("lost");
    expect(lost.result).toBe("lost");
    expect(lost.endedAt).toBe("hit");
  });

  it("ignores scoring after the game has ended", () => {
    const lost = hitPlayableHazard(startPlayableRuntime(createPlayableRuntimeState(), "start"), "hit");
    const afterCollect = collectPlayableItem(lost, 1, "late");

    expect(afterCollect).toBe(lost);
    expect(afterCollect.score).toBe(0);
  });
});
