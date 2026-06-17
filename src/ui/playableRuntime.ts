export type PlayablePhase = "idle" | "playing" | "won" | "lost";

export interface PlayableRuntimeState {
  phase: PlayablePhase;
  score: number;
  lives: number;
  startedAt?: string;
  endedAt?: string;
  result?: "won" | "lost";
}

export function createPlayableRuntimeState(): PlayableRuntimeState {
  return {
    phase: "idle",
    score: 0,
    lives: 1
  };
}

export function startPlayableRuntime(
  state: PlayableRuntimeState,
  now = new Date().toISOString()
): PlayableRuntimeState {
  return {
    ...state,
    phase: "playing",
    score: 0,
    lives: 1,
    startedAt: now,
    endedAt: undefined,
    result: undefined
  };
}

export function collectPlayableItem(
  state: PlayableRuntimeState,
  winScore: number,
  now = new Date().toISOString()
): PlayableRuntimeState {
  if (state.phase !== "playing") return state;
  const score = state.score + 1;
  if (score >= winScore) {
    return {
      ...state,
      phase: "won",
      score,
      endedAt: now,
      result: "won"
    };
  }
  return {
    ...state,
    score
  };
}

export function hitPlayableHazard(
  state: PlayableRuntimeState,
  now = new Date().toISOString()
): PlayableRuntimeState {
  if (state.phase !== "playing") return state;
  return {
    ...state,
    phase: "lost",
    lives: 0,
    endedAt: now,
    result: "lost"
  };
}

export function restartPlayableRuntime(state: PlayableRuntimeState): PlayableRuntimeState {
  return {
    ...state,
    phase: "idle",
    score: 0,
    lives: 1,
    startedAt: undefined,
    endedAt: undefined,
    result: undefined
  };
}
