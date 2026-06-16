export type TemplateFamily =
  | "platformer"
  | "top_down"
  | "grid_logic"
  | "tower_defense"
  | "ui_heavy";

export type PipelineStage =
  | "idea-intake"
  | "classification"
  | "gdd"
  | "asset-requirements"
  | "asset-pack"
  | "game-config"
  | "qa-report"
  | "publish-record"
  | "iteration-report";

export type AssetType = "image" | "sfx" | "bgm" | "effect" | "ui" | "build";

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
