import { evaluateVerificationGate } from "../services/verificationGate";
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
  StyleSheet,
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
  const isPlatformer = config.templateFamily === "platformer";
  const isTowerDefense = config.templateFamily === "tower_defense";
  const isGridLogic = config.templateFamily === "grid_logic";
  const isUiHeavy = config.templateFamily === "ui_heavy";
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
      speed: isTowerDefense ? 95 : isPlatformer ? 130 : isGridLogic || isUiHeavy ? 0 : 150,
      waveIntervalMs: isTowerDefense ? 1200 : 0
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
      mode:
        config.templateFamily === "tower_defense"
          ? "base_destroyed"
          : config.templateFamily === "grid_logic"
            ? "moves_exhausted"
            : config.templateFamily === "ui_heavy"
              ? "time_out"
            : "hit_hazard",
      lives: isTowerDefense ? 5 : isGridLogic ? 4 : isUiHeavy ? 60 : 1
    },
    numberTuning: {
      playerSpeed: isPlatformer ? 210 : isGridLogic || isUiHeavy ? 0 : 250,
      jumpVelocity: isPlatformer ? 430 : 0,
      hazardSpeed: isTowerDefense ? 95 : isGridLogic || isUiHeavy ? 0 : 140
    },
    levelLayout: {
      platforms: isPlatformer
        ? [
            { x: 480, y: 530, width: 920, height: 28 },
            { x: 270, y: 430, width: 180, height: 20 },
            { x: 470, y: 350, width: 180, height: 20 },
            { x: 660, y: 270, width: 180, height: 20 },
            { x: 840, y: 360, width: 140, height: 20 }
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
      grid: config.templateFamily === "grid_logic" ? { columns: 5, rows: 3 } : { columns: 0, rows: 0 },
      gridState:
        config.templateFamily === "grid_logic"
          ? [
              [0, 0, 3, 0, 0],
              [1, 2, 0, 2, 0],
              [0, 0, 3, 0, 0]
            ]
          : undefined
    },
    levelFlow: createLevelFlow(config.templateFamily),
    collisionRules: {
      collisionRadius: isPlatformer ? 8 : 12,
      invulnerabilityMs: 520,
      knockbackForce: isPlatformer ? 180 : 140
    },
    feedbackRules: {
      particleCount: isPlatformer ? 24 : isTowerDefense ? 20 : isGridLogic ? 16 : isUiHeavy ? 10 : 18,
      screenShakeIntensity: isPlatformer ? 0.016 : isUiHeavy || isGridLogic ? 0.006 : 0.012,
      collectBurstCount: isPlatformer ? 14 : isTowerDefense ? 12 : isGridLogic ? 10 : isUiHeavy ? 8 : 12,
      floatingScore: true,
      comboText: config.templateFamily !== "ui_heavy",
      audioCueKeys: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
    },
    spawnRules: {
      hazardIntervalMs: isUiHeavy || isGridLogic ? 0 : config.gameplay.spawnPattern === "waves" ? 700 : 1100,
      maxActiveHazards: isUiHeavy || isGridLogic ? 0 : Math.max(1, config.level.hazards)
    },
    visualLayerRules: {
      backgroundTreatment: isPlatformer
        ? "parallax forest layers"
        : isTowerDefense
          ? "top-down readable defense route"
          : isGridLogic
            ? "flat readable puzzle board"
            : isUiHeavy
              ? "dashboard management table"
              : "parallax arena depth",
      foregroundProps: isPlatformer
        ? ["grass lip", "finish flag"]
        : isTowerDefense
          ? ["build pads", "base core", "wave path"]
          : isGridLogic
            ? ["target cells", "block sockets"]
            : isUiHeavy
              ? ["order cards", "mood meter", "income tickets"]
              : ["danger markers", "score glints"],
      uiBadgeStyle: isUiHeavy ? "large decision cards with resource badges" : "compact neon readable HUD"
    },
    difficultyRules: {
      hazardRamp: isPlatformer
        ? "teach jump before first hazard"
        : isTowerDefense
          ? "first wave is readable, mixed wave arrives after one build"
          : isGridLogic
            ? "first move is safe, later moves require planning"
            : isUiHeavy
              ? "orders become stricter after two good choices"
              : "pressure rises after two pickups",
      enemyPacing: isTowerDefense
        ? "wave preview then slow first wave"
        : isGridLogic
          ? "no enemy chase, pressure is move budget"
          : isUiHeavy
            ? "timer and mood pressure instead of physical enemies"
            : "early safe read then active threat",
      collectibleSpacing: isPlatformer
        ? "coin path follows jump arc"
        : isTowerDefense
          ? "gold rewards appear after kills and support upgrades"
          : isGridLogic
            ? "targets sit on separated cells to force route planning"
            : isUiHeavy
              ? "rewards are order tickets and income badges"
              : "collectibles pull player across safe lanes",
      checkpointPolicy: isPlatformer
        ? "finish gate visible after first reward"
        : isGridLogic
          ? "reset is immediate after move budget is spent"
          : "short retry with no hidden loss"
    },
    stageGoals: createStageGoals(config),
    scoreTiers: createScoreTiers(config)
  };
}

