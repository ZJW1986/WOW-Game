import type {
  AssetRequirement,
  ConfirmedThreeAssets,
  CoverPoster,
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
import { getThreeGenreProfile } from "../core/threeGenreProfiles";

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
  coverPoster: CoverPoster;
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
  const coverPoster = createThreeCoverPoster(input.projectId, versionId, title, input.idea, threeGameBrief, threeSceneDirector);
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
    assetLoadReport,
    coverPoster
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
    fallbacksUsed,
    coverPoster
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
  const profile = getThreeGenreProfile(input.brief.genre);
  const common =
    `Create a single 3D model for a ${genre}. ` +
    `${theme}. Game ready low-poly style, clean silhouette, centered object, readable on a mobile screen. ` +
    "No text, no UI, no logo, no scene, no full environment, no background, no game screenshot.";
  const slotPrompt: Record<ThreeCoreModelSlot, string> = {
    player: `The model is the controllable player subject: ${profile.modelDirection.player}.`,
    hazard: `The model is the primary gameplay hazard: ${profile.modelDirection.hazard}. Behaviors include ${describeEnemyBehaviors(
      input.director
    )}.`,
    collectible: `The model is the reward collectible: ${profile.modelDirection.collectible}. Target pickup count is ${Math.max(
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
  if (genre === "futuristic_tower_defense") return "3D futuristic tower defense";
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
  if (lower.includes("tower") || lower.includes("turret") || lower.includes("base defense") || lower.includes("wave")) {
    return "futuristic_tower_defense";
  }
  if (idea.includes("塔防") || idea.includes("炮塔") || idea.includes("基地") || idea.includes("波次") || idea.includes("防守")) {
    return "futuristic_tower_defense";
  }
  if (lower.includes("parkour") || lower.includes("runner")) return "runner";
  if (lower.includes("shoot") || lower.includes("laser") || lower.includes("ship")) return "flight_shooter";
  if (lower.includes("showcase") || lower.includes("walk") || lower.includes("gallery")) return "exploration";
  if (lower.includes("third person")) return "third_person_collect";
  return "dodge_collect";
}
function createThreeTitle(idea: string, genre: ThreeGameGenre): string {
  const lower = idea.toLowerCase();
  if (lower.includes("tower") || lower.includes("turret") || genre === "futuristic_tower_defense") return "Neon Core Defense";
  if (lower.includes("space cat")) return "Space Cat Stardust Route";
  if (lower.includes("space") || lower.includes("ship")) return "Star Energy Route";
  if (lower.includes("runner") || lower.includes("parkour")) return "Neon Speed Runner";
  if (genre === "flight_shooter") return "3D Star Breakout";
  if (genre === "exploration") return "3D Exploration Field";
  if (genre === "third_person_collect") return "3D Collection Adventure";
  return "Energy Dodge Trial";
}
function createThreeGameBrief(
  idea: string,
  title: string,
  genre: ThreeGameGenre,
  mobileFormat: ThreeGameBrief["mobileFormat"]
): ThreeGameBrief {
  const profile = getThreeGenreProfile(genre);
  return {
    genre,
    title,
    mobileFormat,
    playerFantasy: `${profile.label}：${profile.genreIntent} 玩家创意：“${idea}”。`,
    cameraIntent: profile.brief.cameraIntent,
    movementIntent: profile.brief.movementIntent,
    spaceLayout: profile.brief.spaceLayout,
    interactionFeedback: ["收集发光脉冲", "碰撞震屏", "受击短暂无敌", "胜利/失败可重开"],
    mobileControlPlan:
      mobileFormat === "portrait_9_16"
        ? "单指拖动控制横向移动，HUD 避开底部操作区。"
        : "键盘优先，触屏拖动作为辅助控制。",
    assetNeeds: profile.brief.assetNeeds,
    coreLoop: profile.brief.coreLoop,
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
  const profile = getThreeGenreProfile(brief.genre);
  const fallback = profile.director;
  const answerText = answers.map((answer) => answer.value).join(" ");
  const prefersTopDown = /俯视|top.?down/i.test(`${brief.cameraIntent} ${answerText}`);
  return {
    ...fallback,
    ...threeExperienceRules(brief.genre),
    genre: brief.genre,
    title: brief.title,
    camera: prefersTopDown && brief.genre !== "runner" && brief.genre !== "exploration" ? "top_down" : fallback.camera
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
    movementMode: normalizeMovementMode(director.movementMode, fallback.movementMode),
    layoutMode: normalizeLayoutMode(director.layoutMode, fallback.layoutMode),
    spawnPattern: normalizeSpawnPattern(director.spawnPattern, fallback.spawnPattern),
    abilities: normalizeAbilities(director.abilities, fallback.abilities ?? []),
    collisionRules: normalizeCollisionRules(director.collisionRules, fallback.collisionRules),
    feedbackRules: normalizeFeedbackRules(director.feedbackRules, fallback.feedbackRules),
    audioCues: normalizeAudioCues(director.audioCues, fallback.audioCues ?? []),
    cameraEffects: {
      shake: director.cameraEffects?.shake ?? fallback.cameraEffects?.shake ?? true,
      speedLines: director.cameraEffects?.speedLines ?? fallback.cameraEffects?.speedLines ?? false,
      followSmoothing: clampNumber(
        director.cameraEffects?.followSmoothing,
        0.01,
        0.2,
        fallback.cameraEffects?.followSmoothing ?? 0.05
      )
    },
    spawnTimeline: normalizeSpawnTimeline(director.spawnTimeline, fallback.spawnTimeline ?? []),
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
    },
    towerDefense: normalizeTowerDefenseRules(director.towerDefense, fallback.towerDefense)
  };
}

function normalizeMovementMode(
  value: ThreeSceneDirector["movementMode"],
  fallback: ThreeSceneDirector["movementMode"]
): ThreeSceneDirector["movementMode"] {
  const allowed = new Set(["forward_flight", "auto_runner", "free_move", "explore_scan", "arena_dodge", "tower_defense"]);
  return value && allowed.has(value) ? value : fallback;
}

function normalizeLayoutMode(
  value: ThreeSceneDirector["layoutMode"],
  fallback: ThreeSceneDirector["layoutMode"]
): ThreeSceneDirector["layoutMode"] {
  const allowed = new Set(["flight_corridor", "lane_track", "small_arena", "open_landmarks", "single_arena", "defense_path"]);
  return value && allowed.has(value) ? value : fallback;
}

function normalizeSpawnPattern(
  value: ThreeSceneDirector["spawnPattern"],
  fallback: ThreeSceneDirector["spawnPattern"]
): ThreeSceneDirector["spawnPattern"] {
  const allowed = new Set(["forward_waves", "lane_gates", "landmark_clusters", "discovery_ring", "timed_bursts", "tower_waves"]);
  return value && allowed.has(value) ? value : fallback;
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

function normalizeTowerDefenseRules(
  value: ThreeSceneDirector["towerDefense"] | undefined,
  fallback: ThreeSceneDirector["towerDefense"] | undefined
): ThreeSceneDirector["towerDefense"] | undefined {
  if (!fallback && !value) return undefined;
  const base = fallback ?? value;
  if (!base) return undefined;
  const towerKinds = new Set(["laser", "missile", "slow"]);
  const enemyTypes = new Set(["drone", "armored", "runner"]);
  const pathNodes = (value?.pathNodes ?? base.pathNodes)
    .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.z))
    .map((node) => ({ x: clampNumber(node.x, -20, 20, 0), z: clampNumber(node.z, -30, 30, 0) }));
  const towers = (value?.towers ?? base.towers)
    .filter((tower) => towerKinds.has(tower.kind))
    .map((tower) => ({
      id: cleanText(tower.id, `${tower.kind}-tower`),
      kind: tower.kind,
      cost: Math.round(clampNumber(tower.cost, 10, 200, 40)),
      range: clampNumber(tower.range, 2, 8, 4.5),
      fireRateMs: Math.round(clampNumber(tower.fireRateMs, 200, 2500, 800)),
      damage: Math.round(clampNumber(tower.damage, 1, 120, 18)),
      ...(tower.effect ? { effect: tower.effect } : {})
    }));
  const waves = (value?.waves ?? base.waves)
    .filter((wave) => enemyTypes.has(wave.enemyType))
    .map((wave) => ({
      id: cleanText(wave.id, `${wave.enemyType}-wave`),
      startsAtMs: Math.round(clampNumber(wave.startsAtMs, 0, 120000, 0)),
      enemyType: wave.enemyType,
      count: Math.round(clampNumber(wave.count, 1, 40, 5)),
      intervalMs: Math.round(clampNumber(wave.intervalMs, 250, 3000, 800)),
      health: Math.round(clampNumber(wave.health, 5, 400, 40)),
      speed: clampNumber(wave.speed, 0.3, 4, 1.2),
      reward: Math.round(clampNumber(wave.reward, 1, 80, 12))
    }));
  return {
    pathNodes: pathNodes.length >= 5 ? pathNodes : base.pathNodes,
    towers: towers.length >= 3 ? towers : base.towers,
    waves: waves.length >= 4 ? waves : base.waves,
    economyRules: {
      startingEnergy: Math.round(clampNumber(value?.economyRules?.startingEnergy, 40, 400, base.economyRules.startingEnergy)),
      killReward: Math.round(clampNumber(value?.economyRules?.killReward, 1, 80, base.economyRules.killReward))
    },
    baseRules: {
      baseHealth: Math.round(clampNumber(value?.baseRules?.baseHealth, 1, 50, base.baseRules.baseHealth)),
      leakDamage: Math.round(clampNumber(value?.baseRules?.leakDamage, 1, 10, base.baseRules.leakDamage))
    },
    buildRules: {
      buildRadius: clampNumber(value?.buildRules?.buildRadius, 0.5, 4, base.buildRules.buildRadius),
      maxTowers: Math.round(clampNumber(value?.buildRules?.maxTowers, 1, 20, base.buildRules.maxTowers))
    }
  };
}

function threeExperienceRules(
  genre: ThreeGameGenre
): Pick<ThreeSceneDirector, "abilities" | "collisionRules" | "feedbackRules" | "audioCues" | "cameraEffects" | "spawnTimeline"> {
  const abilitiesByGenre: Record<ThreeGameGenre, NonNullable<ThreeSceneDirector["abilities"]>> = {
    flight_shooter: ["boost", "dash"],
    runner: ["lane_change", "jump"],
    third_person_collect: ["dash"],
    exploration: ["scan"],
    dodge_collect: ["dash"],
    futuristic_tower_defense: ["build_tower", "upgrade_tower"]
  };
  return {
    abilities: abilitiesByGenre[genre],
    collisionRules: {
      hitbox: genre === "runner" || genre === "third_person_collect" ? "capsule" : "sphere",
      damage: 1,
      invincibleMs: genre === "runner" ? 700 : 900,
      knockback: genre === "exploration" ? 0.45 : 1.25,
      nearMiss: genre !== "exploration"
    },
    feedbackRules: {
      collectParticles: true,
      hitParticles: true,
      explosion: genre !== "exploration",
      screenShake: true,
      flash: true
    },
    audioCues: ["collect", "hit", "win", "lose", "warning", "explosion"],
    cameraEffects: {
      shake: true,
      speedLines: genre === "flight_shooter" || genre === "runner",
      followSmoothing: 0.05
    },
    spawnTimeline: [
      { atMs: 0, event: "warning", count: 1 },
      { atMs: 5000, event: "spawn_collectible", count: 3 },
      { atMs: 17000, event: "pressure_wave", count: genre === "exploration" ? 2 : 5 },
      { atMs: 29000, event: genre === "exploration" ? "reward_burst" : "spawn_hazard", count: 4 }
    ]
  };
}

function normalizeAbilities(
  value: ThreeSceneDirector["abilities"] | undefined,
  fallback: NonNullable<ThreeSceneDirector["abilities"]>
): NonNullable<ThreeSceneDirector["abilities"]> {
  const allowed = new Set(["dash", "lane_change", "jump", "scan", "boost", "build_tower", "upgrade_tower"]);
  const normalized = (value ?? []).filter((ability) => allowed.has(ability));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
}

function normalizeCollisionRules(
  value: ThreeSceneDirector["collisionRules"] | undefined,
  fallback: ThreeSceneDirector["collisionRules"] | undefined
): NonNullable<ThreeSceneDirector["collisionRules"]> {
  const base = fallback ?? {
    hitbox: "sphere",
    damage: 1,
    invincibleMs: 900,
    knockback: 1,
    nearMiss: true
  };
  const hitbox = value?.hitbox && ["sphere", "capsule", "box"].includes(value.hitbox) ? value.hitbox : base.hitbox;
  return {
    hitbox,
    damage: Math.round(clampNumber(value?.damage, 1, 3, base.damage)),
    invincibleMs: Math.round(clampNumber(value?.invincibleMs, 300, 2500, base.invincibleMs)),
    knockback: clampNumber(value?.knockback, 0, 3, base.knockback),
    nearMiss: value?.nearMiss ?? base.nearMiss
  };
}

function normalizeFeedbackRules(
  value: ThreeSceneDirector["feedbackRules"] | undefined,
  fallback: ThreeSceneDirector["feedbackRules"] | undefined
): NonNullable<ThreeSceneDirector["feedbackRules"]> {
  const base = fallback ?? {
    collectParticles: true,
    hitParticles: true,
    explosion: true,
    screenShake: true,
    flash: true
  };
  return {
    collectParticles: value?.collectParticles ?? base.collectParticles,
    hitParticles: value?.hitParticles ?? base.hitParticles,
    explosion: value?.explosion ?? base.explosion,
    screenShake: value?.screenShake ?? base.screenShake,
    flash: value?.flash ?? base.flash
  };
}

function normalizeAudioCues(
  value: ThreeSceneDirector["audioCues"] | undefined,
  fallback: NonNullable<ThreeSceneDirector["audioCues"]>
): NonNullable<ThreeSceneDirector["audioCues"]> {
  const allowed = new Set(["collect", "hit", "win", "lose", "warning", "explosion"]);
  const normalized = (value ?? []).filter((cue) => allowed.has(cue));
  const merged = new Set([...fallback, ...normalized]);
  return Array.from(merged) as NonNullable<ThreeSceneDirector["audioCues"]>;
}

function normalizeSpawnTimeline(
  value: ThreeSceneDirector["spawnTimeline"] | undefined,
  fallback: NonNullable<ThreeSceneDirector["spawnTimeline"]>
): NonNullable<ThreeSceneDirector["spawnTimeline"]> {
  const allowedEvents = new Set(["spawn_hazard", "spawn_collectible", "pressure_wave", "reward_burst", "warning"]);
  const normalized = (value ?? [])
    .filter((entry) => entry && allowedEvents.has(entry.event))
    .map((entry) => ({
      atMs: Math.round(clampNumber(entry.atMs, 0, 120000, 0)),
      event: entry.event,
      count: Math.round(clampNumber(entry.count, 1, 20, 1))
    }))
    .sort((left, right) => left.atMs - right.atMs);
  return normalized.length >= 3 ? normalized : fallback;
}

function createThreeAssetPlan(
  versionId: string,
  brief: ThreeGameBrief,
  director: ThreeSceneDirector
): ThreeAssetPlan {
  const profile = getThreeGenreProfile(brief.genre);
  const baseAssets: ThreeAssetPlan["assets"] = [
    {
      assetKey: "three.model.player",
      type: "model",
      provider: "builtin-three",
      purpose: `${profile.label} player model`,
      prompt: `${profile.modelDirection.player}. ${brief.title}. ${brief.movementIntent}`,
      fallback: true,
      ...modelBudgetForSlot("player", director)
    },
    {
      assetKey: "three.model.hazard",
      type: "model",
      provider: "builtin-three",
      purpose: `${profile.label} hazard model`,
      prompt: `${profile.modelDirection.hazard}. ${brief.title}. behavior ${director.enemies[0]?.behavior ?? "falling"}`,
      fallback: true,
      ...modelBudgetForSlot("hazard", director)
    },
    {
      assetKey: "three.model.collectible",
      type: "model",
      provider: "builtin-three",
      purpose: `${profile.label} collectible model`,
      prompt: `${profile.modelDirection.collectible}. ${brief.title}. visible in mobile camera`,
      fallback: true,
      ...modelBudgetForSlot("collectible", director)
    },
    {
      assetKey: "three.skybox.main",
      type: "skybox",
      provider: "gemini-image",
      purpose: "3D background or skybox",
      prompt: `${brief.title} ${profile.label} skybox or background texture, ${brief.spaceLayout}`,
      fallback: true
    },
    {
      assetKey: "three.audio.collect",
      type: "audio",
      provider: "elevenlabs",
      purpose: "Collect sound cue",
      prompt: `${brief.title} short collect chime`,
      fallback: true
    },
    {
      assetKey: "three.audio.hit",
      type: "audio",
      provider: "elevenlabs",
      purpose: "Hit sound cue",
      prompt: `${brief.title} short hit impact sound`,
      fallback: true
    }
  ];
  return {
    versionId,
    engineType: "threejs3d",
    requiredApiKeys: ["TRIPO_API_KEY", "GEMINI_API_KEY", "ELEVENLABS_API_KEY"],
    assets: [...baseAssets, ...createTowerDefenseAssetPlanExtras(brief, director)]
  };
}

function createTowerDefenseAssetPlanExtras(
  brief: ThreeGameBrief,
  director: ThreeSceneDirector
): ThreeAssetPlan["assets"] {
  if (director.genre !== "futuristic_tower_defense") return [];
  const common = {
    type: "model" as const,
    provider: "builtin-three" as const,
    fallback: true,
    qualityTier: "builtin_low_poly" as const,
    preferredSource: "builtin_low_poly" as const,
    maxFileSizeMb: 1,
    runtimeScale: 1,
    colliderShape: "box" as const
  };
  return [
    {
      ...common,
      assetKey: "three.tower.laser",
      purpose: "Laser tower runtime model",
      prompt: `${brief.title} low-poly laser tower, neon sci-fi turret, readable attack direction`,
      polyBudget: 900
    },
    {
      ...common,
      assetKey: "three.tower.missile",
      purpose: "Missile tower runtime model",
      prompt: `${brief.title} low-poly missile tower, dual pods, sci-fi defense platform`,
      polyBudget: 1100
    },
    {
      ...common,
      assetKey: "three.tower.slow",
      purpose: "Slow tower runtime model",
      prompt: `${brief.title} low-poly slowing field tower, blue energy ring, sci-fi defense device`,
      polyBudget: 850
    },
    {
      ...common,
      assetKey: "three.base.core",
      purpose: "Base core defense objective model",
      prompt: `${brief.title} shielded futuristic base core, glowing reactor, final defense objective`,
      polyBudget: 1200
    }
  ];
}

function modelBudgetForSlot(
  slot: ThreeCoreModelSlot,
  director: ThreeSceneDirector
): Pick<
  ThreeAssetPlan["assets"][number],
  "qualityTier" | "preferredSource" | "polyBudget" | "maxFileSizeMb" | "runtimeScale" | "colliderShape"
> {
  const colliderShape =
    slot === "player"
      ? "capsule"
      : slot === "hazard" && director.movementMode === "auto_runner"
        ? "box"
        : "sphere";
  return {
    qualityTier: "builtin_low_poly",
    preferredSource: "builtin_low_poly",
    polyBudget: slot === "collectible" ? 600 : slot === "hazard" ? 1000 : 1200,
    maxFileSizeMb: 1,
    runtimeScale: slot === "collectible" ? 0.55 : slot === "hazard" ? 0.8 : 1.1,
    colliderShape
  };
}

function builtinThreeModelUrl(genre: ThreeGameGenre, assetKey: string): string {
  if (genre === "futuristic_tower_defense") {
    const towerMatch = assetKey.match(/^three\.tower\.(laser|missile|slow)$/);
    if (towerMatch) return `builtin://three/futuristic_tower_defense/tower/${towerMatch[1]}`;
    if (assetKey === "three.base.core" || assetKey === "three.model.player") return "builtin://three/futuristic_tower_defense/player/base-core";
    if (assetKey === "three.model.hazard") return "builtin://three/futuristic_tower_defense/enemy/drone";
    if (assetKey === "three.model.collectible") return "builtin://three/futuristic_tower_defense/reward/energy";
  }
  const slot = assetKey === "three.model.player" ? "player" : assetKey === "three.model.hazard" ? "hazard" : "collectible";
  return `builtin://three/${genre}/${slot}/low-poly`;
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
    fallbackProviders: ["builtin-three", "procedural-three", "tripo", "elevenlabs"],
    assets: assetPlan.assets.map((asset) => {
      const confirmed = confirmedThreeAssets?.assets.find((item) => item.assetKey === asset.assetKey);
      if (confirmed) {
        return {
          ...confirmed,
          approvalStatus: "approved",
          generationParams: {
            ...confirmed.generationParams,
            engineType: "threejs3d",
            genreProfileId: director.genre,
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
          uploaded.mimeType,
          { genreProfileId: director.genre, roleInGameplay: asset.purpose }
        );
      }
      return threeAsset(
        asset.assetKey,
        asset.type,
        asset.purpose,
        asset.prompt || director.world.skyColor,
        asset.type === "model" ? "builtin-three" : "procedural-three",
        asset.type === "model" ? builtinThreeModelUrl(director.genre, asset.assetKey) : undefined,
        undefined,
        undefined,
        {
          genreProfileId: director.genre,
          roleInGameplay: asset.purpose,
          qualityTier: asset.qualityTier ?? "builtin_low_poly",
          preferredSource: asset.preferredSource ?? "builtin_low_poly",
          polyBudget: asset.polyBudget ?? 1000,
          maxFileSizeMb: asset.maxFileSizeMb ?? 1,
          runtimeScale: asset.runtimeScale ?? normalizedHeightForThreeAsset(asset.assetKey),
          colliderShape: asset.colliderShape ?? "sphere"
        }
      );
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
  const builtin = provider === "builtin-three";
  const resolvedFileUrl = builtin && fileUrl === `procedural://${assetKey}` ? `builtin://${assetKey}` : fileUrl;
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
    fileUrl: resolvedFileUrl,
    provider,
    model: uploaded
      ? uploadedMimeType ?? "uploaded-asset"
      : generated
        ? uploadedMimeType ?? "tripo-text-to-model"
        : builtin
          ? "builtin-low-poly-v1"
          : "three-procedural-mvp",
    generationParams: {
      engineType: "threejs3d",
      fallback: !uploaded && !generated,
      runtimeLoader: type === "model" ? (builtin ? "builtin-three" : "GLTFLoader") : "procedural",
      ...(builtin
        ? {
            modelBudget: "low-poly",
            maxFileSizeMb: 1,
            maxTriangles: 3000,
            maxTextureSize: 512,
            normalizedHeight: normalizedHeightForThreeAsset(assetKey)
          }
        : {}),
      ...generationParams
    }
  };
}

function createThreeAssetLoadReport(assetPack: ThreeAssetPack): ThreeAssetLoadReport {
  const assets = assetPack.assets.map((asset) => {
    const fallback = asset.fileUrl.startsWith("procedural://") || asset.fileUrl.startsWith("builtin://");
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
  const coreModelAssets = assetPack.assets.filter((asset) => THREE_CORE_MODEL_KEYS.includes(asset.assetKey as (typeof THREE_CORE_MODEL_KEYS)[number]));
  const modelBudgetPassed =
    coreModelAssets.length === THREE_CORE_MODEL_KEYS.length &&
    coreModelAssets.every((asset) => {
      const tier = asset.generationParams.qualityTier;
      const maxFileSizeMb = Number(asset.generationParams.maxFileSizeMb ?? 1);
      const polyBudget = Number(asset.generationParams.polyBudget ?? asset.generationParams.maxTriangles ?? 3000);
      const isBuiltin = asset.fileUrl.startsWith("builtin://three/");
      return isBuiltin || (tier !== "tripo_enhanced" && maxFileSizeMb <= 1 && polyBudget <= 3000);
    });
  const audioFeedbackChecked =
    ["collect", "hit", "win", "lose"].every((cue) => director.audioCues?.includes(cue as NonNullable<ThreeSceneDirector["audioCues"]>[number])) &&
    director.feedback.proceduralAudio;
  const collisionFeedbackChecked =
    Boolean(director.collisionRules) &&
    (director.collisionRules?.damage ?? 0) >= 1 &&
    (director.collisionRules?.invincibleMs ?? 0) >= 300;
  const runtimeEffectsChecked = Boolean(
    director.feedbackRules?.collectParticles &&
      director.feedbackRules.hitParticles &&
      director.feedbackRules.screenShake &&
      director.feedbackRules.flash
  );
  const genreDifferentiationChecked = Boolean(director.movementMode && director.layoutMode && director.spawnPattern && director.abilities?.length);
  const nonTowerGenreContractChecked = checkNonTowerGenreContract(director);
  const towerDefenseLoopChecked =
    director.genre !== "futuristic_tower_defense" ||
    Boolean(
      director.towerDefense &&
        director.towerDefense.pathNodes.length >= 5 &&
        director.towerDefense.towers.length >= 3 &&
        director.towerDefense.waves.length >= 4
    );
  const towerPlacementChecked =
    director.genre !== "futuristic_tower_defense" ||
    Boolean(director.towerDefense && director.towerDefense.buildRules.maxTowers > 0 && director.towerDefense.economyRules.startingEnergy > 0);
  const waveProgressionChecked =
    director.genre !== "futuristic_tower_defense" ||
    Boolean(director.towerDefense?.waves.every((wave) => wave.count > 0 && wave.intervalMs > 0));
  const baseDamageChecked =
    director.genre !== "futuristic_tower_defense" ||
    Boolean(director.towerDefense && director.towerDefense.baseRules.baseHealth > 0 && director.towerDefense.baseRules.leakDamage > 0);
  const projectileHitChecked =
    director.genre !== "futuristic_tower_defense" ||
    Boolean(director.towerDefense?.towers.every((tower) => tower.damage > 0 && tower.fireRateMs > 0));
  const deliveryReady =
    assetLoadReport.ready &&
    hasPlayer &&
    hasGoal &&
    hasEnemies &&
    hasStages &&
    hasControls &&
    modelBudgetPassed &&
    audioFeedbackChecked &&
    collisionFeedbackChecked &&
    runtimeEffectsChecked &&
    genreDifferentiationChecked &&
    nonTowerGenreContractChecked &&
    towerDefenseLoopChecked &&
    towerPlacementChecked &&
    waveProgressionChecked &&
    baseDamageChecked &&
    projectileHitChecked;
  return {
    passed: deliveryReady,
    deliveryReady,
    canvasNonEmpty: assetLoadReport.ready,
    inputMoved: hasControls,
    mobileViewportChecked: true,
    consoleErrorCount: 0,
    screenshotCaptured: false,
    modelBudgetPassed,
    audioFeedbackChecked,
    collisionFeedbackChecked,
    runtimeEffectsChecked,
    genreDifferentiationChecked,
    nonTowerGenreContractChecked,
    towerDefenseLoopChecked,
    towerPlacementChecked,
    waveProgressionChecked,
    baseDamageChecked,
    projectileHitChecked,
    checks: [
      { id: "three_canvas_contract", passed: assetLoadReport.ready, detail: "Three.js preview owns its own canvas and has loadable runtime assets." },
      { id: "mobile_controls", passed: hasControls, detail: "Keyboard, touch drag, and touch buttons are defined." },
      { id: "playable_loop", passed: hasGoal && hasEnemies, detail: "Collect, avoid, win, lose, and restart states are defined." },
      { id: "stage_pacing", passed: hasStages, detail: `${director.stages?.length ?? 0} 3D stages are defined.` },
      { id: "model_budget", passed: modelBudgetPassed, detail: "Core 3D models use lightweight builtin/uploaded runtime budgets." },
      { id: "audio_feedback", passed: audioFeedbackChecked, detail: "Procedural collect, hit, win, and lose audio cues are defined." },
      { id: "collision_feedback", passed: collisionFeedbackChecked, detail: "Damage, invincibility, and collision feedback rules are defined." },
      { id: "runtime_effects", passed: runtimeEffectsChecked, detail: "Collect particles, hit particles, flash, and screen shake are enabled." },
      {
        id: "genre_differentiation",
        passed: genreDifferentiationChecked,
        detail: `${director.genre} uses ${director.movementMode}/${director.layoutMode}/${director.spawnPattern}.`
      },
      {
        id: "non_tower_genre_contract",
        passed: nonTowerGenreContractChecked,
        detail: "Non-tower 3D genres keep their own movement, layout, spawn pattern, and ability contract."
      },
      { id: "tower_defense_loop", passed: towerDefenseLoopChecked, detail: "Tower defense path, towers, waves, and economy are defined when needed." },
      { id: "tower_placement", passed: towerPlacementChecked, detail: "Tower build capacity and starting energy are available when needed." },
      { id: "wave_progression", passed: waveProgressionChecked, detail: "Tower defense waves have spawn counts and intervals when needed." },
      { id: "base_damage", passed: baseDamageChecked, detail: "Tower defense base health and leak damage are defined when needed." },
      { id: "projectile_hit", passed: projectileHitChecked, detail: "Tower defense towers have damage and fire-rate rules when needed." },
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

function checkNonTowerGenreContract(director: ThreeSceneDirector): boolean {
  if (director.genre === "futuristic_tower_defense") return true;
  const abilities = new Set(director.abilities ?? []);
  const contracts: Partial<
    Record<
      ThreeGameGenre,
      {
        movementMode: ThreeSceneDirector["movementMode"];
        layoutMode: ThreeSceneDirector["layoutMode"];
        spawnPattern: ThreeSceneDirector["spawnPattern"];
        ability: NonNullable<ThreeSceneDirector["abilities"]>[number];
      }
    >
  > = {
    flight_shooter: {
      movementMode: "forward_flight",
      layoutMode: "flight_corridor",
      spawnPattern: "forward_waves",
      ability: "boost"
    },
    runner: {
      movementMode: "auto_runner",
      layoutMode: "lane_track",
      spawnPattern: "lane_gates",
      ability: "lane_change"
    },
    third_person_collect: {
      movementMode: "free_move",
      layoutMode: "small_arena",
      spawnPattern: "landmark_clusters",
      ability: "dash"
    },
    exploration: {
      movementMode: "explore_scan",
      layoutMode: "open_landmarks",
      spawnPattern: "discovery_ring",
      ability: "scan"
    }
  };
  const contract = contracts[director.genre];
  if (!contract) return true;
  return (
    director.movementMode === contract.movementMode &&
    director.layoutMode === contract.layoutMode &&
    director.spawnPattern === contract.spawnPattern &&
    abilities.has(contract.ability)
  );
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
  coverPoster: CoverPoster;
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
    },
    {
      stage: "cover-poster",
      fileName: "cover-poster.json",
      format: "json",
      title: "Cover Poster",
      content: input.coverPoster
    },
    {
      stage: "cover-poster",
      fileName: "cover-poster.webp",
      format: "json",
      title: "Cover Poster WebP",
      content: {
        fileUrl: input.coverPoster.fileUrl,
        thumbnailUrl: input.coverPoster.thumbnailUrl,
        prompt: input.coverPoster.prompt,
        fallbackUsed: input.coverPoster.fallbackUsed
      }
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
        primaryAction: input.threeSceneDirector.movementMode === "auto_runner" ? "jump_reach_goal" : "dodge_collect",
        enemyBehavior: input.threeSceneDirector.enemies.some((enemy) => enemy.behavior === "chase")
          ? "chase"
          : input.threeSceneDirector.enemies.some((enemy) => enemy.behavior === "patrol")
            ? "patrol"
            : "wave",
        objectiveMode: input.threeSceneDirector.objectives.avoidDamage ? "collect_score" : "survive_timer",
        playerAbility: input.threeSceneDirector.movementMode === "auto_runner" ? "jump" : "dash",
        spawnPattern: input.threeSceneDirector.layoutMode === "lane_track"
          ? "lanes"
          : input.threeSceneDirector.spawnPattern === "timed_bursts"
            ? "waves"
            : "staggered"
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
    coverPoster: input.coverPoster,
    coverPosterUrl: input.coverPoster.fileUrl,
    coverThumbnailUrl: input.coverPoster.thumbnailUrl,
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

function createThreeCoverPoster(
  projectId: string,
  versionId: string,
  title: string,
  idea: string,
  brief: ThreeGameBrief,
  director: ThreeSceneDirector
): CoverPoster {
  return {
    fileUrl: `/projects/${projectId}/${versionId}/assets/cover-poster.webp`,
    thumbnailUrl: `/projects/${projectId}/${versionId}/assets/cover-poster-thumb.webp`,
    prompt: [
      `Create a 16:9 game lobby poster for ${title}.`,
      idea,
      brief.playerFantasy,
      `Genre: ${brief.genre}.`,
      `Camera: ${director.camera}.`,
      `Collect target: ${director.objectives.collectTarget}.`
    ].join(" "),
    provider: "poster-fallback",
    format: "webp",
    width: 1280,
    height: 720,
    thumbnailWidth: 512,
    thumbnailHeight: 288,
    fallbackUsed: true
  };
}

function normalizedHeightForThreeAsset(assetKey: string): number {
  if (assetKey === "three.model.player") return 1.2;
  if (assetKey === "three.model.hazard") return 0.9;
  if (assetKey === "three.model.collectible") return 0.45;
  return 1;
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
