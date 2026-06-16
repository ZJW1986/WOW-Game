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
  | "asset-pack"
  | "game-config"
  | "qa-report"
  | "publish-record"
  | "iteration-report";

export type AssetType = "image" | "sfx" | "bgm" | "effect" | "ui" | "build";
export type AssetStatus = "missing" | "mock" | "uploaded" | "generated" | "failed";
export type AssetSource = "mock" | "preset" | "uploaded" | "generated";

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
  error?: string;
}

export interface AssetPack {
  versionId: string;
  assets: AssetRequirement[];
}

export interface GameConfig {
  templateFamily: TemplateFamily;
  title: string;
  pitch: string;
  playerGoal: string;
  controls: string[];
  difficulty: "easy" | "normal" | "hard";
  referencedAssetKeys: string[];
  level: {
    width: number;
    height: number;
    collectibles: number;
    hazards: number;
    winScore: number;
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
}

export interface GameVersion {
  id: string;
  label: string;
  status: "draft" | "verified" | "published";
}

export interface MockProject {
  id: string;
  title: string;
  version: GameVersion;
  classification: Classification;
  artifacts: PipelineArtifact[];
  assetPack: AssetPack;
  gameConfig: GameConfig;
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
