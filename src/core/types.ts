export type TemplateFamily =
  | "platformer"
  | "top_down"
  | "grid_logic"
  | "tower_defense"
  | "ui_heavy";

export type EngineType = "phaser2d" | "threejs3d";

export type ViewportMode = "web_16_9" | "app_9_16";

export type ThreeGameGenre =
  | "runner"
  | "dodge_collect"
  | "flight_shooter"
  | "third_person_collect"
  | "exploration"
  | "futuristic_tower_defense";

export type PipelineStage =
  | "idea-intake"
  | "guided-questions"
  | "design-brief"
  | "classification"
  | "mature-game-brief"
  | "game-production-brief"
  | "visual-prompt-pack"
  | "ui-asset-kit"
  | "audio-prompt-pack"
  | "model-prompt-pack"
  | "scene-map-plan"
  | "asset-replacement-report"
  | "cellcog-generation-report"
  | "gdd"
  | "style-sheet"
  | "asset-requirements"
  | "asset-candidates"
  | "confirmed-assets"
  | "asset-style-guide"
  | "asset-pack"
  | "game-config"
  | "game-hooks"
  | "playable-director"
  | "runtime-asset-report"
  | "visual-asset-report"
  | "browser-verification-report"
  | "playability-report"
  | "cover-poster"
  | "three-game-brief"
  | "three-scene-director"
  | "three-asset-plan"
  | "three-asset-pack"
  | "three-verification-report"
  | "gameplay-dsl"
  | "sandbox-plugin"
  | "qa-report"
  | "publish-record"
  | "iteration-report";

export type AssetType = "image" | "sfx" | "bgm" | "effect" | "ui" | "build" | "model" | "texture" | "skybox" | "material" | "audio" | "icon";
export type AssetStatus = "missing" | "mock" | "uploaded" | "generated" | "failed";
export type AssetSource = "mock" | "preset" | "uploaded" | "generated" | "library";

export interface AssetStyleGuide {
  visualStyle: string;
  palette: string[];
  shapeLanguage: string;
  characterBrief: string;
  environmentBrief: string;
  audioStyle: string;
  assetPrompts: Record<string, string>;
}

export interface StyleSheet {
  palette: [string, string, string, string, string];
  brushwork: "pixel_clean" | "cel_shaded" | "painterly" | "low_poly" | "vector_flat";
  lighting: "flat" | "rim" | "soft" | "neon" | "dramatic";
  era: "fantasy" | "modern" | "retro" | "sci_fi" | "nature";
  subjectScale: "tiny" | "small" | "medium" | "large" | "heroic";
  negativePrompt: string;
}

export interface Classification {
  templateFamily: TemplateFamily;
  reasons: string[];
  risks: string[];
  unsupportedRequests: string[];
}

export interface PipelineArtifact {
  stage: PipelineStage;
  fileName: string;
  format: "json" | "md";
  title: string;
  content: unknown;
}

export interface AssetRequirement {
  assetKey: string;
  type: AssetType;
  purpose: string;
  style: string;
  generationMode: "mock" | "model" | "uploaded" | "preset";
  copyrightStatus: "placeholder" | "generated" | "licensed" | "user_provided";
  spec: string;
  status: AssetStatus;
  prompt: string;
  acceptedFileTypes: string[];
  previewUrl: string;
  source: AssetSource;
  fileUrl: string;
  provider: string;
  model: string;
  generationParams: Record<string, string | number | boolean>;
  transparentBackgroundRequired?: boolean;
  targetSize?: string;
  libraryTags?: string[];
  libraryAssetId?: string;
  derivedFromAssetKey?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  error?: string;
}

export interface AssetPack {
  versionId: string;
  assets: AssetRequirement[];
}

export type RuntimeAssetSlotName = "background" | "player" | "hazard" | "collectible";

export interface RuntimeAssetSlotReport {
  slot: RuntimeAssetSlotName;
  assetKey: string;
  provider: string;
  source: AssetSource;
  fileUrl: string;
  status: "bound" | "missing" | "invalid_url" | "failed";
  slotRole: "background" | "sprite";
  runtimeWidth: number;
  runtimeHeight: number;
  error?: string;
}

export interface RuntimeAssetReport {
  ready: boolean;
  slots: RuntimeAssetSlotReport[];
  errors: string[];
}

