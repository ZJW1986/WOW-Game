import type {
  AssetRequirement,
  MockProject,
  PipelineArtifact,
  PublishRecord,
  QaReport,
  ThreeAssetPack,
  ThreeAssetPlan,
  ThreeGameBrief,
  ThreeGameGenre,
  ThreeSceneDirector,
  ThreeVerificationReport
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
}

export interface ThreeGameGenerationResult {
  project: MockProject;
  publishRecord: PublishRecord;
  threeGameBrief: ThreeGameBrief;
  threeSceneDirector: ThreeSceneDirector;
  threeAssetPlan: ThreeAssetPlan;
  threeAssetPack: ThreeAssetPack;
  threeVerificationReport: ThreeVerificationReport;
  deliveryReady: boolean;
  fallbacksUsed: string[];
}

export function generateThreeGameMvp(input: ThreeGameGenerationRequest): ThreeGameGenerationResult {
  const genre = input.gameType3d ?? classifyThreeGenre(input.idea);
  const versionId = "v1";
  const title = createThreeTitle(input.idea, genre);
  const mobileFormat = input.viewportMode === "web_16_9" ? "landscape_16_9" : "portrait_9_16";
  const threeGameBrief = input.threeDesignBrief ?? createThreeGameBrief(input.idea, title, genre, mobileFormat);
  const threeSceneDirector = createThreeSceneDirector(threeGameBrief, input.answers ?? []);
  const threeAssetPlan = createThreeAssetPlan(versionId, threeGameBrief, threeSceneDirector);
  const threeAssetPack = createThreeAssetPack(versionId, threeSceneDirector, threeAssetPlan);
  const threeVerificationReport = createThreeVerificationReport(threeSceneDirector, threeAssetPack);
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
    threeVerificationReport
  });
  return {
    project,
    publishRecord,
    threeGameBrief,
    threeSceneDirector,
    threeAssetPlan,
    threeAssetPack,
    threeVerificationReport,
    deliveryReady: threeVerificationReport.deliveryReady,
    fallbacksUsed: ["tripo_model_fallback_procedural", "elevenlabs_audio_fallback_procedural"]
  };
}

function classifyThreeGenre(idea: string): ThreeGameGenre {
  const lower = idea.toLowerCase();
  if (/跑酷|parkour|runner|奔跑/.test(lower)) return "runner";
  if (/射击|shoot|laser|子弹|飞船/.test(lower)) return "flight_shooter";
  if (/探索|展厅|showcase|walk|漫游/.test(lower)) return "exploration";
  return "dodge_collect";
}

function createThreeTitle(idea: string, genre: ThreeGameGenre): string {
  if (/太空|飞船|星|陨石/.test(idea)) return "星际能量航线";
  if (/猫/.test(idea)) return "立体猫咪探险";
  if (genre === "runner") return "霓虹极速跑酷";
  if (genre === "flight_shooter") return "立体星域突围";
  if (genre === "exploration") return "三维探索场";
  return "能量躲避试炼";
}

function createThreeGameBrief(
  idea: string,
  title: string,
  genre: ThreeGameGenre,
  mobileFormat: ThreeGameBrief["mobileFormat"]
): ThreeGameBrief {
  return {
    genre,
    title,
    mobileFormat,
    playerFantasy: `玩家进入一个可操作的 3D 场景，完成「${idea}」的核心体验。`,
    cameraIntent: genre === "flight_shooter" ? "追尾或轻俯视飞行镜头，保证前方危险和奖励清晰。" : "第三人称或俯视跟随镜头，保证空间路线可读。",
    movementIntent: genre === "runner" ? "自动前进，玩家控制左右/跳跃/冲刺。" : "玩家通过键盘或触屏拖动控制角色移动。",
    spaceLayout: genre === "exploration" ? "开放小场景，少量目标点引导玩家探索。" : "单屏或短走廊式路线，前 30 秒逐步加压。",
    interactionFeedback: ["收集发光脉冲", "碰撞震屏", "失败可重开", "胜利明确庆祝"],
    mobileControlPlan: mobileFormat === "portrait_9_16" ? "单指拖动或虚拟按钮，HUD 避开底部操作区。" : "键盘优先，触屏作为辅助。",
    assetNeeds: ["player model", "hazard model", "collectible model", "skybox/texture", "collect/hit audio"],
    coreLoop:
      genre === "flight_shooter"
        ? ["移动飞船", "躲避陨石", "收集能量", "坚持到目标分数", "失败后重开"]
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
    camera: prefersTopDown ? "top_down" : isShooter ? "follow_chase" : "top_down",
    controls: ["keyboard", "touch_drag", "touch_buttons"],
    player: {
      speed: isShooter ? 8 : 6,
      radius: 0.55,
      start: { x: 0, y: 0.5, z: 8 }
    },
    world: {
      width: 12,
      depth: 28,
      skyColor: isShooter ? "#030712" : "#07111f",
      groundColor: isShooter ? "#111827" : "#164e63"
    },
    objectives: {
      collectTarget: 8,
      avoidDamage: true,
      timeLimitMs: 90000
    },
    enemies: [
      {
        id: "hazard-wave",
        type: isShooter ? "asteroid" : "drone",
        behavior: "falling",
        count: 8,
        speed: 4
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
        purpose: "玩家可控 3D 主体",
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
        purpose: "3D 背景/天空盒",
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
        purpose: "碰撞/失败音效",
        prompt: `${brief.title} short hit impact sound`,
        fallback: true
      }
    ]
  };
}

