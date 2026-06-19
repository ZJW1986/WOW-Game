import type {
  AssetPack,
  AssetRequirement,
  AssetStyleGuide,
  AssetSource,
  AssetStatus,
  AssetType,
  Classification,
  GameConfig,
  GameHooks,
  MatureGameBrief,
  MockProject,
  PipelineArtifact,
  PublishRecord,
  QaReport,
  TemplateFamily
} from "./types";
import { createMediaGateway } from "../services/mediaGateway";
import { runDynamicVerification } from "../services/verificationBench";
import { getReferenceGamePattern } from "../services/referenceGamePatterns";

const TEMPLATE_KEYWORDS: Record<TemplateFamily, string[]> = {
  platformer: ["跳", "跳跃", "jump", "gravity", "平台", "横版", "尖刺", "攀爬", "金币"],
  top_down: ["俯视", "迷宫", "移动", "躲避", "飞船", "陨石", "钥匙", "收集", "星星"],
  grid_logic: ["格子", "棋盘", "推箱", "回合", "消除", "解谜", "谜题"],
  tower_defense: ["塔防", "防守", "波次", "建造", "炮塔", "路线", "怪物"],
  ui_heavy: ["经营", "卡牌", "菜单", "养成", "对话", "选择", "模拟"]
};

export function classifyIdea(idea: string): Classification {
  const normalized = idea.toLowerCase();
  const explicitTemplate = detectExplicitTemplate(normalized);
  if (explicitTemplate) {
    return {
      templateFamily: explicitTemplate,
      reasons: [
        `physics-first match: ${explicitTemplate}`,
        explicitTemplate === "platformer"
          ? "gravity and jump timing are the dominant mechanics"
          : explicitTemplate === "tower_defense"
            ? "route defense and wave pressure are the dominant mechanics"
            : explicitTemplate === "grid_logic"
              ? "discrete board logic and puzzle state are the dominant mechanics"
              : explicitTemplate === "ui_heavy"
                ? "interface decisions and resource state are the dominant mechanics"
                : "2D spatial movement and collision checks are the dominant mechanics"
      ],
      risks: [
        "MVP locks engine lifecycle and scene registration to template code",
        "Generated logic must stay inside config and approved hooks"
      ],
      unsupportedRequests: detectUnsupportedRequests(normalized)
    };
  }
  const scores = Object.entries(TEMPLATE_KEYWORDS).map(([family, keywords]) => ({
    family: family as TemplateFamily,
    score: keywords.filter((keyword) => normalized.includes(keyword)).length
  }));
  const selected = scores.sort((a, b) => b.score - a.score)[0];
  const templateFamily = selected.score > 0 ? selected.family : "top_down";

  return {
    templateFamily,
    reasons: [
      `physics-first match: ${templateFamily}`,
      templateFamily === "platformer"
        ? "gravity and jump timing are the dominant mechanics"
        : templateFamily === "tower_defense"
          ? "route defense and wave pressure are the dominant mechanics"
          : templateFamily === "grid_logic"
            ? "discrete board logic and puzzle state are the dominant mechanics"
            : "2D spatial movement and collision checks are the dominant mechanics"
    ],
    risks: [
      "MVP locks engine lifecycle and scene registration to template code",
      "Generated logic must stay inside config and approved hooks"
    ],
    unsupportedRequests: detectUnsupportedRequests(normalized)
  };
}

function detectExplicitTemplate(idea: string): TemplateFamily | null {
  if (idea.includes("tower defense") || idea.includes("turret") || idea.includes("waves")) return "tower_defense";
  if (idea.includes("platformer") || idea.includes("platform jump") || idea.includes("gravity")) return "platformer";
  if (idea.includes("grid puzzle") || idea.includes("limited moves") || idea.includes("logic puzzle")) return "grid_logic";
  if (idea.includes("card") || idea.includes("management") || idea.includes("ui heavy")) return "ui_heavy";
  if (idea.includes("top down") || idea.includes("top_down") || idea.includes("arena dodge")) return "top_down";
  return null;
}

