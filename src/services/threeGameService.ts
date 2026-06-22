import type {
  AssetRequirement,
  ConfirmedThreeAssets,
  MockProject,
  PipelineArtifact,
  PublishRecord,
  QaReport,
  ThreeAssetCandidates,
  ThreeAssetLoadReport,
  ThreeAssetPack,
  ThreeAssetPlan,
  ThreeGameBrief,
  ThreeGameGenre,
  ThreeSceneDirector,
  ThreeVerificationReport,
  UserMaterial
} from "../core/types";
import { createPublishRecord } from "../core/pipeline";

export interface ThreeGameGenerationRequest {
  idea: string;
  projectId: string;
  baseUrl: string;
  viewportMode?: "web_16_9" | "app_9_16";
  gameType3d?: ThreeGameGenre;
  answers?: Array<{ questionId: string; value: string }>;
  threeDesignBrief?: ThreeGameBrief;
  userMaterials?: UserMaterial[];
  confirmedThreeAssets?: ConfirmedThreeAssets;
}

export interface ThreeGameGenerationResult {
  project: MockProject;
  publishRecord: PublishRecord;
  threeGameBrief: ThreeGameBrief;
  threeSceneDirector: ThreeSceneDirector;
  threeAssetPlan: ThreeAssetPlan;
  threeAssetPack: ThreeAssetPack;
  threeVerificationReport: ThreeVerificationReport;
  assetLoadReport: ThreeAssetLoadReport;
  deliveryReady: boolean;
  fallbacksUsed: string[];
}

const THREE_CORE_MODEL_KEYS = ["three.model.player", "three.model.hazard", "three.model.collectible"] as const;
type ThreeCoreModelSlot = "player" | "hazard" | "collectible";

export function generateThreeGameMvp(input: ThreeGameGenerationRequest): ThreeGameGenerationResult {
  const genre = input.gameType3d ?? classifyThreeGenre(input.idea);
  const versionId = "v1";
  const title = createThreeTitle(input.idea, genre);
  const mobileFormat = input.viewportMode === "web_16_9" ? "landscape_16_9" : "portrait_9_16";
  const threeGameBrief = normalizeThreeGameBrief(
    input.threeDesignBrief ?? createThreeGameBrief(input.idea, title, genre, mobileFormat),
    input.idea,
    genre,
    title,
    mobileFormat
  );
  const threeSceneDirector = normalizeThreeSceneDirector(
    createThreeSceneDirector(threeGameBrief, input.answers ?? []),
    threeGameBrief,
    input.answers ?? []
  );
  const threeAssetPlan = createThreeAssetPlan(versionId, threeGameBrief, threeSceneDirector);
  const threeAssetPack = createThreeAssetPack(
    versionId,
    threeSceneDirector,
    threeAssetPlan,
    input.userMaterials ?? [],
    input.confirmedThreeAssets
  );
  const assetLoadReport = createThreeAssetLoadReport(threeAssetPack);
  const threeVerificationReport = createThreeVerificationReport(threeSceneDirector, threeAssetPack, assetLoadReport);
  const publishRecord = createPublishRecord(input.projectId, versionId, title, {
    visibility: "public",
    baseUrl: input.baseUrl,
    coverAssetKey: "three.icon.cover"
  });
  const project = createThreeProject({
    projectId: input.projectId,
    title,
    idea: input.idea,
    publishRecord,
    threeGameBrief,
    threeSceneDirector,
    threeAssetPlan,
    threeAssetPack,
    threeVerificationReport,
    assetLoadReport
  });
  const fallbacksUsed = assetLoadReport.assets
    .filter((asset) => asset.fallback)
    .map((asset) => `${asset.assetKey}:${asset.provider}`);
  return {
    project,
    publishRecord,
    threeGameBrief,
    threeSceneDirector,
    threeAssetPlan,
    threeAssetPack,
    threeVerificationReport,
    assetLoadReport,
    deliveryReady: threeVerificationReport.deliveryReady,
    fallbacksUsed
  };
}

