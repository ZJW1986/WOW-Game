import type { TemplateFamily, UserMaterialSlot } from "./types";

export type StartModelId = "deepseek-v4-flash" | "mock-designer" | "custom-provider";

export interface StartGameDraft {
  idea: string;
  model: StartModelId;
  templateFamily: TemplateFamily;
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
}

export const modelOptions: Array<{ id: StartModelId; label: string; description: string }> = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek v4 flash",
    description: "用于策划、分类、标准产物和迭代建议"
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
    { templateFamily: "top_down", icon: "TD", shortLabel: "俯视角", hint: "躲避收集" },
    { templateFamily: "platformer", icon: "JP", shortLabel: "平台跳跃", hint: "跳跃闯关" },
    { templateFamily: "grid_logic", icon: "GR", shortLabel: "格子解谜", hint: "推演解题" },
    { templateFamily: "tower_defense", icon: "DF", shortLabel: "塔防", hint: "路线防守" },
    { templateFamily: "ui_heavy", icon: "UI", shortLabel: "经营卡牌", hint: "养成决策" }
  ];
}

export function createStartGameDraft(input: {
  idea: string;
  model?: StartModelId;
  templateFamily?: TemplateFamily;
  uploadedFileNames?: string[];
  uploadedMaterials?: StartUploadedMaterial[];
}): StartGameDraft {
  return {
    idea: input.idea,
    model: input.model ?? "deepseek-v4-flash",
    templateFamily: input.templateFamily ?? "top_down",
    uploadedFileNames: input.uploadedFileNames ?? input.uploadedMaterials?.map((material) => material.fileName) ?? [],
    uploadedMaterials: input.uploadedMaterials ?? []
  };
}