export function runMockPipeline(idea: string): MockProject {
  const classification = classifyIdea(idea);
  const title = createTitle(idea, classification.templateFamily);
  const assetRequirements = createAssetRequirements(classification.templateFamily);
  const matureGameBrief = createMatureGameBrief(classification.templateFamily);
  const assetStyleGuide = createAssetStyleGuide({
    title,
    templateFamily: classification.templateFamily,
    gdd: {
      concept: title,
      loop: ["start", "move", "avoid", "collect", "win or retry"],
      entities: ["player", "collectible", "hazard", "goal"],
      level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
      numbers: { winScore: 6, hazards: 4 },
      implementationRoute: `Use ${classification.templateFamily} Phaser template with config-only generation.`
    }
  });
  const mediaGateway = createMediaGateway();
  const assetPack: AssetPack = {
    versionId: "v1",
    assets: assetRequirements.map((requirement) => {
      const styledRequirement = {
        ...requirement,
        style: `${assetStyleGuide.visualStyle}; ${requirement.style}`,
        prompt: assetStyleGuide.assetPrompts[requirement.assetKey] ?? requirement.prompt
      };
      return styledRequirement.type === "image" || styledRequirement.type === "ui"
        ? mediaGateway.generateImageAsset("project-starlight-001", "v1", styledRequirement)
        : mediaGateway.generateProceduralAsset("project-starlight-001", "v1", styledRequirement);
    })
  };
  const gameConfig = createGameConfig(title, idea, classification.templateFamily, assetPack);
  const gameHooks = createGameHooks(gameConfig);
  const publishRecord = createPublishRecord("project-starlight-001", "v1", title);
  const previewProject = {
    id: "project-starlight-001",
    title,
    contentType: "ai_project" as const,
    editable: true,
    shareable: true,
    sourceLabel: "AI Generated",
    version: {
      id: "v1",
      label: "v1 Mock playable",
      status: "published" as const
    },
    classification,
    artifacts: [],
    assetPack,
    gameConfig,
    gameHooks,
    qaReport: createQaReport(gameConfig, assetPack),
    playUrl: publishRecord.playUrl,
    feedback: {
      rating: 4,
      comment: "",
      iterationSuggestion: ""
    }
  };
  const qaReport = runDynamicVerification(previewProject);
  const artifacts = createArtifacts({
    idea,
    title,
    classification,
    matureGameBrief,
    assetRequirements,
    assetStyleGuide,
    assetPack,
    gameConfig,
    gameHooks,
    qaReport,
    publishRecord
  });

  return {
    id: "project-starlight-001",
    title,
    contentType: "ai_project",
    editable: true,
    shareable: true,
    sourceLabel: "AI Generated",
    version: {
      id: "v1",
      label: "v1 Mock playable",
      status: "published"
    },
    classification,
    artifacts,
    assetPack,
    gameConfig,
    gameHooks,
    qaReport,
    playUrl: publishRecord.playUrl,
    feedback: {
      rating: 4,
      comment: "玩法已经跑通，第二版可以增加关卡节奏和美术差异。",
      iterationSuggestion: "下一版建议降低前 20 秒难度，增加奖励道具，并强化失败反馈。"
    }
  };
}