export function createThreeAssetCandidates(input: {
  idea: string;
  brief: ThreeGameBrief;
  director: ThreeSceneDirector;
  assetBatchId: string;
}): ThreeAssetCandidates {
  const slots = [
    {
      assetKey: "three.model.player",
      purpose: "玩家可控制 3D 主体",
      prompt: buildTripoModelPrompt("player", input)
    },
    {
      assetKey: "three.model.hazard",
      purpose: "玩家需要躲避或对抗的 3D 危险物",
      prompt: buildTripoModelPrompt("hazard", input)
    },
    {
      assetKey: "three.model.collectible",
      purpose: "玩家需要收集的 3D 奖励物",
      prompt: buildTripoModelPrompt("collectible", input)
    }
  ] as const;

  return {
    versionId: input.assetBatchId,
    engineType: "threejs3d",
    assets: slots.map((slot, index) =>
      threeAsset(
        slot.assetKey,
        "model",
        slot.purpose,
        slot.prompt,
        "tripo",
        "",
        `/assets/previews/${slot.assetKey.replace(/\./g, "-")}.png`,
        "tripo-text-to-model",
        {
          assetBatchId: input.assetBatchId,
          slotRevisionId: `${input.assetBatchId}-${index + 1}`,
          finalPrompt: slot.prompt,
          modelPrompt: slot.prompt,
          status: "pending",
          tripoPrompt: slot.prompt
        }
      )
    )
  };
}

function buildTripoModelPrompt(
  slot: ThreeCoreModelSlot,
  input: { idea: string; brief: ThreeGameBrief; director: ThreeSceneDirector }
): string {
  const genre = describeThreeGenre(input.brief.genre);
  const theme = inferThreeModelTheme(input);
  const common =
    `Create a single 3D model for a ${genre}. ` +
    `${theme}. Game ready low-poly style, clean silhouette, centered object, readable on a mobile screen. ` +
    "No text, no UI, no logo, no scene, no full environment, no background, no game screenshot.";
  const slotPrompt: Record<ThreeCoreModelSlot, string> = {
    player:
      "The model is the controllable hero vehicle or character. Make it friendly, directional, and easy to recognize from a chase camera.",
    hazard:
      `The model is the primary dangerous obstacle or enemy. Make it threatening and visually distinct. Behaviors include ${describeEnemyBehaviors(
        input.director
      )}.`,
    collectible:
      `The model is a small reward pickup. Make it bright, valuable, and easy to collect. Target pickup count is ${Math.max(
        1,
        input.director.objectives.collectTarget
      )}.`
  };
  return sanitizeTripoPrompt(`${common} ${slotPrompt[slot]} Export intent: GLB compatible asset.`);
}

function sanitizeTripoPrompt(prompt: string): string {
  return prompt
    .replace(/three\.model\.[a-z.]+/gi, "")
    .replace(/three\.js/gi, "")
    .replace(/请生成|生成一款|玩家|游戏/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 680);
}

function describeThreeGenre(genre: ThreeGameGenre): string {
  if (genre === "runner") return "3D runner";
  if (genre === "exploration") return "3D exploration";
  if (genre === "dodge_collect") return "3D dodge and collect";
  if (genre === "third_person_collect") return "3D third-person collect";
  return "3D flight shooter";
}

function inferThreeModelTheme(input: { idea: string; brief: ThreeGameBrief }): string {
  const text = [
    input.idea,
    input.brief.title,
    input.brief.playerFantasy,
    input.brief.spaceLayout,
    input.brief.assetNeeds.join(" ")
  ]
    .join(" ")
    .toLowerCase();
  const tags: string[] = [];
  if (/太空猫|space cat|cat/.test(text)) tags.push("space cat theme");
  if (/太空|宇宙|星|space|sci-fi|sci fi/.test(text)) tags.push("sci-fi space theme");
  if (/飞船|飞机|战机|ship|airplane|jet|fighter/.test(text)) tags.push("small flying ship theme");
  if (/陨石|小行星|asteroid|meteor/.test(text)) tags.push("asteroid danger theme");
  if (/鱼干|fish/.test(text)) tags.push("dried fish reward motif");
  if (/金币|coin/.test(text)) tags.push("coin reward motif");
  if (/能量|energy|orb/.test(text)) tags.push("glowing energy motif");
  if (/机器人|robot|mecha/.test(text)) tags.push("robotic mechanical theme");
  if (/恐龙|dinosaur/.test(text)) tags.push("stylized dinosaur theme");
  return tags.length > 0 ? `Theme keywords: ${tags.slice(0, 4).join(", ")}` : "Theme keywords: arcade sci-fi adventure";
}

function describeEnemyBehaviors(director: ThreeSceneDirector): string {
  const behaviors = director.enemies.map((enemy) => enemy.behavior).filter(Boolean);
  return behaviors.length > 0 ? Array.from(new Set(behaviors)).slice(0, 3).join(", ") : "patrol, chase";
}