function createStageGoals(config: GameConfig): NonNullable<GameHooks["stageGoals"]> {
  const winScore = Math.max(1, config.level.winScore);
  if (config.templateFamily === "tower_defense") {
    return [
      {
        id: "route_preview",
        label: "Route Preview",
        startsAtMs: 0,
        durationMs: 16000,
        objective: "learn_controls",
        target: 1,
        enemyMix: [],
        rewardPacing: "slow",
        enemySpawnDelta: 0,
        speedMultiplier: 0.9,
        bgmIntensity: 0
      },
      {
        id: "first_wave",
        label: "First Wave",
        startsAtMs: 16000,
        durationMs: 30000,
        objective: "survive",
        target: Math.max(3, Math.ceil(winScore * 0.6)),
        enemyMix: ["wave_runner"],
        rewardPacing: "normal",
        enemySpawnDelta: 2,
        speedMultiplier: 1.05,
        bgmIntensity: 1
      },
      {
        id: "base_rush",
        label: "Base Rush",
        startsAtMs: 46000,
        durationMs: 34000,
        objective: "finale",
        target: winScore,
        enemyMix: ["wave_runner", "armored_wave"],
        rewardPacing: "burst",
        enemySpawnDelta: 4,
        speedMultiplier: 1.25,
        bgmIntensity: 2
      }
    ];
  }
  if (config.templateFamily === "grid_logic") {
    return [
      {
        id: "read_board",
        label: "Read Board",
        startsAtMs: 0,
        durationMs: 20000,
        objective: "learn_controls",
        target: 1,
        enemyMix: [],
        rewardPacing: "slow",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 0
      },
      {
        id: "route_plan",
        label: "Route Plan",
        startsAtMs: 20000,
        durationMs: 30000,
        objective: "collect",
        target: Math.max(2, Math.ceil(winScore * 0.5)),
        enemyMix: ["blocker"],
        rewardPacing: "normal",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 1
      },
      {
        id: "move_budget",
        label: "Move Budget",
        startsAtMs: 50000,
        durationMs: 30000,
        objective: "finale",
        target: winScore,
        enemyMix: ["blocker"],
        rewardPacing: "burst",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 2
      }
    ];
  }
  if (config.templateFamily === "ui_heavy") {
    return [
      {
        id: "first_order",
        label: "First Order",
        startsAtMs: 0,
        durationMs: 18000,
        objective: "learn_controls",
        target: 1,
        enemyMix: [],
        rewardPacing: "slow",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 0
      },
      {
        id: "rush_hour",
        label: "Rush Hour",
        startsAtMs: 18000,
        durationMs: 32000,
        objective: "survive",
        target: Math.max(2, Math.ceil(winScore * 0.6)),
        enemyMix: ["timer"],
        rewardPacing: "normal",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 1
      },
      {
        id: "daily_summary",
        label: "Daily Summary",
        startsAtMs: 50000,
        durationMs: 28000,
        objective: "finale",
        target: winScore,
        enemyMix: ["timer", "mood"],
        rewardPacing: "burst",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 2
      }
    ];
  }
  if (config.templateFamily === "platformer") {
    return [
      {
        id: "safe_route",
        label: "起步与教学",
        startsAtMs: 0,
        durationMs: 20000,
        objective: "learn_controls",
        target: 1,
        enemyMix: [],
        rewardPacing: "slow",
        enemySpawnDelta: 0,
        speedMultiplier: 1,
        bgmIntensity: 0
      },
      {
        id: "pressure_route",
        label: "金币路径压力",
        startsAtMs: 20000,
        durationMs: 30000,
        objective: "collect",
        target: Math.max(2, Math.ceil(winScore * 0.6)),
        enemyMix: ["patroller"],
        rewardPacing: "normal",
        enemySpawnDelta: 1,
        speedMultiplier: 1.1,
        bgmIntensity: 1
      },
      {
        id: "finale_route",
        label: "终点冲刺",
        startsAtMs: 50000,
        durationMs: 30000,
        objective: "finale",
        target: winScore,
        enemyMix: ["patroller", "charger"],
        rewardPacing: "burst",
        enemySpawnDelta: 2,
        speedMultiplier: 1.25,
        bgmIntensity: 2
      }
    ];
  }
  return [
    {
      id: "warmup",
      label: "热身",
      startsAtMs: 0,
      durationMs: 18000,
      objective: "learn_controls",
      target: 1,
      enemyMix: [],
      rewardPacing: "slow",
      enemySpawnDelta: 0,
      speedMultiplier: 1,
      bgmIntensity: 0
    },
    {
      id: "pressure",
      label: "压力上升",
      startsAtMs: 18000,
      durationMs: 32000,
      objective: "collect",
      target: Math.max(2, Math.ceil(winScore * 0.6)),
      enemyMix: ["chaser"],
      rewardPacing: "normal",
      enemySpawnDelta: 1,
      speedMultiplier: 1.15,
      bgmIntensity: 1
    },
    {
      id: "finale",
      label: "终局",
      startsAtMs: 50000,
      durationMs: 30000,
      objective: "finale",
      target: winScore,
      enemyMix: ["chaser", "charger"],
      rewardPacing: "burst",
      enemySpawnDelta: 2,
      speedMultiplier: 1.3,
      bgmIntensity: 2
    }
  ];
}

