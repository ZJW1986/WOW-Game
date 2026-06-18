export type TemplateFamily =
  | "platformer"
  | "top_down"
  | "grid_logic"
  | "tower_defense"
  | "ui_heavy";

export type PipelineStage =
  | "idea-intake"
  | "guided-questions"
  | "classification"
  | "gdd"
  | "asset-requirements"
  | "asset-style-guide"
  | "asset-pack"
  | "game-config"
  | "game-hooks"
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

export type UserMaterialSlot = "player" | "background" | "hazard" | "collectible" | "cover";

export interface UserMaterial {
  assetKey: string;
  slot?: UserMaterialSlot;
  fileName: string;
  fileUrl: string;
  previewUrl?: string;
  mimeType: string;
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
}

export interface QaReport {
  scores: {
    buildHealth: number;
    visualUsability: number;
    intentAlignment: number;
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