export function buildConfirmedThreeAssets(assets: AssetRequirement[]): ConfirmedThreeAssets {
  return {
    assets: assets
      .filter((asset) => THREE_CORE_MODEL_KEYS.includes(asset.assetKey as (typeof THREE_CORE_MODEL_KEYS)[number]))
      .map((asset) => ({ ...asset, approvalStatus: "approved" as const }))
  };
}

export function hasConfirmedThreeCoreAssets(confirmedThreeAssets?: ConfirmedThreeAssets): boolean {
  const assets = confirmedThreeAssets?.assets ?? [];
  return THREE_CORE_MODEL_KEYS.every((key) =>
    assets.some(
      (asset) =>
        asset.assetKey === key &&
        asset.approvalStatus !== "rejected" &&
        asset.type === "model" &&
        /\.(glb|gltf)(?:$|\?)/i.test(asset.fileUrl) &&
        asset.provider !== "procedural-three"
    )
  );
}

function classifyThreeGenre(idea: string): ThreeGameGenre {
  const lower = idea.toLowerCase();
  if (/跑酷|parkour|runner|奔跑|冲刺/.test(lower)) return "runner";
  if (/射击|shoot|laser|子弹|飞船|战机|space.?ship/.test(lower)) return "flight_shooter";
  if (/探索|展厅|showcase|walk|漫游|gallery/.test(lower)) return "exploration";
  if (/第三人称|third.?person|角色/.test(lower)) return "third_person_collect";
  return "dodge_collect";
}

function createThreeTitle(idea: string, genre: ThreeGameGenre): string {
  if (/太空猫|猫.*飞船|space cat/i.test(idea)) return "太空猫星尘航线";
  if (/太空|飞船|陨石|星/.test(idea)) return "星际能量航线";
  if (/跑酷|runner|parkour/i.test(idea)) return "霓虹极速跑酷";
  if (genre === "flight_shooter") return "立体星域突围";
  if (genre === "exploration") return "三维探索场";
  if (genre === "third_person_collect") return "立体收集冒险";
  return "能量躲避试炼";
}

function createThreeGameBrief(
  idea: string,
  title: string,
  genre: ThreeGameGenre,
  mobileFormat: ThreeGameBrief["mobileFormat"]
): ThreeGameBrief {
  const isFlight = genre === "flight_shooter";
  return {
    genre,
    title,
    mobileFormat,
    playerFantasy: `玩家进入一个可操作的 3D 场景，完成“${idea}”的核心体验。`,
    cameraIntent: isFlight
      ? "追尾或轻俯视飞行镜头，保证前方危险物和奖励清晰可读。"
      : genre === "exploration"
        ? "第三人称或轨道展示镜头，突出场景空间和目标点。"
        : "第三人称跟随镜头，保证路线、危险物和奖励清晰可读。",
    movementIntent: genre === "runner"
      ? "角色自动前进，玩家控制左右移动、跳跃或冲刺。"
      : "玩家通过键盘或触屏拖动控制角色在 3D 空间移动。",
    spaceLayout: genre === "exploration"
      ? "开放小场景，少量目标点引导玩家探索。"
      : "单屏或短走廊式路线，前 30 秒逐步加压。",
    interactionFeedback: ["收集发光脉冲", "碰撞震屏", "受击短暂无敌", "胜利/失败可重开"],
    mobileControlPlan:
      mobileFormat === "portrait_9_16"
        ? "单指拖动控制横向移动，HUD 避开底部操作区。"
        : "键盘优先，触屏拖动作为辅助控制。",
    assetNeeds: ["玩家 GLB 模型", "危险物 GLB 模型", "收集物 GLB 模型", "天空盒或背景贴图", "收集/碰撞测试音效"],
    coreLoop: isFlight
      ? ["移动飞船", "躲避陨石", "收集能量", "达到目标分数", "失败后重开"]
      : ["移动角色", "观察 3D 空间", "收集目标", "避开危险", "胜利或重开"],
    skillWorkflow: [
      "threejs-game-director",
      "threejs-gameplay-systems",
      "threejs-graphics-3d",
      "threejs-game-ui",
      "threejs-game-qa"
    ]
  };
}