export function createGameHooks(config: GameConfig): GameHooks {
  return {
    enemyRules: {
      movement:
        config.gameplay.enemyBehavior === "wave"
          ? "wave"
          : config.gameplay.enemyBehavior === "chase"
            ? "chase"
            : config.gameplay.enemyBehavior === "patrol"
              ? "patrol"
              : "static",
      speed: config.templateFamily === "tower_defense" ? 95 : config.templateFamily === "platformer" ? 130 : 150,
      waveIntervalMs: config.templateFamily === "tower_defense" ? 1200 : 0
    },
    collectibleRules: {
      placement:
        config.gameplay.spawnPattern === "grid"
          ? "grid"
          : config.templateFamily === "platformer"
            ? "arc"
            : config.gameplay.spawnPattern === "lanes"
              ? "line"
              : "random",
      value: 1,
      respawn: false
    },
    winCondition: {
      mode: config.gameplay.objectiveMode,
      target: config.level.winScore
    },
    failCondition: {
      mode: config.templateFamily === "tower_defense" ? "base_destroyed" : "hit_hazard",
      lives: config.templateFamily === "tower_defense" ? 5 : 1
    },
    numberTuning: {
      playerSpeed: config.templateFamily === "platformer" ? 210 : 250,
      jumpVelocity: config.templateFamily === "platformer" ? 430 : 0,
      hazardSpeed: config.templateFamily === "tower_defense" ? 95 : 140
    },
    levelLayout: {
      platforms:
        config.templateFamily === "platformer"
          ? [
              { x: 480, y: 510, width: 920, height: 28 },
              { x: 360, y: 390, width: 180, height: 20 },
              { x: 680, y: 290, width: 180, height: 20 }
            ]
          : [],
      lanes:
        config.templateFamily === "tower_defense"
          ? [
              { y: 150, speed: 95, count: 3 },
              { y: 245, speed: 105, count: 3 },
              { y: 340, speed: 115, count: 2 }
            ]
          : [],
      grid: config.templateFamily === "grid_logic" ? { columns: 8, rows: 5 } : { columns: 0, rows: 0 }
    },
    levelFlow: createLevelFlow(config.templateFamily),
    collisionRules: {
      collisionRadius: config.templateFamily === "platformer" ? 8 : 12,
      invulnerabilityMs: 520,
      knockbackForce: config.templateFamily === "platformer" ? 180 : 140
    },
    feedbackRules: {
      particleCount: config.templateFamily === "platformer" ? 24 : 18,
      screenShakeIntensity: config.templateFamily === "platformer" ? 0.016 : 0.012,
      collectBurstCount: config.templateFamily === "platformer" ? 14 : 12,
      floatingScore: true,
      comboText: config.templateFamily !== "ui_heavy",
      audioCueKeys: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
    },
    spawnRules: {
      hazardIntervalMs: config.gameplay.spawnPattern === "waves" ? 700 : 1100,
      maxActiveHazards: Math.max(1, config.level.hazards)
    },
    visualLayerRules: {
      backgroundTreatment: config.templateFamily === "platformer" ? "parallax forest layers" : "parallax arena depth",
      foregroundProps: config.templateFamily === "platformer" ? ["grass lip", "finish flag"] : ["danger markers", "score glints"],
      uiBadgeStyle: "compact neon readable HUD"
    },
    difficultyRules: {
      hazardRamp: config.templateFamily === "platformer" ? "teach jump before first hazard" : "pressure rises after two pickups",
      enemyPacing: config.templateFamily === "tower_defense" ? "wave preview then slow first wave" : "early safe read then active threat",
      collectibleSpacing: config.templateFamily === "platformer" ? "coin path follows jump arc" : "collectibles pull player across safe lanes",
      checkpointPolicy: config.templateFamily === "platformer" ? "finish gate visible after first reward" : "short retry with no hidden loss"
    }
  };
}

export function createMatureGameBrief(templateFamily: TemplateFamily): MatureGameBrief {
  const pattern = getReferenceGamePattern(templateFamily);
  const isPlatformer = templateFamily === "platformer";
  return {
    referencePatternId: pattern.id,
    coreLoop: isPlatformer
      ? ["起步安全区", "沿金币路径跳跃", "躲避危险物", "抵达终点门"]
      : ["进入安全区", "收集目标", "应对敌人压力", "完成胜利条件"],
    firstThirtySeconds: isPlatformer
      ? ["0-5 秒看到目标和金币路径", "5-15 秒完成教学跳跃", "15-25 秒遇到第一个危险物", "25-30 秒接近终点"]
      : ["0-5 秒理解移动和目标", "5-15 秒收集第一个奖励", "15-25 秒出现敌人压力", "25-30 秒形成逃脱和收集循环"],
    visualTheme: isPlatformer ? "森林平台、清晰地面剪影、背景 parallax" : "高对比竞技场、清晰角色和危险物",
    feedbackChecklist: ["收集粒子", "命中闪烁", "屏幕轻微震动", "胜利庆祝", "失败重试提示"],
    difficultyCurve: pattern.difficultyPrinciples,
    gameFeelMoments: isPlatformer ? ["金币路径引导跳跃", "落地反馈", "终点门庆祝"] : ["擦边逃脱", "连收奖励", "危险接近提示"]
  };
}