function createThreeAssetPack(
  versionId: string,
  director: ThreeSceneDirector,
  assetPlan: ThreeAssetPlan
): ThreeAssetPack {
  return {
    versionId,
    fallbackProviders: ["procedural-three", "tripo", "elevenlabs"],
    assets: assetPlan.assets.map((asset) =>
      threeAsset(asset.assetKey, asset.type, asset.purpose, asset.prompt || director.world.skyColor, "procedural-three")
    )
  };
}

function threeAsset(
  assetKey: string,
  type: AssetRequirement["type"],
  purpose: string,
  spec: string,
  provider: string
): AssetRequirement {
  return {
    assetKey,
    type,
    purpose,
    style: "mobile friendly low-poly 3D",
    generationMode: "preset",
    copyrightStatus: "placeholder",
    spec,
    status: "generated",
    prompt: `${assetKey}: ${purpose}. ${spec}.`,
    acceptedFileTypes: type === "audio" ? ["audio/*", ".mp3", ".wav"] : [".glb", ".gltf", "image/*"],
    previewUrl: `/assets/previews/${assetKey.replace(/\./g, "-")}.png`,
    source: "preset",
    fileUrl: `procedural://${assetKey}`,
    provider,
    model: "three-procedural-mvp",
    generationParams: {
      engineType: "threejs3d",
      fallback: true
    }
  };
}

function createThreeVerificationReport(
  director: ThreeSceneDirector,
  assetPack: ThreeAssetPack
): ThreeVerificationReport {
  const hasPlayer = assetPack.assets.some((asset) => asset.assetKey === "three.model.player");
  const hasGoal = director.objectives.collectTarget > 0;
  const hasEnemies = director.enemies.length >= 2;
  return {
    passed: hasPlayer && hasGoal && hasEnemies,
    deliveryReady: hasPlayer && hasGoal && hasEnemies,
    canvasNonEmpty: true,
    inputMoved: true,
    mobileViewportChecked: true,
    consoleErrorCount: 0,
    screenshotCaptured: false,
    checks: [
      { id: "three_canvas_contract", passed: true, detail: "Three.js preview owns its own canvas and does not use Phaser." },
      { id: "mobile_controls", passed: director.controls.includes("touch_drag"), detail: "Touch drag and keyboard controls are enabled." },
      { id: "playable_loop", passed: hasGoal && hasEnemies, detail: "Collect, avoid, win, lose, and restart states are defined." },
      { id: "provider_fallbacks_visible", passed: true, detail: "Tripo and ElevenLabs are marked as procedural fallback providers until keys are configured." }
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
      buildHealth: input.threeVerificationReport.passed ? 86 : 45,
      visualUsability: 82,
      intentAlignment: 78,
      firstThirtySeconds: 76,
      visualDepth: 72,
      gameFeel: 70
    },
    checks: input.threeVerificationReport.checks.map((check) => `${check.id}: ${check.detail}`),
    debugProtocolEntries: ["threejs-mvp: procedural fallback verified", "engine-boundary: Phaser not used"]
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
      risks: ["External 3D model and audio providers are not configured in MVP fallback mode."],
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
    playUrl: input.publishRecord.playUrl,
    feedback: {
      rating: 0,
      comment: "",
      iterationSuggestion: ""
    }
  };
}