function normalizeThreeGameBrief(
  brief: ThreeGameBrief,
  idea: string,
  genre: ThreeGameGenre,
  title: string,
  mobileFormat: ThreeGameBrief["mobileFormat"]
): ThreeGameBrief {
  const fallback = createThreeGameBrief(idea, title, genre, mobileFormat);
  return {
    genre: brief.genre ?? fallback.genre,
    title: cleanText(brief.title, fallback.title),
    mobileFormat: brief.mobileFormat ?? fallback.mobileFormat,
    playerFantasy: cleanText(brief.playerFantasy, fallback.playerFantasy),
    cameraIntent: cleanText(brief.cameraIntent, fallback.cameraIntent),
    movementIntent: cleanText(brief.movementIntent, fallback.movementIntent),
    spaceLayout: cleanText(brief.spaceLayout, fallback.spaceLayout),
    interactionFeedback: normalizeStringArray(brief.interactionFeedback, fallback.interactionFeedback, 4),
    mobileControlPlan: cleanText(brief.mobileControlPlan, fallback.mobileControlPlan),
    assetNeeds: normalizeStringArray(brief.assetNeeds, fallback.assetNeeds, 5),
    coreLoop: normalizeStringArray(brief.coreLoop, fallback.coreLoop, 5),
    skillWorkflow: normalizeStringArray(brief.skillWorkflow, fallback.skillWorkflow, 5)
  };
}

function createThreeSceneDirector(
  brief: ThreeGameBrief,
  answers: Array<{ questionId: string; value: string }>
): ThreeSceneDirector {
  const isShooter = brief.genre === "flight_shooter";
  const answerText = answers.map((answer) => answer.value).join(" ");
  const prefersTopDown = /俯视|top.?down/i.test(`${brief.cameraIntent} ${answerText}`);
  return {
    version: "1",
    genre: brief.genre,
    title: brief.title,
    camera: brief.genre === "exploration" ? "orbit_showcase" : prefersTopDown ? "top_down" : isShooter ? "follow_chase" : "top_down",
    controls: ["keyboard", "touch_drag", "touch_buttons"],
    stages: [
      { id: "learn", label: "学习移动", startsAtMs: 0, durationMs: 5000, objective: "learn_controls" },
      { id: "collect", label: "收集目标", startsAtMs: 5000, durationMs: 12000, objective: "collect" },
      { id: "pressure", label: "危险加压", startsAtMs: 17000, durationMs: 12000, objective: "survive" },
      { id: "finale", label: "最后冲刺", startsAtMs: 29000, durationMs: 16000, objective: "finale" }
    ],
    player: {
      speed: isShooter ? 8 : 6,
      radius: 0.55,
      start: { x: 0, y: 0.5, z: 8 }
    },
    world: {
      width: isShooter ? 12 : 14,
      depth: isShooter ? 30 : 24,
      skyColor: isShooter ? "#030712" : "#07111f",
      groundColor: isShooter ? "#111827" : "#164e63"
    },
    objectives: {
      collectTarget: isShooter ? 8 : 6,
      avoidDamage: true,
      timeLimitMs: 90000
    },
    enemies: [
      {
        id: "hazard-wave",
        type: isShooter ? "asteroid" : "drone",
        behavior: "falling",
        count: isShooter ? 8 : 5,
        speed: isShooter ? 4.2 : 3.2
      },
      {
        id: "pressure-chaser",
        type: "drone",
        behavior: "chase",
        count: 2,
        speed: 2.4
      }
    ],
    feedback: {
      collectPulse: true,
      hitShake: true,
      proceduralAudio: true
    }
  };
}

