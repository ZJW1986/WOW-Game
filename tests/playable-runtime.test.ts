import { describe, expect, it } from "vitest";
import {
  collectPlayableItem,
  createPlayableRuntimeState,
  hitPlayableHazard,
  restartPlayableRuntime,
  startPlayableRuntime
} from "../src/ui/playableRuntime";

describe("playable runtime state", () => {
  it("starts from idle and enters playing when the player starts", () => {
    const state = createPlayableRuntimeState();
    const playing = startPlayableRuntime(state, "2026-06-17T00:00:00.000Z");

    expect(state.phase).toBe("idle");
    expect(playing.phase).toBe("playing");
    expect(playing.startedAt).toBe("2026-06-17T00:00:00.000Z");
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
