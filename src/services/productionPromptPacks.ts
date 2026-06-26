import type {
  AudioPromptPack,
  EngineType,
  GameProductionBrief,
  ModelPromptPack,
  SceneMapPlan,
  StyleSheet,
  TemplateFamily,
  ThreeGameBrief,
  ThreeGameGenre,
  ThreeSceneDirector,
  UiAssetKit,
  VisualPromptPack
} from "../core/types";
import {
  buildGameDevPromptBundle,
  gameDevPromptProfiles
} from "./gameDevPromptLibrary";
import {
  getPhaserAssetProfile,
  getThreeAssetProfile,
  refineAssetSubjectForIdea,
  type RuntimeImageSlot
} from "./gameAssetProfiles";

const BANNED_PROVIDER_TERMS = [
  "developerPrompt",
  "Phaser",
  "Three.js",
  "gameHooks",
  "scene lifecycle",
  "WASD",
  "win condition",
  "TypeScript",
  "JavaScript"
];

export function createGameProductionBrief(input: {
  idea: string;
  engineType: EngineType;
  templateFamily?: TemplateFamily;
  threeGenre?: ThreeGameGenre;
  title?: string;
  gameTypeLabel?: string;
}): GameProductionBrief {
  const typeLabel = input.gameTypeLabel ?? input.threeGenre ?? input.templateFamily ?? "arcade";
  const promptProfile = selectPromptProfile(input);
  const promptBundle = promptProfile
    ? buildGameDevPromptBundle({
        idea: input.idea,
        profileId: promptProfile.id,
        engineType: input.engineType
      })
    : null;
  const firstMinute =
    promptProfile
      ? promptProfile.productionBeats
      :
    input.engineType === "threejs3d"
      ? ["teach camera and movement", "introduce the first readable 3D objective", "add pressure with one clear counterplay", "resolve with a win or restart beat"]
      : ["show the player goal immediately", "give one safe reward", "introduce a readable hazard", "escalate into a short finale"];
  return {
    engineType: input.engineType,
    templateFamily: input.templateFamily,
    threeGenre: input.threeGenre,
    playerFantasy: `${input.idea} - ${typeLabel} player fantasy with a clear controllable hero.`,
    coreLoop: promptProfile?.productionBeats ?? ["read the objective", "move with intent", "take a risk", "collect or defend", "receive feedback and retry"],
    innovationHooks: [
      "one recognizable fantasy-specific mechanic",
      "one escalating pressure pattern",
      "one short reward burst after mastery",
      ...(promptBundle ? [`profile: ${promptProfile?.label}`] : [])
    ],
    firstMinuteExperience: firstMinute,
    difficultyCurve: ["safe tutorial beat", "mixed reward and hazard beat", "pressure wave", "finale check"],
    pressureTypes: promptProfile?.pressureTypes ?? ["spatial pressure", "timing pressure"],
    rewardPath: promptProfile?.rewardPath ?? ["visible pickups", "score or resource feedback", "clear victory target"],
    failureFeedback: ["hit flash", "short audio cue", "restart prompt with preserved goal clarity"],
    restartMotivation: "A failed run should feel short, readable, and worth replaying for one better route.",
    audioMood: inferAudioMood(input.idea),
    assetStyle: inferAssetStyle(input.idea),
    stabilityConstraints: [
      "Use locked Phaser or Three runtime only.",
      "External generated assets become candidates before runtime use.",
      "Keep controls, hitboxes, and asset sizes predictable."
    ],
    deferredRequests: ["free engine lifecycle code generation", "unverified high-poly 3D assets"]
  };
}

function selectPromptProfile(input: {
  idea: string;
  templateFamily?: TemplateFamily;
  threeGenre?: ThreeGameGenre;
}) {
  const lower = input.idea.toLowerCase();
  if (input.threeGenre) {
    const byThreeGenre = gameDevPromptProfiles.find((profile) => profile.threeGenre === input.threeGenre);
    if (byThreeGenre) return byThreeGenre;
  }
  if (/塔防|炮塔|防守|tower/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "strategy_tower_defense");
  if (/3d|太空射击|boss|飞船|space shooter/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "three_d_space_shooter");
  if (/跑酷|runner|竞速|赛车|racing/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "racing");
  if (/平台|跳跃|platform|jump/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "platform_jumper");
  if (/三消|match/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "match_three");
  if (/卡牌|card/.test(lower)) return gameDevPromptProfiles.find((profile) => profile.id === "card_battle");
  if (input.templateFamily) {
    return gameDevPromptProfiles.find((profile) => profile.templateFamily === input.templateFamily);
  }
  return undefined;
}