export interface VisualAssetReport {
  ready: boolean;
  coherenceScore: number;
  coherenceThreshold: number;
  slots: Array<{
    slot: RuntimeAssetSlotName;
    assetKey: string;
    fileUrl: string;
    requiresTransparency: boolean;
    validationStatus: "passed" | "warning" | "failed";
    validationErrors: string[];
    runtimeWidth: number;
    runtimeHeight: number;
  }>;
  errors: string[];
}

export interface BrowserVerificationReport {
  passed: boolean;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
}

export interface CoverPoster {
  fileUrl: string;
  thumbnailUrl: string;
  prompt: string;
  provider: "poster-fallback" | "agnes";
  format: "webp";
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  fallbackUsed: boolean;
}

export interface PlayableDirector {
  templateFamily: TemplateFamily;
  profileId?: string;
  genreMechanics?: string[];
  specialActions?: string[];
  spawnTimeline?: string[];
  progressionRules?: string[];
  playerGoal: string;
  coreAssets: Record<RuntimeAssetSlotName, string>;
  enemyArchetypes: NonNullable<GameHooks["enemyArchetypes"]>;
  stageGoals: NonNullable<GameHooks["stageGoals"]>;
  encounterTimeline: NonNullable<GameHooks["encounterTimeline"]>;
  winCondition: GameHooks["winCondition"];
  failCondition: GameHooks["failCondition"];
  firstMinuteScript: string[];
}

export type UserMaterialSlot = "player" | "background" | "hazard" | "collectible" | "cover" | "bgm" | "sfx";

export interface UserMaterial {
  assetKey: string;
  slot?: UserMaterialSlot;
  fileName: string;
  fileUrl: string;
  previewUrl?: string;
  mimeType: string;
}

export interface DesignBrief {
  coreGameplay: string;
  playerGoal: string;
  referenceTakeaways: string[];
  risks: string[];
  questionFocus: string[];
  developerPrompt: string;
}

export interface MatureGameBrief {
  referencePatternId: string;
  coreLoop: string[];
  firstThirtySeconds: string[];
  visualTheme: string;
  feedbackChecklist: string[];
  difficultyCurve: string[];
  gameFeelMoments: string[];
}

export interface GameProductionBrief {
  engineType: EngineType;
  templateFamily?: TemplateFamily;
  threeGenre?: ThreeGameGenre;
  playerFantasy: string;
  coreLoop: string[];
  innovationHooks: string[];
  firstMinuteExperience: string[];
  difficultyCurve: string[];
  pressureTypes: string[];
  rewardPath: string[];
  failureFeedback: string[];
  restartMotivation: string;
  audioMood: string;
  assetStyle: string;
  stabilityConstraints: string[];
  deferredRequests: string[];
}

export interface VisualPromptPack {
  packId: string;
  engineType: EngineType;
  styleSheet?: StyleSheet;
  prompts: Array<{
    assetKey: string;
    slot: UserMaterialSlot | "poster";
    promptType: "background" | "sprite" | "cover_poster";
    finalImagePrompt: string;
    negativePrompt: string;
    format: "png" | "webp";
    runtimeUse: "candidate_only" | "runtime_after_confirmation";
  }>;
  isolationRules: string[];
}

export interface UiAssetKit {
  packId: string;
  prompts: Array<{
    assetKey: string;
    componentType: "skill_icons" | "buttons" | "hud_panel" | "inventory_slots" | "dialog_frame" | "shop_card";
    finalImagePrompt: string;
    slicingRequired: boolean;
    runtimeEligible: boolean;
  }>;
  sourceSkill: "game-ui-asset-kit";
}

export interface AudioPromptPack {
  packId: string;
  prompts: Array<{
    assetKey: "bgm.loop" | "sfx.collect" | "sfx.hit" | "sfx.win" | "sfx.lose" | "sfx.click" | "sfx.explosion" | "sfx.warning";
    cue: string;
    finalAudioPrompt: string;
    durationSeconds: number;
    loop: boolean;
  }>;
  runtimeStrategy: "procedural_fallback" | "candidate_after_confirmation";
}

export interface ModelPromptPack {
  packId: string;
  engineType: "threejs3d";
  prompts: Array<{
    assetKey: "three.model.player" | "three.model.hazard" | "three.model.collectible" | "three.scene.environment";
    roleInGameplay: string;
    finalModelPrompt: string;
    qualityTier: "builtin_low_poly" | "uploaded" | "tripo_enhanced" | "cellcog_enhanced";
    polyBudget: number;
    maxFileSizeMb: number;
    runtimeScale: number;
    colliderShape: "sphere" | "capsule" | "box";
  }>;
  isolationRules: string[];
}

