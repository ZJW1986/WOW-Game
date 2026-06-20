import type { MockProject, TemplateFamily } from "./types";
import { createStartGameDraft, type StartGameDraft } from "./start";

export type TemplateSource = "official" | "user_project" | "uploaded_reference" | "community";
export type TemplateStatus = "draft" | "verified" | "published" | "rejected";

export interface TemplateRecord {
  templateId: string;
  title: string;
  source: TemplateSource;
  templateFamily: TemplateFamily;
  previewProjectId?: string;
  coverAssetKey: string;
  description: string;
  playableUrl: string;
  tags: string[];
  status: TemplateStatus;
}

const officialTemplates: TemplateRecord[] = [
  {
    templateId: "official-space-dodge",
    title: "飞船躲避收集",
    source: "official",
    templateFamily: "top_down",
    previewProjectId: "template-space-dodge",
    coverAssetKey: "cover.main",
    description: "适合做飞船、角色、宠物在俯视地图中躲避危险并收集目标的小游戏。",
    playableUrl: "/play/template-space-dodge/v1",
    tags: ["俯视角", "躲避", "收集", "快速上手"],
    status: "published"
  },
  {
    templateId: "official-jump-collect",
    title: "平台跳跃收集",
    source: "official",
    templateFamily: "platformer",
    previewProjectId: "template-jump-collect",
    coverAssetKey: "cover.main",
    description: "适合做跳跃、平台、金币、陷阱、到达终点这类横版小游戏。",
    playableUrl: "/play/template-jump-collect/v1",
    tags: ["平台跳跃", "收集", "陷阱", "终点"],
    status: "published"
  },
  {
    templateId: "official-grid-puzzle",
    title: "格子解谜",
    source: "official",
    templateFamily: "grid_logic",
    previewProjectId: "template-grid-puzzle",
    coverAssetKey: "cover.main",
    description: "适合做推箱、路径规划、开关机关、回合制解谜的轻量玩法。",
    playableUrl: "/play/template-grid-puzzle/v1",
    tags: ["解谜", "格子", "机关", "策略"],
    status: "published"
  },
  {
    templateId: "official-route-defense",
    title: "简易塔防守卫",
    source: "official",
    templateFamily: "tower_defense",
    previewProjectId: "template-route-defense",
    coverAssetKey: "cover.main",
    description: "适合做敌人沿路线推进、玩家布置防守、守住基地的第一版塔防。",
    playableUrl: "/play/template-route-defense/v1",
    tags: ["塔防", "路线", "波次", "防守"],
    status: "published"
  }
];

export function getOfficialTemplates(): TemplateRecord[] {
  return officialTemplates;
}

export function findTemplate(templateId: string): TemplateRecord | undefined {
  return officialTemplates.find((template) => template.templateId === templateId);
}

export function startDraftFromTemplate(template: TemplateRecord, idea: string): StartGameDraft {
  const trimmedIdea = idea.trim();
  return createStartGameDraft({
    idea: trimmedIdea
      ? `${trimmedIdea}\n参考模板：${template.title}。${template.description}`
      : `参考模板：${template.title}。${template.description}`,
    templateFamily: template.templateFamily
  });
}

export function canPublishProjectAsTemplate(project: MockProject): boolean {
  const hasConfig = Boolean(project.gameConfig);
  const hasAssetPack = project.assetPack.assets.length > 0;
  const hasHooks = Boolean(project.gameHooks);
  const assetsReady = project.assetPack.assets.every((asset) => asset.status !== "missing" && asset.status !== "failed");
  const healthyEnough = project.qaReport.scores.buildHealth >= 80;
  const runtimeEvidence = project.qaReport.evidence;
  const playableEvidence =
    !runtimeEvidence || (runtimeEvidence.canvasNonEmpty && runtimeEvidence.playerMoved && runtimeEvidence.interactionObserved);
  return hasConfig && hasAssetPack && hasHooks && assetsReady && healthyEnough && playableEvidence;
}