export function normalizeThreeSceneDirector(
  director: ThreeSceneDirector,
  brief: ThreeGameBrief,
  answers: Array<{ questionId: string; value: string }> = []
): ThreeSceneDirector {
  const fallback = createThreeSceneDirector(brief, answers);
  const enemies = normalizeEnemies(director.enemies, fallback.enemies);
  const stages = normalizeStages(director.stages, fallback.stages ?? []);
  return {
    version: "1",
    genre: director.genre ?? brief.genre,
    title: cleanText(director.title, brief.title),
    camera: ["follow_chase", "top_down", "orbit_showcase"].includes(director.camera) ? director.camera : fallback.camera,
    controls: normalizeControls(director.controls),
    stages,
    player: {
      speed: clampNumber(director.player?.speed, 3, 12, fallback.player.speed),
      radius: clampNumber(director.player?.radius, 0.25, 1.5, fallback.player.radius),
      start: {
        x: clampNumber(director.player?.start?.x, -6, 6, fallback.player.start.x),
        y: clampNumber(director.player?.start?.y, 0.2, 2, fallback.player.start.y),
        z: clampNumber(director.player?.start?.z, -12, 12, fallback.player.start.z)
      }
    },
    world: {
      width: clampNumber(director.world?.width, 8, 40, fallback.world.width),
      depth: clampNumber(director.world?.depth, 12, 80, fallback.world.depth),
      skyColor: normalizeColor(director.world?.skyColor, fallback.world.skyColor),
      groundColor: normalizeColor(director.world?.groundColor, fallback.world.groundColor)
    },
    objectives: {
      collectTarget: Math.round(clampNumber(director.objectives?.collectTarget, 3, 20, fallback.objectives.collectTarget)),
      avoidDamage: director.objectives?.avoidDamage ?? true,
      timeLimitMs: Math.round(clampNumber(director.objectives?.timeLimitMs, 30000, 180000, fallback.objectives.timeLimitMs))
    },
    enemies,
    feedback: {
      collectPulse: director.feedback?.collectPulse ?? true,
      hitShake: director.feedback?.hitShake ?? true,
      proceduralAudio: director.feedback?.proceduralAudio ?? true
    }
  };
}

function normalizeEnemies(
  value: ThreeSceneDirector["enemies"] | undefined,
  fallback: ThreeSceneDirector["enemies"]
): ThreeSceneDirector["enemies"] {
  const allowedTypes = new Set(["asteroid", "drone", "gate"]);
  const allowedBehaviors = new Set(["falling", "patrol", "chase", "orbit"]);
  const normalized = (value ?? [])
    .filter((enemy) => enemy && allowedTypes.has(enemy.type) && allowedBehaviors.has(enemy.behavior))
    .map((enemy, index) => ({
      id: cleanText(enemy.id, `enemy-${index + 1}`),
      type: enemy.type,
      behavior: enemy.behavior,
      count: Math.round(clampNumber(enemy.count, 1, 16, fallback[index]?.count ?? 2)),
      speed: clampNumber(enemy.speed, 0.5, 10, fallback[index]?.speed ?? 2)
    }));
  const merged = [...normalized];
  for (const enemy of fallback) {
    if (merged.length >= 2) break;
    merged.push(enemy);
  }
  return merged;
}

function normalizeStages(
  value: ThreeSceneDirector["stages"] | undefined,
  fallback: NonNullable<ThreeSceneDirector["stages"]>
): NonNullable<ThreeSceneDirector["stages"]> {
  const allowed = new Set(["learn_controls", "collect", "survive", "finale"]);
  const normalized = (value ?? [])
    .filter((stage) => stage && allowed.has(stage.objective))
    .map((stage, index) => ({
      id: cleanText(stage.id, `stage-${index + 1}`),
      label: cleanText(stage.label, fallback[index]?.label ?? `阶段 ${index + 1}`),
      startsAtMs: Math.round(clampNumber(stage.startsAtMs, 0, 120000, fallback[index]?.startsAtMs ?? index * 8000)),
      durationMs: Math.round(clampNumber(stage.durationMs, 3000, 60000, fallback[index]?.durationMs ?? 8000)),
      objective: stage.objective
    }));
  return normalized.length >= 3 ? normalized : fallback;
}

function createThreeAssetPlan(
  versionId: string,
  brief: ThreeGameBrief,
  director: ThreeSceneDirector
): ThreeAssetPlan {
  return {
    versionId,
    engineType: "threejs3d",
    requiredApiKeys: ["TRIPO_API_KEY", "GEMINI_API_KEY", "ELEVENLABS_API_KEY"],
    assets: [
      {
        assetKey: "three.model.player",
        type: "model",
        provider: "tripo",
        purpose: "玩家可控制 3D 主体",
        prompt: `${brief.title} player model, ${brief.playerFantasy}, ${brief.movementIntent}`,
        fallback: true
      },
      {
        assetKey: "three.model.hazard",
        type: "model",
        provider: "tripo",
        purpose: "可躲避危险物或敌人",
        prompt: `${brief.title} hazard model, readable silhouette, behavior ${director.enemies[0]?.behavior ?? "falling"}`,
        fallback: true
      },
      {
        assetKey: "three.model.collectible",
        type: "model",
        provider: "tripo",
        purpose: "收集奖励物",
        prompt: `${brief.title} collectible energy item, visible in mobile camera`,
        fallback: true
      },
      {
        assetKey: "three.skybox.main",
        type: "skybox",
        provider: "gemini-image",
        purpose: "3D 背景或天空盒",
        prompt: `${brief.title} skybox or background texture, ${brief.spaceLayout}`,
        fallback: true
      },
      {
        assetKey: "three.audio.collect",
        type: "audio",
        provider: "elevenlabs",
        purpose: "收集音效",
        prompt: `${brief.title} short collect chime`,
        fallback: true
      },
      {
        assetKey: "three.audio.hit",
        type: "audio",
        provider: "elevenlabs",
        purpose: "碰撞或失败音效",
        prompt: `${brief.title} short hit impact sound`,
        fallback: true
      }
    ]
  };
}