function createLevelFlow(templateFamily: TemplateFamily): GameHooks["levelFlow"] {
  if (templateFamily === "platformer") {
    return {
      spawnPoint: { x: 96, y: 430 },
      safeZones: [{ x: 96, y: 430, width: 170, height: 120 }],
      finishZone: { x: 820, y: 430, width: 64, height: 110 },
      cameraIntent: "keep the full first route readable in a single-screen preview",
      tutorialBeats: ["first coin before hazard", "short jump before long jump", "finish gate visible"]
    };
  }
  if (templateFamily === "tower_defense") {
    return {
      spawnPoint: { x: 40, y: 270 },
      safeZones: [{ x: 760, y: 220, width: 130, height: 120 }],
      finishZone: { x: 850, y: 270, width: 80, height: 120 },
      cameraIntent: "show enemy route and base health at all times",
      tutorialBeats: ["route preview", "first wave warning", "base hit feedback"]
    };
  }
  return {
    spawnPoint: { x: 480, y: 300 },
    safeZones: [{ x: 480, y: 300, width: 180, height: 140 }],
    finishZone: undefined,
    cameraIntent: "keep arena exits and threat lanes visible",
    tutorialBeats: ["safe start", "first collectible", "first enemy pressure"]
  };
}

export function validateAssetReferences(config: GameConfig, assetPack: AssetPack): string[] {
  const available = new Set(assetPack.assets.map((asset) => asset.assetKey));
  return config.referencedAssetKeys.filter((assetKey) => !available.has(assetKey));
}

export function createPublishRecord(
  projectId: string,
  versionId: string,
  title: string,
  options: {
    visibility?: "private" | "unlisted" | "public";
    baseUrl?: string;
    coverAssetKey?: string;
  } = {}
): PublishRecord {
  const playUrl = `/play/${projectId}/${versionId}`;
  const baseUrl = (options.baseUrl ?? "https://wow-game.local").replace(/\/$/, "");
  return {
    versionId,
    status: "published",
    playUrl,
    publicUrl: `${baseUrl}${playUrl}`,
    coverAssetKey: options.coverAssetKey ?? "cover.main",
    shareTitle: `WOW Game - ${title}`,
    shareDescription: "我用 WOW Game 生成了一个可以试玩的小游戏，点开就能体验。",
    visibility: options.visibility ?? "unlisted",
    publishedAt: "2026-06-17T00:00:00.000Z"
  };
}

function detectUnsupportedRequests(idea: string): string[] {
  const unsupported: string[] = [];
  if (idea.includes("3d") || idea.includes("三维")) {
    unsupported.push("3D export is deferred until after Web 2D MVP");
  }
  if (idea.includes("多人") || idea.includes("联机")) {
    unsupported.push("Multiplayer networking is outside first-stage scope");
  }
  return unsupported;
}

function createTitle(idea: string, family: TemplateFamily): string {
  if (idea.includes("太空") || idea.includes("飞船") || idea.includes("星星")) return "星尘航线";
  if (family === "platformer") return "跃动森林";
  if (family === "tower_defense") return "边境塔线";
  if (family === "grid_logic") return "晶格谜阵";
  if (family === "ui_heavy") return "口袋工坊";
  return "闪避迷航";
}