export interface SceneMapPlan {
  engineType: EngineType;
  layoutMode: string;
  backgroundMode: "scene_cover" | "tileable_map" | "procedural_3d_scene";
  mapScale: string;
  traversalBeats: string[];
  spawnZones: string[];
}

export interface AssetReplacementReport {
  projectId?: string;
  assetKey: string;
  previousFileUrl?: string;
  candidateFileUrl: string;
  status: "candidate_created" | "confirmed" | "rejected";
  reason: string;
  runtimeUpdated: boolean;
}

export interface CellCogGenerationReport {
  provider: "cellcog";
  status: "missing_key" | "queued" | "completed" | "failed" | "timeout";
  promptPackId: string;
  slot: string;
  requestedOutput: "png" | "webp" | "glb" | "mp3" | "html" | "pdf";
  outputFiles: Array<{ fileUrl: string; mimeType: string; assetKey?: string }>;
  errors: string[];
  creditInfo?: string;
}

export interface AssetCandidate {
  slot: UserMaterialSlot;
  assetKey: string;
  type: AssetType;
  label: string;
  prompt: string;
  style: string;
  purpose: string;
  acceptedFileTypes: string[];
  previewUrl: string;
  fileUrl: string;
  source: AssetSource;
  provider?: string;
  model?: string;
  generationParams?: Record<string, string | number | boolean>;
  error?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  slotRole?: "background" | "sprite";
  requiresTransparency?: boolean;
  subjectBounds?: { x: number; y: number; width: number; height: number };
  alphaCoverage?: number;
  validationStatus?: "passed" | "warning" | "failed";
  validationErrors?: string[];
}

export interface AssetCandidates {
  candidates: AssetCandidate[];
}

export interface ConfirmedAssets {
  assets: AssetCandidate[];
}

export interface RevisionAnalysis {
  understoodChange: string;
  updatedDeveloperPrompt: string;
  confirmationQuestions: DesignQuestion[];
  affectedAssets: string[];
  risks: string[];
}

export interface GameConfig {
  templateFamily: TemplateFamily;
  title: string;
  pitch: string;
  playerGoal: string;
  controls: string[];
  difficulty: "easy" | "normal" | "hard";
  referencedAssetKeys: string[];
  gameplay: {
    primaryAction:
      | "dodge_collect"
      | "jump_reach_goal"
      | "solve_grid"
      | "defend_route"
      | "manage_choices";
    enemyBehavior: "static" | "patrol" | "chase" | "wave" | "timer";
    objectiveMode: "collect_score" | "reach_exit" | "survive_timer" | "defend_base" | "solve_state";
    playerAbility: "dash" | "jump" | "push" | "build" | "choose";
    spawnPattern: "fixed" | "staggered" | "lanes" | "grid" | "waves";
  };
  level: {
    width: number;
    height: number;
    collectibles: number;
    hazards: number;
    winScore: number;
  };
}