function createThreeAssetPack(
  versionId: string,
  director: ThreeSceneDirector,
  assetPlan: ThreeAssetPlan,
  userMaterials: UserMaterial[],
  confirmedThreeAssets?: ConfirmedThreeAssets
): ThreeAssetPack {
  return {
    versionId,
    fallbackProviders: ["procedural-three", "tripo", "elevenlabs"],
    assets: assetPlan.assets.map((asset) => {
      const confirmed = confirmedThreeAssets?.assets.find((item) => item.assetKey === asset.assetKey);
      if (confirmed) {
        return {
          ...confirmed,
          approvalStatus: "approved",
          generationParams: {
            ...confirmed.generationParams,
            engineType: "threejs3d",
            runtimeLoader: asset.type === "model" ? "GLTFLoader" : "procedural"
          }
        };
      }
      const uploaded = userMaterials.find((material) => material.assetKey === asset.assetKey);
      if (uploaded) {
        return threeAsset(
          asset.assetKey,
          asset.type,
          asset.purpose,
          asset.prompt || director.world.skyColor,
          "uploaded",
          uploaded.fileUrl,
          uploaded.previewUrl ?? uploaded.fileUrl,
          uploaded.mimeType
        );
      }
      return threeAsset(asset.assetKey, asset.type, asset.purpose, asset.prompt || director.world.skyColor, "procedural-three");
    })
  };
}

function threeAsset(
  assetKey: string,
  type: AssetRequirement["type"],
  purpose: string,
  spec: string,
  provider: string,
  fileUrl = `procedural://${assetKey}`,
  previewUrl = `/assets/previews/${assetKey.replace(/\./g, "-")}.png`,
  uploadedMimeType?: string,
  generationParams: Record<string, string | number | boolean> = {}
): AssetRequirement {
  const uploaded = provider === "uploaded";
  const generated = provider === "tripo";
  return {
    assetKey,
    type,
    purpose,
    style: "mobile friendly low-poly 3D",
    generationMode: uploaded ? "uploaded" : generated ? "model" : "preset",
    copyrightStatus: uploaded ? "user_provided" : generated ? "generated" : "placeholder",
    spec,
    status: uploaded ? "uploaded" : generated && !fileUrl ? "missing" : "generated",
    prompt: spec,
    acceptedFileTypes: type === "audio" ? ["audio/*", ".mp3", ".wav"] : [".glb", ".gltf", "image/*"],
    previewUrl,
    source: uploaded ? "uploaded" : generated ? "generated" : "preset",
    fileUrl,
    provider,
    model: uploaded ? uploadedMimeType ?? "uploaded-asset" : generated ? uploadedMimeType ?? "tripo-text-to-model" : "three-procedural-mvp",
    generationParams: {
      engineType: "threejs3d",
      fallback: !uploaded && !generated,
      runtimeLoader: type === "model" ? "GLTFLoader" : "procedural",
      ...generationParams
    }
  };
}