export function createAssetRequirements(templateFamily: TemplateFamily): AssetRequirement[] {
  const common: AssetRequirement[] = [
    projectAsset({
      assetKey: "cover.main",
      type: "image",
      purpose: "Play page cover and Studio preview",
      style: "bright arcade thumbnail",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "16:9 cover, clear title-safe center",
      transparentBackgroundRequired: false,
      targetSize: "1536x864",
      libraryTags: ["cover", "environment"]
    }),
    projectAsset({
      assetKey: "ui.button",
      type: "ui",
      purpose: "start and restart controls",
      style: "compact neon button",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "reusable rectangular control skin"
    }),
    projectAsset({
      assetKey: "bgm.loop",
      type: "bgm",
      purpose: "short seamless gameplay loop",
      style: "light synth loop",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "20-40 seconds, loopable"
    }),
    projectAsset({
      assetKey: "sfx.collect",
      type: "sfx",
      purpose: "collectible pickup feedback",
      style: "clean positive chime",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 1 second"
    }),
    projectAsset({
      assetKey: "sfx.hit",
      type: "sfx",
      purpose: "damage or collision feedback",
      style: "short warning impact",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 1 second"
    }),
    projectAsset({
      assetKey: "sfx.win",
      type: "sfx",
      purpose: "victory feedback",
      style: "bright success jingle",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "1-2 seconds"
    }),
    projectAsset({
      assetKey: "sfx.lose",
      type: "sfx",
      purpose: "failure feedback",
      style: "soft fail tone",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "1-2 seconds"
    }),
    projectAsset({
      assetKey: "sfx.click",
      type: "sfx",
      purpose: "UI button feedback",
      style: "minimal sci-fi click",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 0.5 seconds"
    }),
    projectAsset({
      assetKey: "vfx.collect",
      type: "effect",
      purpose: "collectible pickup burst",
      style: "small reward particles",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "8-12 particle burst"
    }),
    projectAsset({
      assetKey: "vfx.hit",
      type: "effect",
      purpose: "collision or damage feedback",
      style: "small burst particles",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "8-12 frame visual effect"
    }),
    projectAsset({
      assetKey: "vfx.win",
      type: "effect",
      purpose: "victory celebration feedback",
      style: "small success particles",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "12-18 frame visual effect"
    }),
    projectAsset({
      assetKey: "vfx.lose",
      type: "effect",
      purpose: "failure state feedback",
      style: "subtle warning particles",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "8-12 frame visual effect"
    })
  ];

  const familyAssets: Record<TemplateFamily, AssetRequirement[]> = {
    platformer: [
      mockImage("player.hero", "jumping hero sprite", "small readable platformer character"),
      mockImage("world.tiles", "ground and platform tiles", "forest platform tile sheet"),
      mockImage("item.collectible", "collectible sprite", "bright coin or gem"),
      mockImage("hazard.spike", "hazard sprite", "clear triangular obstacle")
    ],
    top_down: [
      mockImage("player.ship", "player avatar", "small top-down ship or explorer"),
      mockImage("world.background", "scrolling arena background", "deep blue space or maze floor"),
      mockImage("item.collectible", "collectible sprite", "energy core or star"),
      mockImage("hazard.enemy", "moving hazard", "asteroid or roaming enemy")
    ],
    grid_logic: [
      mockImage("player.cursor", "active grid marker", "high-contrast cursor"),
      mockImage("world.tiles", "grid tiles", "readable tile set"),
      mockImage("item.collectible", "goal marker", "clear target tile"),
      mockImage("hazard.block", "blocked grid cell", "solid obstacle")
    ],
    tower_defense: [
      mockImage("player.tower", "defense tower", "compact cannon icon"),
      mockImage("world.path", "enemy route", "clear curved lane"),
      mockImage("item.collectible", "reward token", "small upgrade gem"),
      mockImage("hazard.enemy", "wave enemy", "small marching enemy")
    ],
    ui_heavy: [
      mockImage("player.panel", "main operation panel", "dashboard-like play card"),
      mockImage("world.background", "menu background", "quiet studio scene"),
      mockImage("item.collectible", "reward badge", "small progress badge"),
      mockImage("hazard.timer", "pressure indicator", "countdown badge")
    ]
  };

  return [...common, ...familyAssets[templateFamily]];
}