export interface GameHooks {
  enemyRules: {
    movement: "static" | "patrol" | "chase" | "wave";
    speed: number;
    waveIntervalMs: number;
  };
  collectibleRules: {
    placement: "line" | "arc" | "grid" | "random";
    value: number;
    respawn: boolean;
  };
  winCondition: {
    mode: "collect_score" | "reach_exit" | "survive_timer" | "defend_base" | "solve_state";
    target: number;
  };
  failCondition: {
    mode: "hit_hazard" | "time_out" | "base_destroyed" | "moves_exhausted";
    lives: number;
  };
  numberTuning: {
    playerSpeed: number;
    jumpVelocity: number;
    hazardSpeed: number;
  };
  levelLayout: {
    platforms: Array<{ x: number; y: number; width: number; height: number }>;
    lanes: Array<{ y: number; speed: number; count: number }>;
    grid: { columns: number; rows: number };
    gridState?: number[][];
  };
  levelFlow?: {
    spawnPoint: { x: number; y: number };
    safeZones: Array<{ x: number; y: number; width: number; height: number }>;
    finishZone?: { x: number; y: number; width: number; height: number };
    cameraIntent: string;
    tutorialBeats: string[];
  };
  collisionRules?: {
    collisionRadius: number;
    invulnerabilityMs: number;
    knockbackForce: number;
  };
  feedbackRules?: {
    particleCount: number;
    screenShakeIntensity: number;
    collectBurstCount: number;
    floatingScore?: boolean;
    comboText?: boolean;
    audioCueKeys?: string[];
  };
  spawnRules?: {
    hazardIntervalMs: number;
    maxActiveHazards: number;
  };
  visualLayerRules?: {
    backgroundTreatment: string;
    foregroundProps: string[];
    uiBadgeStyle: string;
  };
  difficultyRules?: {
    hazardRamp: string;
    enemyPacing: string;
    collectibleSpacing: string;
    checkpointPolicy: string;
  };
  enemyArchetypes?: Array<{
    id: string;
    type: "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine";
    count: number;
    speed: number;
    spawnAfterMs: number;
    laneY?: number;
    warningMs?: number;
  }>;
  attackRules?: {
    contactDamage: number;
    dashDamage: number;
    projectileSpeed: number;
    projectileCooldownMs: number;
    explosionRadius: number;
    explosionDelayMs: number;
    warningMs: number;
  };
  stageGoals?: Array<{
    id: string;
    label: string;
    startsAtMs: number;
    durationMs: number;
    objective: "learn_controls" | "collect" | "survive" | "finale";
    target: number;
    enemyMix: string[];
    rewardPacing: "slow" | "normal" | "burst";
    enemySpawnDelta?: number;
    speedMultiplier?: number;
    bgmIntensity?: 0 | 1 | 2 | 3;
  }>;
  scoreTiers?: {
    targetDurationMs: number;
    gold: { minScore: number; maxDeathCount: number; maxDurationMs: number };
    silver: { minScore: number; maxDeathCount: number };
    bronze: { minScore: number };
    rationale: string;
  };
  impactRules?: {
    hitStopMs: number;
    screenShakeIntensity: number;
    explosionParticles: number;
    knockbackForce: number;
    invulnerabilityMs: number;
    comboWindowMs: number;
  };
  encounterTimeline?: Array<{
    atMs: number;
    trigger: "time" | "score";
    event: "spawn_wave" | "spawn_mine" | "projectile_burst" | "reward_burst" | "finale";
    intensity: number;
    message: string;
  }>;
}

export interface GameplayDslRule {
  id: string;
  when: string;
  do: "spawn_wave" | "spawn_mine" | "projectile_burst" | "reward_burst" | "stage_change" | "effect";
  enemyType?: "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine";
  count?: number;
  effect?: "screen_shake" | "explosion" | "collect_burst" | "hit_flash";
  stageId?: string;
  assetKey?: string;
  message?: string;
}

export interface GameplayDslV1 {
  version: "1";
  rules: GameplayDslRule[];
}

export type GameplayDslV2When =
  | { type: "time"; op: "<" | "<=" | "=" | ">=" | ">"; value: number }
  | { type: "score"; op: "<" | "<=" | "=" | ">=" | ">"; value: number }
  | { type: "collected"; assetKey: string; count: number }
  | { type: "enemiesAlive"; op: "<=" | "<" | "="; value: number }
  | { type: "stage"; id: string }
  | { type: "hpBelow"; percent: number }
  | { type: "zoneEntered"; zoneId: string }
  | { type: "combo"; op: ">=" | ">" | "="; value: number };

export type GameplayDslV2Action =
  | { type: "spawn_zone"; zoneId: string; enemyType?: "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine"; count?: number }
  | { type: "open_door"; assetKey: string }
  | { type: "grant_item"; assetKey: string }
  | { type: "set_counter"; name: string; value: number }
  | { type: "change_player_speed"; multiplier?: number; mul?: number }
  | { type: "fail"; message?: string }
  | { type: "win"; message?: string };

export interface GameplayDslV2Rule {
  id: string;
  when: GameplayDslV2When;
  do: GameplayDslV2Action[];
}

export interface GameplayDslV2 {
  version: "2";
  rules: GameplayDslV2Rule[];
  zones?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  counters?: Array<{ name: string; initialValue: number }>;
  items?: Array<{ assetKey: string; grantsCounter?: string; value?: number }>;
}

export type GameplayDsl = GameplayDslV1 | GameplayDslV2;