export function createVisualPromptPack(input: {
  idea: string;
  engineType: EngineType;
  productionBrief: GameProductionBrief;
  packId?: string;
  styleSheet?: StyleSheet;
}): VisualPromptPack {
  const packId = input.packId ?? `visual-${Date.now().toString(36)}`;
  const style = sanitizeProviderPrompt(input.productionBrief.assetStyle);
  const stylePrefix = input.styleSheet ? formatStyleSheetPrefix(input.styleSheet) : "";
  const posterIdea = sanitizeProviderPrompt(input.idea);
  const profile =
    input.engineType === "threejs3d" && input.productionBrief.threeGenre
      ? getThreeAssetProfile(input.productionBrief.threeGenre)
      : getPhaserAssetProfile(input.productionBrief.templateFamily ?? "top_down");
  const runtimePrompts = (["background", "player", "hazard", "collectible"] as RuntimeImageSlot[]).map((slotName) => {
    const slot = profile.slots[slotName];
    const isBackground = slot.promptType === "background";
    const subject = refineAssetSubjectForIdea(input.idea, slotName, slot.subject);
    const finalImagePrompt = [
      ...(stylePrefix ? [stylePrefix] : []),
      isBackground ? "Professional game environment background only" : "Professional game runtime sprite/model concept only",
      `assetKey: ${slot.assetKey}`,
      `slot: ${slot.slot}`,
      `subject: ${subject}`,
      slot.composition,
      style,
      isBackground
        ? "pure map or environment plate, no foreground gameplay subjects"
        : "single subject only, isolated and centered, transparent PNG/chroma key friendly, no scene background",
      `negative constraints: ${slot.negativePrompt}`
    ].join("; ");
    return {
      assetKey: slot.assetKey,
      slot: slot.slot,
      promptType: slot.promptType,
      finalImagePrompt: sanitizeProviderPrompt(finalImagePrompt),
      negativePrompt: mergeNegativePrompt(slot.negativePrompt, input.styleSheet),
      format: slot.format,
      runtimeUse: "runtime_after_confirmation" as const
    };
  });
  const posterNegativePrompt = mergeNegativePrompt(
    "runtime sprite sheet, engine screenshot, code, cluttered text",
    input.styleSheet
  );
  return {
    packId,
    engineType: input.engineType,
    styleSheet: input.styleSheet,
    prompts: [
      ...runtimePrompts,
      {
        assetKey: "cover.main",
        slot: "poster",
        promptType: "cover_poster",
        finalImagePrompt: sanitizeProviderPrompt(
          `${stylePrefix ? `${stylePrefix}; ` : ""}Professional game cover poster; assetKey: cover.main; slot: poster; promotional key art for ${posterIdea}; show the game's theme with title-safe composition, hero, threat, and reward allowed; ${style}; not a runtime sprite.`
        ),
        negativePrompt: posterNegativePrompt,
        format: "webp",
        runtimeUse: "candidate_only"
      }
    ],
    isolationRules: createProviderIsolationRules()
  };
}

function formatStyleSheetPrefix(styleSheet: StyleSheet): string {
  return sanitizeProviderPrompt(
    `Style: palette=${styleSheet.palette.join(",")}; brushwork=${styleSheet.brushwork}; lighting=${styleSheet.lighting}; era=${styleSheet.era}; subjectScale=${styleSheet.subjectScale}`
  );
}

function mergeNegativePrompt(slotNegativePrompt: string, styleSheet?: StyleSheet): string {
  return sanitizeProviderPrompt(
    [slotNegativePrompt, styleSheet?.negativePrompt].filter(Boolean).join(", ")
  );
}