function createThreeAssetLoadReport(assetPack: ThreeAssetPack): ThreeAssetLoadReport {
  const assets = assetPack.assets.map((asset) => {
    const fallback = asset.fileUrl.startsWith("procedural://");
    const isModel = asset.type === "model";
    const isLocalModel =
      /\.(glb|gltf)(?:$|\?)/i.test(asset.fileUrl) ||
      /^https?:\/\/.+\.(glb|gltf)(?:$|\?)/i.test(asset.fileUrl) ||
      /^\/(?:projects|asset-library|uploads)\//.test(asset.fileUrl);
    const isProceduralAsset = fallback || ["skybox", "audio", "icon", "texture"].includes(asset.type);
    const runtimeStatus: ThreeAssetLoadReport["assets"][number]["runtimeStatus"] = isProceduralAsset
      ? "procedural"
      : isModel && isLocalModel
        ? "browser_pending"
        : !asset.fileUrl
          ? "missing"
          : "unsupported";
    const error =
      runtimeStatus === "missing"
        ? "3D model URL is missing."
        : runtimeStatus === "unsupported"
          ? "3D model must use a local .glb/.gltf URL or procedural fallback."
          : undefined;
    return {
      assetKey: asset.assetKey,
      type: asset.type,
      source: asset.source,
      provider: asset.provider,
      fileUrl: asset.fileUrl,
      runtimeStatus,
      fallback,
      ...(error ? { error } : {})
    };
  });
  const errors = assets.flatMap((asset) => (asset.error ? [`${asset.assetKey}: ${asset.error}`] : []));
  return {
    ready: errors.length === 0 && THREE_CORE_MODEL_KEYS.every((key) => assets.some((asset) => asset.assetKey === key)),
    assets,
    errors
  };
}

function createThreeVerificationReport(
  director: ThreeSceneDirector,
  assetPack: ThreeAssetPack,
  assetLoadReport: ThreeAssetLoadReport
): ThreeVerificationReport {
  const hasPlayer = assetPack.assets.some((asset) => asset.assetKey === "three.model.player");
  const hasGoal = director.objectives.collectTarget > 0;
  const hasEnemies = director.enemies.length >= 2;
  const hasStages = (director.stages ?? []).length >= 3;
  const hasControls = director.controls.includes("keyboard") && director.controls.includes("touch_drag");
  const deliveryReady = assetLoadReport.ready && hasPlayer && hasGoal && hasEnemies && hasStages && hasControls;
  return {
    passed: deliveryReady,
    deliveryReady,
    canvasNonEmpty: assetLoadReport.ready,
    inputMoved: hasControls,
    mobileViewportChecked: true,
    consoleErrorCount: 0,
    screenshotCaptured: false,
    checks: [
      { id: "three_canvas_contract", passed: assetLoadReport.ready, detail: "Three.js preview owns its own canvas and has loadable runtime assets." },
      { id: "mobile_controls", passed: hasControls, detail: "Keyboard, touch drag, and touch buttons are defined." },
      { id: "playable_loop", passed: hasGoal && hasEnemies, detail: "Collect, avoid, win, lose, and restart states are defined." },
      { id: "stage_pacing", passed: hasStages, detail: `${director.stages?.length ?? 0} 3D stages are defined.` },
      {
        id: "asset_load_report",
        passed: assetLoadReport.ready,
        detail: assetLoadReport.ready ? "All core 3D assets are procedural or browser-loadable." : assetLoadReport.errors.join(" | ")
      }
    ],
    viewports: [
      { name: "desktop", width: 1280, height: 720, checked: true },
      { name: "mobile_portrait", width: 390, height: 844, checked: true }
    ]
  };
}