export type PhaserPluginDirectorAction =
  | {
      id: string;
      type: "spawn_enemy" | "spawn_projectile" | "spawn_item";
      atMs: number;
      count?: number;
      enemyType?: "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine";
      assetKey?: string;
    }
  | {
      id: string;
      type: "moving_platform" | "path_lane";
      atMs: number;
      x?: number;
      y?: number;
      speed?: number;
      count?: number;
    }
  | {
      id: string;
      type: "status_effect";
      atMs: number;
      effect: "slow" | "shield" | "stun" | "speed_boost";
      durationMs: number;
    }
  | {
      id: string;
      type: "camera_shake";
      atMs: number;
      intensity?: number;
    }
  | {
      id: string;
      type: "particles" | "hit_flash" | "ui_update";
      atMs: number;
      message?: string;
    }
  | {
      id: string;
      type: "player_ability";
      ability: "dash" | "shoot" | "jump" | "block" | "interact";
    }
  | {
      id: string;
      type: "custom_code";
      code: string;
    }
  | {
      id: string;
      type: "scene_lifecycle";
      lifecycle: string;
    };

export interface PhaserPluginDirector {
  version: "1";
  profileId: string;
  actions: PhaserPluginDirectorAction[];
}

export interface PhaserPluginValidationReport {
  accepted: boolean;
  errors: string[];
  fallbackLayer: "gameplay-dsl" | "game-hooks";
}

export interface SandboxPlugin {
  version: "1";
  name: string;
  code: string;
  allowedApis: string[];
  referencedAssetKeys: string[];
  fallbackLayer: "gameplay-dsl" | "game-hooks";
}

export interface SandboxValidationResult {
  accepted: boolean;
  errors: string[];
  referencedAssetKeys: string[];
  fallbackLayer: "gameplay-dsl" | "game-hooks";
}

export interface QaReport {
  scores: {
    buildHealth: number;
    visualUsability: number;
    intentAlignment: number;
    firstThirtySeconds?: number;
    visualDepth?: number;
    gameFeel?: number;
  };
  checks: string[];
  debugProtocolEntries: string[];
  gate?: {
    shouldPublish: boolean;
    reasons: string[];
    dimensions: Array<{
      id: string;
      score: number;
      threshold: number;
      gate: boolean;
      passed: boolean;
    }>;
  };
  evidence?: {
    canvasNonEmpty: boolean;
    consoleErrorCount: number;
    screenshotCaptured: boolean;
    playerMoved: boolean;
    interactionObserved: boolean;
  };
}

export interface ThreeGameBrief {
  genre: ThreeGameGenre;
  title: string;
  coreLoop: string[];
  playerFantasy: string;
  mobileFormat: "portrait_9_16" | "landscape_16_9";
  cameraIntent: string;
  movementIntent: string;
  spaceLayout: string;
  interactionFeedback: string[];
  mobileControlPlan: string;
  assetNeeds: string[];
  skillWorkflow: string[];
}

export interface ThreeAssetPlan {
  versionId: string;
  engineType: "threejs3d";
  assets: Array<{
    assetKey: string;
    type: "model" | "texture" | "skybox" | "audio" | "icon";
    provider: "tripo" | "gemini-image" | "elevenlabs" | "procedural-three" | "builtin-three";
    purpose: string;
    prompt: string;
    fallback: boolean;
    qualityTier?: "builtin_low_poly" | "uploaded" | "tripo_enhanced";
    polyBudget?: number;
    maxFileSizeMb?: number;
    runtimeScale?: number;
    colliderShape?: "sphere" | "capsule" | "box";
    preferredSource?: "builtin_low_poly" | "uploaded" | "tripo_enhanced";
  }>;
  requiredApiKeys: string[];
}

export interface ThreeAssetCandidates {
  versionId: string;
  engineType: "threejs3d";
  assets: AssetRequirement[];
}

export interface ConfirmedThreeAssets {
  assets: AssetRequirement[];
}

