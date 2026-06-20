export type TemplateFamily =
  | "platformer"
  | "top_down"
  | "grid_logic"
  | "tower_defense"
  | "ui_heavy";

export type PipelineStage =
  | "idea-intake"
  | "guided-questions"
  | "design-brief"
  | "classification"
  | "mature-game-brief"
  | "gdd"
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
  | "gameplay-dsl"
  | "sandbox-plugin"
  | "qa-report"
  | "publish-record"
  | "iteration-report";

export type AssetType = "image" | "sfx" | "bgm" | "effect" | "ui" | "build";
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

export interface PlayableDirector {
  templateFamily: TemplateFamily;
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
  }>;
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

export interface GameplayDsl {
  version: "1";
  rules: GameplayDslRule[];
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
  evidence?: {
    canvasNonEmpty: boolean;
    consoleErrorCount: number;
    screenshotCaptured: boolean;
    playerMoved: boolean;
    interactionObserved: boolean;
  };
}

export interface GameVersion {
  id: string;
  label: string;
  status: "draft" | "verified" | "published";
}

export interface MockProject {
  id: string;
  title: string;
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