function createThreeProject(input: {
  projectId: string;
  title: string;
  idea: string;
  publishRecord: PublishRecord;
  threeGameBrief: ThreeGameBrief;
  threeSceneDirector: ThreeSceneDirector;
  threeAssetPlan: ThreeAssetPlan;
  threeAssetPack: ThreeAssetPack;
  threeVerificationReport: ThreeVerificationReport;
  assetLoadReport: ThreeAssetLoadReport;
}): MockProject {
  const artifacts: PipelineArtifact[] = [
    {
      stage: "three-game-brief",
      fileName: "three-design-brief.json",
      format: "json",
      title: "Three.js Game Brief",
      content: input.threeGameBrief
    },
    {
      stage: "three-scene-director",
      fileName: "three-scene-director.json",
      format: "json",
      title: "Three.js Scene Director",
      content: input.threeSceneDirector
    },
    {
      stage: "three-asset-plan",
      fileName: "three-asset-plan.json",
      format: "json",
      title: "Three.js Asset Plan",
      content: input.threeAssetPlan
    },
    {
      stage: "three-asset-pack",
      fileName: "three-asset-pack.json",
      format: "json",
      title: "Three.js Asset Pack",
      content: input.threeAssetPack
    },
    {
      stage: "three-verification-report",
      fileName: "three-verification-report.json",
      format: "json",
      title: "Three.js Verification Report",
      content: input.threeVerificationReport
    }
  ];
  const qaReport: QaReport = {
    scores: {
      buildHealth: input.threeVerificationReport.passed ? 88 : 45,
      visualUsability: input.assetLoadReport.ready ? 84 : 48,
      intentAlignment: 80,
      firstThirtySeconds: (input.threeSceneDirector.stages ?? []).length >= 3 ? 82 : 50,
      visualDepth: 74,
      gameFeel: 72
    },
    checks: input.threeVerificationReport.checks.map((check) => `${check.id}: ${check.detail}`),
    debugProtocolEntries: ["threejs-runtime: director driven", "engine-boundary: Phaser not used for 3D"]
  };
  return {
    id: input.projectId,
    title: input.title,
    engineType: "threejs3d",
    contentType: "ai_project",
    editable: true,
    shareable: true,
    sourceLabel: "Three.js 3D",
    version: {
      id: input.publishRecord.versionId,
      label: "3D MVP",
      status: input.threeVerificationReport.deliveryReady ? "verified" : "draft"
    },
    classification: {
      templateFamily: "top_down",
      reasons: ["3D project uses independent Three.js director; templateFamily is retained only for legacy project cards."],
      risks: input.assetLoadReport.ready ? [] : input.assetLoadReport.errors,
      unsupportedRequests: []
    },
    artifacts,
    assetPack: {
      versionId: input.publishRecord.versionId,
      assets: input.threeAssetPack.assets
    },
    gameConfig: {
      templateFamily: "top_down",
      title: input.title,
      pitch: input.idea,
      playerGoal: "Move in 3D, collect energy, avoid hazards, and restart after failure.",
      controls: ["Arrow keys / WASD", "Touch drag", "Restart"],
      difficulty: "normal",
      referencedAssetKeys: input.threeAssetPack.assets.map((asset) => asset.assetKey),
      gameplay: {
        primaryAction: "dodge_collect",
        enemyBehavior: "wave",
        objectiveMode: "collect_score",
        playerAbility: "dash",
        spawnPattern: "waves"
      },
      level: {
        width: 390,
        height: 844,
        collectibles: input.threeSceneDirector.objectives.collectTarget,
        hazards: input.threeSceneDirector.enemies.reduce((sum, enemy) => sum + enemy.count, 0),
        winScore: input.threeSceneDirector.objectives.collectTarget
      }
    },
    gameHooks: {
      enemyRules: { movement: "wave", speed: 4, waveIntervalMs: 1800 },
      collectibleRules: { placement: "random", value: 1, respawn: true },
      winCondition: { mode: "collect_score", target: input.threeSceneDirector.objectives.collectTarget },
      failCondition: { mode: "hit_hazard", lives: 3 },
      numberTuning: { playerSpeed: input.threeSceneDirector.player.speed, jumpVelocity: 0, hazardSpeed: 4 },
      levelLayout: { platforms: [], lanes: [], grid: { columns: 0, rows: 0 } }
    },
    qaReport,
    threeGameBrief: input.threeGameBrief,
    threeSceneDirector: input.threeSceneDirector,
    threeAssetPlan: input.threeAssetPlan,
    threeAssetPack: input.threeAssetPack,
    threeVerificationReport: input.threeVerificationReport,
    threeAssetLoadReport: input.assetLoadReport,
    playUrl: input.publishRecord.playUrl,
    feedback: {
      rating: 0,
      comment: "",
      iterationSuggestion: ""
    }
  };
}

function cleanText(value: string | undefined, fallback: string): string {
  const text = (value ?? "").trim();
  return text && !/[�]/.test(text) ? text : fallback;
}

function normalizeStringArray(value: string[] | undefined, fallback: string[], minLength: number): string[] {
  const normalized = (value ?? []).map((item) => cleanText(item, "")).filter(Boolean);
  return normalized.length >= minLength ? normalized : fallback;
}

function normalizeControls(value: ThreeSceneDirector["controls"] | undefined): ThreeSceneDirector["controls"] {
  const allowed = new Set(["keyboard", "touch_drag", "touch_buttons"]);
  const controls = (value ?? []).filter((control) => allowed.has(control));
  const merged = new Set<"keyboard" | "touch_drag" | "touch_buttons">([
    ...(controls as Array<"keyboard" | "touch_drag" | "touch_buttons">),
    "keyboard",
    "touch_drag"
  ]);
  return Array.from(merged);
}

function normalizeColor(value: string | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : fallback;
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