export interface ThreeSceneDirector {
  version: "1";
  genre: ThreeGameGenre;
  title: string;
  camera: "follow_chase" | "top_down" | "orbit_showcase";
  controls: Array<"keyboard" | "touch_drag" | "touch_buttons">;
  movementMode?: "forward_flight" | "auto_runner" | "free_move" | "explore_scan" | "arena_dodge" | "tower_defense";
  layoutMode?: "flight_corridor" | "lane_track" | "small_arena" | "open_landmarks" | "single_arena" | "defense_path";
  spawnPattern?: "forward_waves" | "lane_gates" | "landmark_clusters" | "discovery_ring" | "timed_bursts" | "tower_waves";
  abilities?: Array<"dash" | "lane_change" | "jump" | "scan" | "boost" | "build_tower" | "upgrade_tower">;
  collisionRules?: {
    hitbox: "sphere" | "capsule" | "box";
    damage: number;
    invincibleMs: number;
    knockback: number;
    nearMiss: boolean;
  };
  feedbackRules?: {
    collectParticles: boolean;
    hitParticles: boolean;
    explosion: boolean;
    screenShake: boolean;
    flash: boolean;
  };
  audioCues?: Array<"collect" | "hit" | "win" | "lose" | "warning" | "explosion">;
  cameraEffects?: {
    shake: boolean;
    speedLines: boolean;
    followSmoothing: number;
  };
  spawnTimeline?: Array<{
    atMs: number;
    event: "spawn_hazard" | "spawn_collectible" | "pressure_wave" | "reward_burst" | "warning";
    count: number;
  }>;
  gameplayDsl?: GameplayDslV2;
  stages?: Array<{
    id: string;
    label: string;
    startsAtMs: number;
    durationMs: number;
    objective: "learn_controls" | "collect" | "survive" | "finale";
  }>;
  player: {
    speed: number;
    radius: number;
    start: { x: number; y: number; z: number };
  };
  world: {
    width: number;
    depth: number;
    skyColor: string;
    groundColor: string;
  };
  objectives: {
    collectTarget: number;
    avoidDamage: boolean;
    timeLimitMs: number;
  };
  enemies: Array<{
    id: string;
    type: "asteroid" | "drone" | "gate";
    behavior: "falling" | "patrol" | "chase" | "orbit";
    count: number;
    speed: number;
  }>;
  feedback: {
    collectPulse: boolean;
    hitShake: boolean;
    proceduralAudio: boolean;
  };
  towerDefense?: {
    pathNodes: Array<{ x: number; z: number }>;
    towers: Array<{
      id: string;
      kind: "laser" | "missile" | "slow";
      cost: number;
      range: number;
      fireRateMs: number;
      damage: number;
      effect?: "slow" | "splash";
    }>;
    waves: Array<{
      id: string;
      startsAtMs: number;
      enemyType: "drone" | "armored" | "runner";
      count: number;
      intervalMs: number;
      health: number;
      speed: number;
      reward: number;
    }>;
    economyRules: { startingEnergy: number; killReward: number };
    baseRules: { baseHealth: number; leakDamage: number };
    buildRules: { buildRadius: number; maxTowers: number };
  };
}

export interface ThreeAssetPack {
  versionId: string;
  assets: AssetRequirement[];
  fallbackProviders: Array<"procedural-three" | "builtin-three" | "agnes" | "gemini-image" | "elevenlabs" | "tripo">;
}

export interface ThreeAssetLoadReport {
  ready: boolean;
  assets: Array<{
    assetKey: string;
    type: AssetType;
    source: AssetSource;
    provider: string;
    fileUrl: string;
    runtimeStatus: "procedural" | "ready" | "browser_pending" | "missing" | "unsupported";
    fallback: boolean;
    error?: string;
  }>;
  errors: string[];
}

export interface ThreeVerificationReport {
  passed: boolean;
  deliveryReady: boolean;
  canvasNonEmpty: boolean;
  inputMoved: boolean;
  mobileViewportChecked: boolean;
  consoleErrorCount: number;
  screenshotCaptured: boolean;
  modelBudgetPassed?: boolean;
  audioFeedbackChecked?: boolean;
  collisionFeedbackChecked?: boolean;
  runtimeEffectsChecked?: boolean;
  genreDifferentiationChecked?: boolean;
  nonTowerGenreContractChecked?: boolean;
  towerDefenseLoopChecked?: boolean;
  towerPlacementChecked?: boolean;
  waveProgressionChecked?: boolean;
  baseDamageChecked?: boolean;
  projectileHitChecked?: boolean;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
  viewports: Array<{ name: "desktop" | "mobile_portrait"; width: number; height: number; checked: boolean }>;
}

export interface GameVersion {
  id: string;
  label: string;
  status: "draft" | "verified" | "published";
}