export function createAssetStyleGuide(input: {
  title: string;
  templateFamily: TemplateFamily;
  gdd: {
    concept: string;
    loop: string[];
    entities: string[];
    level: GameConfig["level"];
    numbers: Record<string, string | number>;
    implementationRoute: string;
  };
}): AssetStyleGuide {
  const palette =
    input.templateFamily === "platformer"
      ? ["#1f7a4d", "#8bd450", "#f7d154", "#ef476f"]
      : ["#13213f", "#22d3ee", "#facc15", "#fb7185"];
  const visualStyle = `${input.templateFamily} clean arcade, readable silhouettes, cohesive generated asset pack`;
  const basePrompt = `${input.title}: ${input.gdd.concept}. ${visualStyle}. Palette ${palette.join(", ")}.`;
  const assetKeys = createAssetRequirements(input.templateFamily).map((asset) => asset.assetKey);
  return {
    visualStyle,
    palette,
    shapeLanguage:
      input.templateFamily === "platformer"
        ? "rounded hero shapes with sharp hazard triangles"
        : "bold geometric icons with glowing edges",
    characterBrief: `Player character should be instantly readable for ${input.templateFamily} controls.`,
    environmentBrief: `Environment supports ${input.gdd.loop.join(" -> ")} without visual clutter.`,
    audioStyle: "short arcade tones, light loop BGM, clear event feedback",
    assetPrompts: Object.fromEntries(assetKeys.map((assetKey) => [assetKey, `${basePrompt} Generate ${assetKey}.`]))
  };
}

function mockImage(assetKey: string, purpose: string, spec: string): AssetRequirement {
  const isCharacter = assetKey.startsWith("player.");
  const isEnvironment = assetKey.startsWith("world.") || assetKey === "cover.main";
  return projectAsset({
    assetKey,
    type: "image",
    purpose,
    style: "clean 2D arcade",
    generationMode: "mock",
    copyrightStatus: "placeholder",
    spec,
    transparentBackgroundRequired: isCharacter,
    targetSize: isEnvironment ? "1536x864" : "512x512",
    libraryTags: [
      isCharacter ? "character" : isEnvironment ? "environment" : "prop",
      assetKey.includes("ship") || assetKey.includes("background") ? "top_down" : "template"
    ]
  });
}

function projectAsset(input: {
  assetKey: string;
  type: AssetType;
  purpose: string;
  style: string;
  generationMode: AssetRequirement["generationMode"];
  copyrightStatus: AssetRequirement["copyrightStatus"];
  spec: string;
  transparentBackgroundRequired?: boolean;
  targetSize?: string;
  libraryTags?: string[];
}): AssetRequirement {
  const status = defaultStatus(input.generationMode);
  const source = defaultSource(input.generationMode);
  return {
    ...input,
    status,
    prompt: createAssetPrompt(input),
    acceptedFileTypes: acceptedFileTypes(input.type),
    previewUrl: defaultPreviewUrl(input.assetKey, input.type),
    source,
    fileUrl: defaultFileUrl(input.assetKey, input.type, source),
    provider: input.generationMode === "preset" ? "preset" : "mock",
    model: input.generationMode === "preset" ? "preset-v1" : "mock-media-v1",
    transparentBackgroundRequired: input.transparentBackgroundRequired,
    targetSize: input.targetSize,
    libraryTags: input.libraryTags,
    generationParams: {
      spec: input.spec,
      style: input.style
    }
  };
}

function createAssetPrompt(input: {
  assetKey: string;
  type: AssetType;
  purpose: string;
  style: string;
  spec: string;
}) {
  return `${input.type} asset ${input.assetKey}: ${input.purpose}. Style: ${input.style}. Spec: ${input.spec}.`;
}

function defaultStatus(mode: AssetRequirement["generationMode"]): AssetStatus {
  if (mode === "preset") return "generated";
  if (mode === "uploaded") return "uploaded";
  if (mode === "model") return "missing";
  return "mock";
}

function defaultSource(mode: AssetRequirement["generationMode"]): AssetSource {
  if (mode === "preset") return "preset";
  if (mode === "uploaded") return "uploaded";
  if (mode === "model") return "generated";
  return "mock";
}

