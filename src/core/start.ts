import type { EngineType, TemplateFamily, ThreeGameGenre, UserMaterialSlot, ViewportMode } from "./types";

export type StartModelId = "deepseek-v4-flash" | "gemini-flash" | "mock-designer" | "custom-provider";

export interface StartGameDraft {
  idea: string;
  model: StartModelId;
  engineType: EngineType;
  viewportMode: ViewportMode;
  templateFamily: TemplateFamily;
  threeGameGenre: ThreeGameGenre;
  optimizedPrompt?: string;
  uploadedFileNames: string[];
  uploadedMaterials: StartUploadedMaterial[];
}

export interface StartUploadedMaterial {
  id: string;
  fileName: string;
  fileUrl: string;
  previewUrl: string;
  mimeType: string;
  slot: UserMaterialSlot;
  assetKey: string;
}

export interface StartTemplateTile {
  templateFamily: TemplateFamily;
  icon: string;
  shortLabel: string;
  hint: string;
  visualClass: string;
}

export interface StartThreeGameTypeTile {
  genre: ThreeGameGenre;
  icon: string;
  shortLabel: string;
  hint: string;
  visualClass: string;
}

export const modelOptions: Array<{ id: StartModelId; label: string; description: string }> = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek v4 flash",
    description: "用于策划、分类、标准产物和迭代建议"
  },
  {
    id: "gemini-flash",
    label: "Gemini flash",
    description: "预留 Gemini 接入；当前无 API 时走本地 fallback"
  },
  {
    id: "mock-designer",
    label: "Mock Designer",
    description: "离线模拟生成，适合快速跑通流程"
  },
  {
    id: "custom-provider",
    label: "Custom Provider",
    description: "预留自定义模型接入"
  }
];

export const templateOptions: Array<{ id: TemplateFamily; label: string; description: string }> = [
  { id: "top_down", label: "俯视角", description: "移动、躲避、收集、追逐" },
  { id: "platformer", label: "平台跳跃", description: "重力、跳跃、平台、机关" },
  { id: "grid_logic", label: "格子解谜", description: "棋盘、推箱、回合、消除" },
  { id: "tower_defense", label: "塔防", description: "路线、防守、波次、炮塔" },
  { id: "ui_heavy", label: "经营/卡牌", description: "菜单、卡牌、养成、对话" }
];

export function createStartTemplateTiles(): StartTemplateTile[] {
  return [
    { templateFamily: "top_down", icon: "TD", shortLabel: "俯视角", hint: "躲避收集", visualClass: "type-top-down" },
    { templateFamily: "platformer", icon: "JP", shortLabel: "平台跳跃", hint: "跳跃闯关", visualClass: "type-platformer" },
    { templateFamily: "grid_logic", icon: "GR", shortLabel: "格子解谜", hint: "推演解题", visualClass: "type-grid" },
    { templateFamily: "tower_defense", icon: "DF", shortLabel: "塔防", hint: "路线防守", visualClass: "type-defense" },
    { templateFamily: "ui_heavy", icon: "UI", shortLabel: "经营卡牌", hint: "养成决策", visualClass: "type-ui" }
  ];
}

export function createStartThreeGameTypeTiles(): StartThreeGameTypeTile[] {
  return [
    { genre: "flight_shooter", icon: "FS", shortLabel: "飞行射击", hint: "躲避/射击", visualClass: "type-flight" },
    { genre: "runner", icon: "RN", shortLabel: "3D 跑酷", hint: "冲刺收集", visualClass: "type-runner" },
    { genre: "third_person_collect", icon: "TP", shortLabel: "第三人称", hint: "探索收集", visualClass: "type-third-person" },
    { genre: "exploration", icon: "EX", shortLabel: "探索展示", hint: "场景漫游", visualClass: "type-exploration" }
  ];
}

export function createStartGameDraft(input: {
  idea: string;
  model?: StartModelId;
  engineType?: EngineType;
  viewportMode?: ViewportMode;
  templateFamily?: TemplateFamily;
  threeGameGenre?: ThreeGameGenre;
  optimizedPrompt?: string;
  uploadedFileNames?: string[];
  uploadedMaterials?: StartUploadedMaterial[];
}): StartGameDraft {
  return {
    idea: input.idea,
    model: input.model ?? "deepseek-v4-flash",
    engineType: input.engineType ?? "phaser2d",
    viewportMode: input.viewportMode ?? (input.engineType === "threejs3d" ? "app_9_16" : "web_16_9"),
    templateFamily: input.templateFamily ?? "top_down",
    threeGameGenre: input.threeGameGenre ?? "flight_shooter",
    optimizedPrompt: input.optimizedPrompt,
    uploadedFileNames: input.uploadedFileNames ?? input.uploadedMaterials?.map((material) => material.fileName) ?? [],
    uploadedMaterials: input.uploadedMaterials ?? []
  };
}

export function getGenerationPrompt(draft: StartGameDraft): string {
  return draft.optimizedPrompt?.trim() || draft.idea.trim();
}

export function buildOptimizedGamePrompt(draft: StartGameDraft): string {
  const engine = draft.engineType === "threejs3d" ? "3D Three.js" : "2D Phaser";
  const gameType = draft.engineType === "threejs3d" ? draft.threeGameGenre : draft.templateFamily;
  const viewport = draft.viewportMode === "app_9_16" ? "APP 9:16" : "Web 16:9";
  const model = modelOptions.find((item) => item.id === draft.model)?.label ?? draft.model;
  return [
    `请生成一款 ${engine} 游戏。`,
    `原始创意：${draft.idea.trim() || "玩家输入的游戏创意"}`,
    `游戏类型：${gameType}`,
    `画布比例：${viewport}`,
    `策划模型：${model}`,
    "核心循环：玩家进入后 5 秒内理解目标，通过清晰操作完成移动、躲避、互动、收集推进，并能看到胜利、失败和重开。",
    draft.engineType === "threejs3d"
      ? "3D 要求：明确镜头、空间路线、移动手感、障碍压力、收集奖励、手机触控可读性，并优先使用程序化 MVP 保障可玩。"
      : "2D 要求：明确角色、背景、危险物、收集物、阶段节奏、碰撞反馈，并在生成游戏前完成核心素材确认。",
    "输出要求：玩法目标清楚，前 30 秒有奖励和压力变化，HUD 不遮挡主体，失败要公平，反馈要明显。"
  ].join("\n");
}