function createLegacyVisualPromptPack(input: {
  idea: string;
  engineType: EngineType;
  productionBrief: GameProductionBrief;
  packId?: string;
}): VisualPromptPack {
  const packId = input.packId ?? `visual-${Date.now().toString(36)}`;
  const style = sanitizeProviderPrompt(input.productionBrief.assetStyle);
  const posterIdea = sanitizeProviderPrompt(input.idea);
  const labels = infer2DVisualSubjects(input.idea);
  const backgroundPrompt =
    `Professional 2D game background only; assetKey: world.background; slot: background; subject: ${labels.background}. ` +
    `Pure environment plate, ${labels.backgroundDetails}, 16:9 scene cover, ${style}, strong depth layers, readable empty play area, no foreground actors, no objects, no UI, no text, no logo.`;
  const playerPrompt =
    `Professional 2D player sprite only; assetKey: player.ship; slot: player; subject: ${labels.player}. ` +
    `Single controllable player subject only, isolated and centered, solid chroma green background, clean silhouette, ${style}, no extra objects, no environment, no UI, no text.`;
  const hazardPrompt =
    `Professional 2D hazard sprite only; assetKey: hazard.enemy; slot: hazard; subject: ${labels.hazard}. ` +
    `Single dangerous obstacle subject only, isolated and centered, solid chroma green background, sharp readable shape, ${style}, no extra objects, no environment, no UI, no text.`;
  const collectiblePrompt =
    `Professional 2D collectible sprite only; assetKey: item.collectible; slot: collectible; subject: ${labels.collectible}. ` +
    `Single reward pickup subject only, isolated and centered, solid chroma green background, high contrast, readable at small size, ${style}, no extra objects, no environment, no UI, no text.`;
  return {
    packId,
    engineType: input.engineType,
    prompts: [
      {
        assetKey: "world.background",
        slot: "background",
        promptType: "background",
        finalImagePrompt: sanitizeProviderPrompt(backgroundPrompt),
        negativePrompt: "spaceship, ship, player, character, enemy, asteroid foreground subject, collectible, energy orb, UI, text, logo, white border, screenshot, engine code",
        format: "webp",
        runtimeUse: "runtime_after_confirmation"
      },
      {
        assetKey: "player.ship",
        slot: "player",
        promptType: "sprite",
        finalImagePrompt: sanitizeProviderPrompt(playerPrompt),
        negativePrompt: "background scene, asteroid, meteor, enemy, collectible, energy orb, UI, text, logo, blur, cropped subject, engine code",
        format: "png",
        runtimeUse: "runtime_after_confirmation"
      },
      {
        assetKey: "hazard.enemy",
        slot: "hazard",
        promptType: "sprite",
        finalImagePrompt: sanitizeProviderPrompt(hazardPrompt),
        negativePrompt: "spaceship, ship, player, hero, collectible, reward, background scene, UI, friendly reward, text, logo, engine code",
        format: "png",
        runtimeUse: "runtime_after_confirmation"
      },
      {
        assetKey: "item.collectible",
        slot: "collectible",
        promptType: "sprite",
        finalImagePrompt: sanitizeProviderPrompt(collectiblePrompt),
        negativePrompt: "spaceship, ship, player, asteroid, meteor, enemy, hazard, background scene, UI panel, text, logo, engine code",
        format: "png",
        runtimeUse: "runtime_after_confirmation"
      },
      {
        assetKey: "cover.main",
        slot: "poster",
        promptType: "cover_poster",
        finalImagePrompt: sanitizeProviderPrompt(
          `专业游戏封面海报提示词; assetKey: cover.main; slot: poster; subject: ${labels.poster}. Promotional game cover poster for ${posterIdea}. 16:9 dynamic key art, title-safe composition, hero plus threat plus reward, ${style}, no small UI.`
        ),
        negativePrompt: "runtime sprite sheet, engine screenshot, code, cluttered text",
        format: "webp",
        runtimeUse: "candidate_only"
      }
    ],
    isolationRules: createProviderIsolationRules()
  };
}

function infer2DVisualSubjects(idea: string): {
  background: string;
  backgroundDetails: string;
  player: string;
  hazard: string;
  collectible: string;
  poster: string;
} {
  const lower = idea.toLowerCase();
  const space = /太空|宇宙|星空|飞船|space|ship|meteor|asteroid/.test(lower);
  const cat = /猫|cat/.test(lower);
  const meteor = /陨石|流星|meteor|asteroid/.test(lower);
  const fish = /鱼干|fish/.test(lower);
  const coin = /金币|coin/.test(lower);
  const energy = /能量|energy|orb|core/.test(lower);
  const star = /星星|star/.test(lower);
  return {
    background: space ? "deep space starfield and nebula background" : "thematic game environment background",
    backgroundDetails: space
      ? "starfield, nebula clouds, distant planets, cosmic dust, parallax-ready empty gameplay space"
      : "environment layers, distant landmarks, parallax-ready empty gameplay space",
    player: cat && space ? "太空猫飞船主角" : space ? "玩家飞船主角" : "玩家主角",
    hazard: meteor ? "陨石危险物" : "敌人危险物",
    collectible: fish ? "鱼干收集物" : coin ? "金币收集物" : energy ? "glowing energy orb collectible" : star ? "星星收集物" : "奖励收集物",
    poster: space ? "科幻动作游戏封面" : "游戏宣传封面"
  };
}

