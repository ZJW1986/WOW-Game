import type {
  AssetPack,
  AssetRequirement,
  Classification,
  GameConfig,
  MockProject,
  PipelineArtifact,
  PublishRecord,
  QaReport,
  TemplateFamily
} from "./types";

const TEMPLATE_KEYWORDS: Record<TemplateFamily, string[]> = {
  platformer: ["跳", "跳跃", "jump", "gravity", "平台", "横版", "尖刺", "攀爬", "金币"],
  top_down: ["俯视", "迷宫", "移动", "躲避", "飞船", "陨石", "钥匙", "收集", "星星"],
  grid_logic: ["格子", "棋盘", "推箱", "回合", "消除", "解谜", "谜题"],
  tower_defense: ["塔防", "防守", "波次", "建造", "炮塔", "路线", "怪物"],
  ui_heavy: ["经营", "卡牌", "菜单", "养成", "对话", "选择", "模拟"]
};

export function classifyIdea(idea: string): Classification {
  const normalized = idea.toLowerCase();
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

export function runMockPipeline(idea: string): MockProject {
  const classification = classifyIdea(idea);
  const title = createTitle(idea, classification.templateFamily);
  const assetRequirements = createAssetRequirements(classification.templateFamily);
  const assetPack: AssetPack = {
    versionId: "v1",
    assets: assetRequirements
  };
  const gameConfig = createGameConfig(title, idea, classification.templateFamily, assetPack);
  const qaReport = createQaReport(gameConfig, assetPack);
  const publishRecord = createPublishRecord("project-starlight-001", "v1", title);
  const artifacts = createArtifacts({
    idea,
    title,
    classification,
    assetRequirements,
    assetPack,
    gameConfig,
    qaReport,
    publishRecord
  });

  return {
    id: "project-starlight-001",
    title,
    version: {
      id: "v1",
      label: "v1 Mock playable",
      status: "published"
    },
    classification,
    artifacts,
    assetPack,
    gameConfig,
    qaReport,
    playUrl: publishRecord.playUrl,
    feedback: {
      rating: 4,
      comment: "玩法能跑通，第二版可以增加关卡节奏和美术差异。",
      iterationSuggestion: "下一版建议降低前 20 秒难度，增加奖励道具，并强化失败反馈。"
    }
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

function createAssetRequirements(templateFamily: TemplateFamily): AssetRequirement[] {
  const common: AssetRequirement[] = [
    {
      assetKey: "cover.main",
      type: "image",
      purpose: "Play page cover and Studio preview",
      style: "bright arcade thumbnail",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "16:9 cover, clear title-safe center"
    },
    {
      assetKey: "ui.button",
      type: "ui",
      purpose: "start and restart controls",
      style: "compact neon button",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "reusable rounded rectangle control skin"
    },
    {
      assetKey: "bgm.loop",
      type: "bgm",
      purpose: "short seamless gameplay loop",
      style: "light synth loop",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "20-40 seconds, loopable"
    },
    {
      assetKey: "sfx.collect",
      type: "sfx",
      purpose: "collectible pickup feedback",
      style: "clean positive chime",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "under 1 second"
    },
    {
      assetKey: "effect.hit",
      type: "effect",
      purpose: "collision or damage feedback",
      style: "small burst particles",
      generationMode: "preset",
      copyrightStatus: "placeholder",
      spec: "8-12 frame visual effect"
    }
  ];

  const familyAssets: Record<TemplateFamily, AssetRequirement[]> = {
    platformer: [
      mockImage("player.hero", "jumping hero sprite", "small readable platformer character"),
      mockImage("world.tiles", "ground and platform tiles", "forest platform tile sheet"),
      mockImage("hazard.spike", "hazard sprite", "clear triangular obstacle")
    ],
    top_down: [
      mockImage("player.ship", "player avatar", "small top-down ship or explorer"),
      mockImage("world.background", "scrolling arena background", "deep blue space or maze floor"),
      mockImage("hazard.enemy", "moving hazard", "asteroid or roaming enemy")
    ],
    grid_logic: [
      mockImage("player.cursor", "active grid marker", "high-contrast cursor"),
      mockImage("world.tiles", "grid tiles", "readable tile set"),
      mockImage("hazard.block", "blocked grid cell", "solid obstacle")
    ],
    tower_defense: [
      mockImage("player.tower", "defense tower", "compact cannon icon"),
      mockImage("world.path", "enemy route", "clear curved lane"),
      mockImage("hazard.enemy", "wave enemy", "small marching enemy")
    ],
    ui_heavy: [
      mockImage("player.panel", "main operation panel", "dashboard-like play card"),
      mockImage("world.background", "menu background", "quiet studio scene"),
      mockImage("hazard.timer", "pressure indicator", "countdown badge")
    ]
  };

  return [...common, ...familyAssets[templateFamily]];
}

function mockImage(assetKey: string, purpose: string, spec: string): AssetRequirement {
  return {
    assetKey,
    type: "image",
    purpose,
    style: "clean 2D arcade",
    generationMode: "mock",
    copyrightStatus: "placeholder",
    spec
  };
}

function createGameConfig(
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
        : ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    difficulty: "normal",
    referencedAssetKeys: assetPack.assets.map((asset) => asset.assetKey),
    level: {
      width: 960,
      height: 540,
      collectibles: 6,
      hazards: 4,
      winScore: 6
    }
  };
}

function createQaReport(config: GameConfig, assetPack: AssetPack): QaReport {
  const missingAssets = validateAssetReferences(config, assetPack);
  return {
    scores: {
      buildHealth: missingAssets.length === 0 ? 92 : 40,
      visualUsability: 88,
      intentAlignment: 84
    },
    checks: [
      "template lifecycle locked",
      "asset references validated against asset-pack.json",
      "start/play/win/lose/restart flow simulated",
      "Play page feedback path available"
    ],
    debugProtocolEntries:
      missingAssets.length === 0
        ? ["asset-key-mismatch: checked and no missing keys found"]
        : missingAssets.map((assetKey) => `missing asset key: ${assetKey}`)
  };
}

function createArtifacts(input: {
  idea: string;
  title: string;
  classification: Classification;
  assetRequirements: AssetRequirement[];
  assetPack: AssetPack;
  gameConfig: GameConfig;
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
    jsonArtifact("gdd", "gdd.json", "Technical GDD", gdd),
    mdArtifact("gdd", "gdd.md", "Technical GDD", gdd),
    jsonArtifact("asset-requirements", "asset-requirements.json", "Asset Requirements", input.assetRequirements),
    mdArtifact("asset-requirements", "asset-requirements.md", "Asset Requirements", input.assetRequirements),
    jsonArtifact("asset-pack", "asset-pack.json", "Asset Pack", input.assetPack),
    jsonArtifact("game-config", "game-config.json", "Game Config", input.gameConfig),
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