function acceptedFileTypes(type: AssetType): string[] {
  if (type === "image" || type === "ui") return ["image/*", ".png", ".jpg", ".jpeg", ".webp"];
  if (type === "sfx" || type === "bgm") return ["audio/*", ".mp3", ".wav", ".ogg"];
  if (type === "effect") return ["image/*", "application/json", ".png", ".webp", ".json"];
  return ["*/*"];
}

function defaultPreviewUrl(assetKey: string, type: AssetType): string {
  if (type === "sfx" || type === "bgm") return `/assets/previews/audio-wave.svg#${assetKey}`;
  if (type === "effect") return `/assets/previews/effect-burst.svg#${assetKey}`;
  return `/assets/previews/${assetKey.replace(/\./g, "-")}.png`;
}

function defaultFileUrl(assetKey: string, type: AssetType, source: AssetSource): string {
  const extension = type === "sfx" || type === "bgm" ? "mp3" : type === "effect" ? "json" : "png";
  return `/projects/mock/v1/assets/${source}/${assetKey}.${extension}`;
}

export function createGameConfig(
  title: string,
  idea: string,
  templateFamily: TemplateFamily,
  assetPack: AssetPack
): GameConfig {
  return {
    templateFamily,
    title,
    pitch: idea,
    playerGoal:
      templateFamily === "platformer"
        ? "Jump through hazards and collect enough gems to reach the flag."
        : "Move through the arena, avoid hazards, and collect enough stars to win.",
    controls:
      templateFamily === "platformer"
        ? ["ArrowLeft", "ArrowRight", "Space"]
        : templateFamily === "tower_defense"
          ? ["Mouse", "1", "2"]
          : templateFamily === "grid_logic"
            ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]
        : ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    difficulty: "normal",
    referencedAssetKeys: assetPack.assets.map((asset) => asset.assetKey),
    gameplay: createGameplayContract(templateFamily),
    level: {
      width: 960,
      height: 540,
      collectibles: 6,
      hazards: templateFamily === "tower_defense" ? 8 : templateFamily === "platformer" ? 3 : 4,
      winScore: 6
    }
  };
}

function createGameplayContract(templateFamily: TemplateFamily): GameConfig["gameplay"] {
  if (templateFamily === "platformer") {
    return {
      primaryAction: "jump_reach_goal",
      enemyBehavior: "patrol",
      objectiveMode: "reach_exit",
      playerAbility: "jump",
      spawnPattern: "staggered"
    };
  }
  if (templateFamily === "grid_logic") {
    return {
      primaryAction: "solve_grid",
      enemyBehavior: "timer",
      objectiveMode: "solve_state",
      playerAbility: "push",
      spawnPattern: "grid"
    };
  }
  if (templateFamily === "tower_defense") {
    return {
      primaryAction: "defend_route",
      enemyBehavior: "wave",
      objectiveMode: "defend_base",
      playerAbility: "build",
      spawnPattern: "waves"
    };
  }
  if (templateFamily === "ui_heavy") {
    return {
      primaryAction: "manage_choices",
      enemyBehavior: "timer",
      objectiveMode: "survive_timer",
      playerAbility: "choose",
      spawnPattern: "fixed"
    };
  }
  return {
    primaryAction: "dodge_collect",
    enemyBehavior: "chase",
    objectiveMode: "collect_score",
    playerAbility: "dash",
    spawnPattern: "staggered"
  };
}

export function createQaReport(config: GameConfig, assetPack: AssetPack): QaReport {
  const missingAssets = validateAssetReferences(config, assetPack);
  const blockingAssets = assetPack.assets.filter((asset) => asset.status === "missing" || asset.status === "failed");
  return {
    scores: {
      buildHealth: missingAssets.length === 0 && blockingAssets.length === 0 ? 92 : 40,
      visualUsability: 88,
      intentAlignment: 84
    },
    checks: [
      "template lifecycle locked",
      "asset references validated against asset-pack.json",
      "project asset statuses checked before build",
      "start/play/win/lose/restart flow simulated",
      "Play page feedback path available"
    ],
    debugProtocolEntries:
      missingAssets.length === 0 && blockingAssets.length === 0
        ? ["asset-key-mismatch: checked and no missing keys found"]
        : [
            ...missingAssets.map((assetKey) => `missing asset key: ${assetKey}`),
            ...blockingAssets.map((asset) => `asset not ready: ${asset.assetKey}`)
          ]
  };
}