export function createUiAssetKit(input: {
  idea: string;
  productionBrief: GameProductionBrief;
  packId?: string;
}): UiAssetKit {
  const packId = input.packId ?? `ui-${Date.now().toString(36)}`;
  const context = `Context: Generate a 2D Game UI Asset Pack for ${sanitizeProviderPrompt(input.idea)} on web and mobile.`;
  const style = `Style: ${sanitizeProviderPrompt(input.productionBrief.assetStyle)}, cohesive game UI, readable silhouettes, polished finish, compact HUD-safe frames.`;
  const technical =
    "Technical: transparent PNG atlas sheet, high contrast, readable at 48px mobile size, centered components, enough padding, no text unless requested, slicing metadata required before runtime use.";
  const prompt = [
    context,
    "Subject: A set of 8 reusable HUD and action components arranged as a 4x2 atlas sheet.",
    "Items:",
    "1. Collect cue icon (gold, pickup sparkle, reward)",
    "2. Hit warning icon (red, impact burst, danger)",
    "3. Win badge (cyan and gold, star crest, success)",
    "4. Retry button symbol (white arrow loop, restart)",
    "5. Health pip (red core, remaining lives)",
    "6. Score token (yellow counter chip, progress)",
    "7. Pause button symbol (blue frame, pause)",
    "8. Alert panel frame (orange edge, warning message area)",
    style,
    technical
  ].join("\n");
  return {
    packId,
    sourceSkill: "game-ui-asset-kit",
    prompts: [
      {
        assetKey: "ui.sheet.core_hud",
        componentType: "hud_panel",
        finalImagePrompt: sanitizeProviderPrompt(prompt),
        slicingRequired: true,
        runtimeEligible: false
      }
    ]
  };
}

export function createAudioPromptPack(input: {
  idea: string;
  productionBrief: GameProductionBrief;
  packId?: string;
}): AudioPromptPack {
  const packId = input.packId ?? `audio-${Date.now().toString(36)}`;
  const mood = sanitizeProviderPrompt(input.productionBrief.audioMood);
  const idea = sanitizeProviderPrompt(input.idea);
  const cue = (assetKey: AudioPromptPack["prompts"][number]["assetKey"], label: string, durationSeconds: number, loop = false) => ({
    assetKey,
    cue: label,
    finalAudioPrompt: sanitizeProviderPrompt(`${label} sound for ${idea}. ${mood}. Clean game mix, no voice, no copyrighted melody.`),
    durationSeconds,
    loop
  });
  return {
    packId,
    runtimeStrategy: "procedural_fallback",
    prompts: [
      cue("bgm.loop", "short seamless background loop", 24, true),
      cue("sfx.collect", "bright collect pickup", 1),
      cue("sfx.hit", "sharp hit impact", 1),
      cue("sfx.win", "compact victory sting", 3),
      cue("sfx.lose", "short failure sting", 3),
      cue("sfx.click", "clean UI click", 1),
      cue("sfx.explosion", "small arcade explosion", 2),
      cue("sfx.warning", "urgent warning beep", 1)
    ]
  };
}

export function createModelPromptPack(input: {
  idea: string;
  threeGameBrief: ThreeGameBrief;
  threeSceneDirector: ThreeSceneDirector;
  packId?: string;
}): ModelPromptPack {
  const packId = input.packId ?? `model-${Date.now().toString(36)}`;
  const genre = input.threeGameBrief.genre;
  const idea = sanitizeProviderPrompt(input.idea);
  const profile = getThreeAssetProfile(genre);
  const common = `Low-poly game-ready GLB asset for ${idea}, ${genre}, clean silhouette, PBR materials, centered origin, no full scene, no text.`;
  const promptFor = (slotName: RuntimeImageSlot) => {
    const slot = profile.slots[slotName];
    return sanitizeProviderPrompt(`${common} Subject: ${slot.subject}. ${slot.composition}. Negative constraints: ${slot.negativePrompt}.`);
  };
  return {
    packId,
    engineType: "threejs3d",
    prompts: [
      {
        assetKey: "three.model.player",
        roleInGameplay: profile.slots.player.purpose,
        finalModelPrompt: promptFor("player"),
        qualityTier: "builtin_low_poly",
        polyBudget: 3000,
        maxFileSizeMb: 1,
        runtimeScale: 1,
        colliderShape: "capsule"
      },
      {
        assetKey: "three.model.hazard",
        roleInGameplay: profile.slots.hazard.purpose,
        finalModelPrompt: promptFor("hazard"),
        qualityTier: "builtin_low_poly",
        polyBudget: 2500,
        maxFileSizeMb: 1,
        runtimeScale: 1,
        colliderShape: "box"
      },
      {
        assetKey: "three.model.collectible",
        roleInGameplay: profile.slots.collectible.purpose,
        finalModelPrompt: promptFor("collectible"),
        qualityTier: "builtin_low_poly",
        polyBudget: 1200,
        maxFileSizeMb: 0.5,
        runtimeScale: 1,
        colliderShape: "sphere"
      },
      {
        assetKey: "three.scene.environment",
        roleInGameplay: profile.slots.background.purpose,
        finalModelPrompt: promptFor("background"),
        qualityTier: "builtin_low_poly",
        polyBudget: 3000,
        maxFileSizeMb: 1,
        runtimeScale: 1,
        colliderShape: "box"
      }
    ],
    isolationRules: createProviderIsolationRules()
  };
}