export interface MockProject {
  id: string;
  title: string;
  engineType?: EngineType;
  contentType: "ai_project" | "uploaded_package";
  editable: boolean;
  shareable: boolean;
  sourceLabel: string;
  version: GameVersion;
  classification: Classification;
  artifacts: PipelineArtifact[];
  assetPack: AssetPack;
  gameConfig: GameConfig;
  gameHooks: GameHooks;
  qaReport: QaReport;
  threeGameBrief?: ThreeGameBrief;
  threeSceneDirector?: ThreeSceneDirector;
  threeAssetPlan?: ThreeAssetPlan;
  threeAssetPack?: ThreeAssetPack;
  threeVerificationReport?: ThreeVerificationReport;
  threeAssetLoadReport?: ThreeAssetLoadReport;
  coverPosterUrl?: string;
  coverThumbnailUrl?: string;
  coverPoster?: CoverPoster;
  playUrl: string;
  feedback: {
    rating: number;
    comment: string;
    iterationSuggestion: string;
  };
}

export type ConversationStage =
  | "idea_intake"
  | "guided_questions"
  | "gdd_review"
  | "asset_review"
  | "build_review"
  | "publish_ready";

export interface ConversationTurn {
  id: string;
  role: "system" | "user" | "assistant";
  stage: ConversationStage;
  content: string;
  modelTaskId?: string;
  createdAt: string;
}

export interface DesignQuestion {
  id: string;
  label: string;
  prompt: string;
  inputType: "single_choice" | "multi_choice" | "short_text" | "number";
  options?: string[];
  defaultAnswer: string;
  required: boolean;
}

export interface UserAnswer {
  questionId: string;
  value: string;
  answeredAt: string;
}

export interface ConversationSession {
  id: string;
  projectId: string;
  idea: string;
  stage: ConversationStage;
  turns: ConversationTurn[];
  questions: DesignQuestion[];
  answers: UserAnswer[];
  currentArtifact?: PipelineArtifact;
}

export interface PublishRecord {
  versionId: string;
  status: "draft" | "published";
  playUrl: string;
  publicUrl: string;
  coverAssetKey: string;
  shareTitle: string;
  shareDescription: string;
  visibility: "private" | "unlisted" | "public";
  publishedAt: string;
}

export interface PlayFeedback {
  versionId: string;
  rating: number;
  comment: string;
  playerName: string;
  iterationSuggestion: string;
  createdAt: string;
}

export interface ReferencePackageSummary {
  projectId: string;
  versionId: string;
  packageName: string;
  packageFileName: string;
  fileCount: number;
  totalSize: number;
  healthStatus: "pass" | "warning" | "fail";
  entry: string;
  scripts: string[];
  styles: string[];
  images: UploadedPackageFile[];
  audio: UploadedPackageFile[];
  fonts: UploadedPackageFile[];
  data: UploadedPackageFile[];
  suggestedEdits: string[];
  risks: string[];
}

export interface UploadedPackageFile {
  path: string;
  size: number;
  type: "html" | "script" | "style" | "image" | "audio" | "font" | "data" | "other";
}

export interface UploadedPackageManifest {
  packageName: string;
  packageFileName: string;
  projectId: string;
  versionId: string;
  entry: string;
  fileCount: number;
  totalSize: number;
  playable: boolean;
  files: UploadedPackageFile[];
}

export interface UploadedAssetIndex {
  images: UploadedPackageFile[];
  audio: UploadedPackageFile[];
  fonts: UploadedPackageFile[];
  data: UploadedPackageFile[];
  scripts: UploadedPackageFile[];
  styles: UploadedPackageFile[];
}

export interface RuntimeEntry {
  entry: string;
  entryUrl: string;
  scripts: string[];
  styles: string[];
  images: string[];
  audio: string[];
}

export interface PackageHealthReport {
  status: "pass" | "warning" | "fail";
  checks: string[];
  errors: string[];
  warnings: string[];
}

export interface AiPackageEditPlan {
  summary: string;
  editableAssets: UploadedPackageFile[];
  suggestedEdits: string[];
  risks: string[];
}

export interface UploadedPackageArtifacts {
  packageManifest: UploadedPackageManifest;
  assetIndex: UploadedAssetIndex;
  runtimeEntry: RuntimeEntry;
  healthReport: PackageHealthReport;
  aiEditPlan: AiPackageEditPlan;
}