export function createArtifacts(input: {
  idea: string;
  title: string;
  classification: Classification;
  matureGameBrief: MatureGameBrief;
  assetRequirements: AssetRequirement[];
  assetStyleGuide: AssetStyleGuide;
  assetPack: AssetPack;
  gameConfig: GameConfig;
  gameHooks: GameHooks;
  qaReport: QaReport;
  publishRecord: PublishRecord;
}): PipelineArtifact[] {
  const ideaIntake = {
    summary: input.idea,
    targetPlayer: "first-time web game creator",
    coreExperience: "finish a small playable prototype in one guided flow",
    missingFields: ["visual style", "target session length", "difficulty preference"]
  };
  const gdd = {
    concept: input.title,
    loop: ["start", "move", "avoid", "collect", "win or retry"],
    entities: ["player", "collectible", "hazard", "goal"],
    level: input.gameConfig.level,
    numbers: { winScore: input.gameConfig.level.winScore, hazards: input.gameConfig.level.hazards },
    implementationRoute: `Use ${input.classification.templateFamily} Phaser template with config-only generation.`
  };
  const iterationReport = {
    source: "mock play feedback",
    recommendedChanges: [
      "smooth first 20 seconds of difficulty",
      "add one reward pickup",
      "improve hit feedback"
    ]
  };

  return [
    jsonArtifact("idea-intake", "idea-intake.json", "Idea Intake", ideaIntake),
    mdArtifact("idea-intake", "idea-intake.md", "Idea Intake", ideaIntake),
    jsonArtifact("classification", "classification.json", "Physics Classification", input.classification),
    jsonArtifact("mature-game-brief", "mature-game-brief.json", "Mature Game Brief", input.matureGameBrief),
    mdArtifact("mature-game-brief", "mature-game-brief.md", "Mature Game Brief", input.matureGameBrief),
    jsonArtifact("gdd", "gdd.json", "Technical GDD", gdd),
    mdArtifact("gdd", "gdd.md", "Technical GDD", gdd),
    jsonArtifact("asset-style-guide", "asset-style-guide.json", "Asset Style Guide", input.assetStyleGuide),
    mdArtifact("asset-style-guide", "asset-style-guide.md", "Asset Style Guide", input.assetStyleGuide),
    jsonArtifact("asset-requirements", "asset-requirements.json", "Asset Requirements", input.assetRequirements),
    mdArtifact("asset-requirements", "asset-requirements.md", "Asset Requirements", input.assetRequirements),
    jsonArtifact("asset-pack", "asset-pack.json", "Asset Pack", input.assetPack),
    jsonArtifact("game-config", "game-config.json", "Game Config", input.gameConfig),
    jsonArtifact("game-hooks", "game-hooks.json", "Game Hooks", input.gameHooks),
    jsonArtifact("qa-report", "qa-report.json", "QA Report", input.qaReport),
    mdArtifact("qa-report", "qa-report.md", "QA Report", input.qaReport),
    jsonArtifact("publish-record", "publish-record.json", "Publish Record", input.publishRecord),
    jsonArtifact("iteration-report", "iteration-report.json", "Iteration Report", iterationReport),
    mdArtifact("iteration-report", "iteration-report.md", "Iteration Report", iterationReport)
  ];
}

function jsonArtifact(
  stage: PipelineArtifact["stage"],
  fileName: string,
  title: string,
  content: unknown
): PipelineArtifact {
  return { stage, fileName, title, content, format: "json" };
}

function mdArtifact(
  stage: PipelineArtifact["stage"],
  fileName: string,
  title: string,
  content: unknown
): PipelineArtifact {
  return {
    stage,
    fileName,
    title,
    content: renderMarkdown(title, content),
    format: "md"
  };
}

function renderMarkdown(title: string, content: unknown): string {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
}