function describeThreeGenreModelKeywords(genre: ThreeGameGenre): string {
  if (genre === "flight_shooter") return "spaceship aircraft asteroid energy";
  if (genre === "runner") return "runner lane barrier coin";
  if (genre === "third_person_collect") return "third-person guardian treasure patrol";
  if (genre === "exploration") return "explorer landmark discovery crystal";
  if (genre === "futuristic_tower_defense") return "futuristic tower defense turret drone energy core";
  return "arena dodge hazard reward orb";
}

export function createSceneMapPlan(input: {
  engineType: EngineType;
  templateFamily?: TemplateFamily;
  threeSceneDirector?: ThreeSceneDirector;
}): SceneMapPlan {
  if (input.engineType === "threejs3d" && input.threeSceneDirector) {
    return {
      engineType: "threejs3d",
      layoutMode: input.threeSceneDirector.layoutMode ?? "small_arena",
      backgroundMode: "procedural_3d_scene",
      mapScale: `${input.threeSceneDirector.world.width} x ${input.threeSceneDirector.world.depth}`,
      traversalBeats: (input.threeSceneDirector.stages ?? []).map((stage) => stage.label),
      spawnZones: input.threeSceneDirector.enemies.map((enemy) => `${enemy.type}:${enemy.behavior}`)
    };
  }
  const tileable = input.templateFamily === "top_down" || input.templateFamily === "platformer";
  return {
    engineType: "phaser2d",
    layoutMode: input.templateFamily ?? "top_down",
    backgroundMode: tileable ? "tileable_map" : "scene_cover",
    mapScale: tileable ? "extended scrolling or repeated background tiles" : "single 960x540 scene",
    traversalBeats: ["safe start", "reward route", "hazard pressure", "finale"],
    spawnZones: ["player safe zone", "hazard lanes", "reward clusters"]
  };
}

export function sanitizeProviderPrompt(prompt: string): string {
  return BANNED_PROVIDER_TERMS.reduce(
    (current, term) => current.replace(new RegExp(escapeRegExp(term), "gi"), ""),
    prompt
  )
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

export function createProviderIsolationRules(): string[] {
  return [
    "Use only visual, audio, UI, or model production language for the provider.",
    "Do not include engine lifecycle, code, controls, hooks, developer prompts, or win/loss logic.",
    "Generated files are candidates until validated and confirmed."
  ];
}

function inferAudioMood(idea: string): string {
  const lower = idea.toLowerCase();
  if (/horror|恐怖|鬼|惊悚/.test(lower)) return "tense, dark, minimal, with clear alert stingers";
  if (/space|sci|科幻|飞船|宇宙|塔防/.test(lower)) return "futuristic arcade, pulsing synths, crisp impacts";
  if (/cute|猫|可爱|治愈/.test(lower)) return "bright, playful, short toy-like feedback";
  return "arcade action, readable feedback, energetic but not noisy";
}

function inferAssetStyle(idea: string): string {
  const lower = idea.toLowerCase();
  if (/pixel|像素/.test(lower)) return "polished pixel art with strong silhouettes";
  if (/科幻|space|sci|飞船|塔防|未来/.test(lower)) return "premium low-poly sci-fi with neon accents and readable shapes";
  if (/水墨|国风/.test(lower)) return "stylized ink-painting game art with crisp gameplay readability";
  return "colorful arcade game art with strong silhouettes and high contrast";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