function createScoreTiers(config: GameConfig): NonNullable<GameHooks["scoreTiers"]> {
  const winScore = Math.max(1, config.level.winScore);
  const targetDurationMs = 75000;
  return {
    targetDurationMs,
    gold: {
      minScore: winScore,
      maxDeathCount: 0,
      maxDurationMs: Math.round(targetDurationMs * 0.75)
    },
    silver: {
      minScore: Math.max(1, Math.ceil(winScore * 0.7)),
      maxDeathCount: 1
    },
    bronze: {
      minScore: Math.max(1, Math.ceil(winScore * 0.4))
    },
    rationale:
      config.templateFamily === "platformer"
        ? "金=无失误且 ≤56 秒抵达终点；银=熟练玩家通关；铜=完成主线即可。"
        : "金=完美收集且快速；银=熟练通关；铜=达成基本目标。"
  };
}

export function createMatureGameBrief(templateFamily: TemplateFamily): MatureGameBrief {
  const pattern = getReferenceGamePattern(templateFamily);
  const isPlatformer = templateFamily === "platformer";
  return {
    referencePatternId: pattern.id,
    coreLoop: isPlatformer
      ? ["起步安全区", "沿金币路径跳跃", "发现隐藏路线", "躲避巡逻危险物", "抵达终点 gate"]
      : ["进入安全区", "收集目标", "应对敌人压力", "完成胜利条件"],
    firstThirtySeconds: isPlatformer
      ? [
          "0-5 秒看到起步平台、金币路径和终点旗帜",
          "5-15 秒完成低高度教学跳跃，拿到第一枚金币",
          "15-25 秒分支：低空稳路线或高空隐藏路线",
          "25-30 秒第一个巡逻危险物出现，接近第二段平台"
        ]
      : ["0-5 秒理解移动和目标", "5-15 秒收集第一个奖励", "15-25 秒出现敌人压力", "25-30 秒形成逃脱和收集循环"],
    visualTheme: isPlatformer
      ? "森林平台、清晰地面剪影、3 段递进高度、背景 parallax 与终点旗"
      : "高对比竞技场、清晰角色和危险物",
    feedbackChecklist: ["收集粒子", "命中闪烁", "屏幕轻微震动", "胜利庆祝", "失败重试提示"],
    difficultyCurve: isPlatformer
      ? [
          "20 秒内全部为安全教学，仅金币奖励",
          "20-50 秒进入压力段：1 个巡逻敌人 + 隐藏路线分支",
          "50-90 秒终点冲刺：2 个巡逻敌人 + 终点 gate 显眼提示"
        ]
      : pattern.difficultyPrinciples,
    gameFeelMoments: isPlatformer
      ? ["金币路径引导跳跃", "落地反馈", "隐藏路线发现彩蛋", "终点 gate 庆祝", "失败重试 0.5 秒内重启"]
      : ["擦边逃脱", "连收奖励", "危险接近提示"]
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
      assetKey: "sfx.explosion",
      type: "sfx",
      purpose: "explosion or high impact feedback",
      style: "short arcade blast",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 1 second"
    }),
    projectAsset({
      assetKey: "sfx.warning",
      type: "sfx",
      purpose: "incoming hazard warning feedback",
      style: "short alert tone",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 1 second"
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
      mockImage("player.ship", "runtime player sprite", "small readable platformer character"),
      mockImage("player.hero", "jumping hero sprite", "small readable platformer character"),
      mockImage("world.background", "gameplay background", "wide forest platformer background"),
      mockImage("world.tiles", "ground and platform tiles", "forest platform tile sheet"),
      mockImage("item.collectible", "collectible sprite", "bright coin or gem"),
      mockImage("hazard.enemy", "runtime hazard sprite", "clear platformer obstacle"),
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

export function createStyleSheet(input: {
  idea: string;
  templateFamily: TemplateFamily;
  title: string;
}): StyleSheet {
  const normalized = `${input.idea} ${input.title}`.toLowerCase();
  const sciFi = normalized.includes("space") || normalized.includes("ship") || normalized.includes("sci") || input.templateFamily === "top_down";
  const forest = normalized.includes("forest") || normalized.includes("ninja") || input.templateFamily === "platformer";
  const defense = normalized.includes("tower") || normalized.includes("defense") || input.templateFamily === "tower_defense";
  const grid = normalized.includes("grid") || normalized.includes("puzzle") || input.templateFamily === "grid_logic";

  if (defense) {
    return {
      palette: ["#172033", "#2f6f73", "#74c365", "#f2c14e", "#f25f5c"],
      brushwork: "vector_flat",
      lighting: "rim",
      era: "sci_fi",
      subjectScale: "small",
      negativePrompt: "no text, no watermark, no mixed art styles, no foreground UI, no blurry silhouettes"
    };
  }
  if (forest) {
    return {
      palette: ["#132a13", "#31572c", "#90a955", "#ecf39e", "#c1121f"],
      brushwork: "cel_shaded",
      lighting: "soft",
      era: "fantasy",
      subjectScale: "medium",
      negativePrompt: "no text, no watermark, no photorealism, no dirty cutout edges, no extra limbs"
    };
  }
  if (grid) {
    return {
      palette: ["#202124", "#3c4043", "#8ab4f8", "#fdd663", "#81c995"],
      brushwork: "pixel_clean",
      lighting: "flat",
      era: "retro",
      subjectScale: "small",
      negativePrompt: "no text, no watermark, no perspective tilt, no clutter, no low contrast tiles"
    };
  }
  if (sciFi) {
    return {
      palette: ["#08111f", "#12355b", "#00b4d8", "#ffbe0b", "#ff006e"],
      brushwork: "low_poly",
      lighting: "neon",
      era: "sci_fi",
      subjectScale: "medium",
      negativePrompt: "no text, no watermark, no realistic photo texture, no UI overlay, no muddy background"
    };
  }
  return {
    palette: ["#233d4d", "#619b8a", "#a1c181", "#fcca46", "#fe7f2d"],
    brushwork: "cel_shaded",
    lighting: "soft",
    era: "modern",
    subjectScale: "medium",
    negativePrompt: "no text, no watermark, no inconsistent palette, no clutter, no blurry edges"
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
        : templateFamily === "tower_defense"
          ? "Build towers on the route, defeat waves, earn gold, and protect the base."
          : templateFamily === "grid_logic"
            ? "Push blocks through the grid and solve every glowing target before moves run out."
            : templateFamily === "ui_heavy"
              ? "Choose the best orders, manage mood and income, and survive the rush timer."
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
      collectibles: templateFamily === "ui_heavy" ? 5 : 6,
      hazards: templateFamily === "tower_defense" ? 8 : templateFamily === "platformer" ? 3 : templateFamily === "grid_logic" || templateFamily === "ui_heavy" ? 0 : 4,
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
  const report: QaReport = {
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
  report.gate = evaluateVerificationGate(report);
  return report;
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
  const styleSheet = createStyleSheet({
    idea: input.idea,
    title: input.title,
    templateFamily: input.classification.templateFamily
  });
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
    jsonArtifact("style-sheet", "style-sheet.json", "Style Sheet", styleSheet),
    mdArtifact("style-sheet", "style-sheet.md", "Style Sheet", styleSheet),
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
