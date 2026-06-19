export type PlayablePhase = "idle" | "playing" | "won" | "lost";

export interface PlayableRuntimeState {
  phase: PlayablePhase;
  score: number;
  lives: number;
  startedAt?: string;
  endedAt?: string;
  result?: "won" | "lost";
}

export interface PlayableRules {
  winScore: number;
  collectibleValue: number;
  lives: number;
}

export interface FeedbackRules {
  collisionRadius: number;
  invulnerabilityMs: number;
  knockbackForce: number;
  particleCount: number;
  screenShakeIntensity: number;
  collectBurstCount: number;
}

export function createPlayableRuntimeState(): PlayableRuntimeState {
  return {
    phase: "idle",
    score: 0,
    lives: 1
  };
}

export function createPlayableRules(input: {
  configWinScore: number;
  hookWinTarget?: number;
  collectibleValue?: number;
  hookLives?: number;
}): PlayableRules {
  return {
    winScore: Math.max(1, Math.round(input.hookWinTarget || input.configWinScore || 1)),
    collectibleValue: Math.max(1, Math.round(input.collectibleValue || 1)),
    lives: Math.max(1, Math.round(input.hookLives || 1))
  };
}

export function createFeedbackRules(input: Partial<FeedbackRules> = {}): FeedbackRules {
  return {
    collisionRadius: clampNumber(input.collisionRadius, 1, 96, 10),
    invulnerabilityMs: clampNumber(input.invulnerabilityMs, 0, 3000, 450),
    knockbackForce: clampNumber(input.knockbackForce, 0, 800, 160),
    particleCount: clampNumber(input.particleCount, 1, 48, 18),
    screenShakeIntensity: clampNumber(input.screenShakeIntensity, 0, 0.06, 0.012),
    collectBurstCount: clampNumber(input.collectBurstCount, 1, 36, 12)
  };
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function startPlayableRuntime(
  state: PlayableRuntimeState,
  rulesOrNow: Partial<PlayableRules> | string = {},
  maybeNow?: string
): PlayableRuntimeState {
  const rules = typeof rulesOrNow === "string" ? {} : rulesOrNow;
  const now = typeof rulesOrNow === "string" ? rulesOrNow : maybeNow ?? new Date().toISOString();
  return {
    ...state,
    phase: "playing",
    score: 0,
    lives: rules.lives ?? 1,
    startedAt: now,
    endedAt: undefined,
    result: undefined
  };
}

export function collectPlayableItem(
  state: PlayableRuntimeState,
  winScore: number,
  valueOrNow: number | string = 1,
  maybeNow?: string
): PlayableRuntimeState {
  if (state.phase !== "playing") return state;
  const value = typeof valueOrNow === "string" ? 1 : valueOrNow;
  const now = typeof valueOrNow === "string" ? valueOrNow : maybeNow ?? new Date().toISOString();
  const score = state.score + Math.max(1, Math.round(value));
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
  if (state.lives > 1) {
    return {
      ...state,
      lives: state.lives - 1
    };
  }
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
