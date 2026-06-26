import { z } from "zod";

export const templateFamilySchema = z.enum([
  "platformer",
  "top_down",
  "grid_logic",
  "tower_defense",
  "ui_heavy"
]);

export const classificationSchema = z.object({
  templateFamily: templateFamilySchema,
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
  unsupportedRequests: z.array(z.string())
});

export const ideaIntakeSchema = z.object({
  summary: z.string(),
  targetPlayer: z.string(),
  coreExperience: z.string(),
  missingFields: z.array(z.string())
});

export const designQuestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  inputType: z.enum(["single_choice", "multi_choice", "short_text", "number"]),
  options: z.array(z.string()).optional(),
  defaultAnswer: z.string(),
  required: z.boolean()
});

export const guidedQuestionsSchema = z.object({
  questions: z.array(designQuestionSchema).min(3).max(5)
});

export const designBriefSchema = z.object({
  coreGameplay: z.string(),
  playerGoal: z.string(),
  referenceTakeaways: z.array(z.string()),
  risks: z.array(z.string()),
  questionFocus: z.array(z.string()),
  developerPrompt: z.string()
});

export const matureGameBriefSchema = z.object({
  referencePatternId: z.string(),
  coreLoop: z.array(z.string()),
  firstThirtySeconds: z.array(z.string()),
  visualTheme: z.string(),
  feedbackChecklist: z.array(z.string()),
  difficultyCurve: z.array(z.string()),
  gameFeelMoments: z.array(z.string())
});

export const gameProductionBriefSchema = z.object({
  engineType: z.enum(["phaser2d", "threejs3d"]),
  templateFamily: templateFamilySchema.optional(),
  threeGenre: z.enum([
    "runner",
    "dodge_collect",
    "flight_shooter",
    "third_person_collect",
    "exploration",
    "futuristic_tower_defense"
  ]).optional(),
  playerFantasy: z.string(),
  coreLoop: z.array(z.string()).min(3),
  innovationHooks: z.array(z.string()).min(1),
  firstMinuteExperience: z.array(z.string()).min(3),
  difficultyCurve: z.array(z.string()).min(3),
  pressureTypes: z.array(z.string()).min(2),
  rewardPath: z.array(z.string()).min(1),
  failureFeedback: z.array(z.string()).min(1),
  restartMotivation: z.string(),
  audioMood: z.string(),
  assetStyle: z.string(),
  stabilityConstraints: z.array(z.string()).min(1),
  deferredRequests: z.array(z.string())
});

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be #RRGGBB hex");

export const styleSheetSchema = z.object({
  palette: z.tuple([hexColorSchema, hexColorSchema, hexColorSchema, hexColorSchema, hexColorSchema]),
  brushwork: z.enum(["pixel_clean", "cel_shaded", "painterly", "low_poly", "vector_flat"]),
  lighting: z.enum(["flat", "rim", "soft", "neon", "dramatic"]),
  era: z.enum(["fantasy", "modern", "retro", "sci_fi", "nature"]),
  subjectScale: z.enum(["tiny", "small", "medium", "large", "heroic"]),
  negativePrompt: z.string().min(1).max(200)
});

export const visualPromptPackSchema = z.object({
  packId: z.string(),
  engineType: z.enum(["phaser2d", "threejs3d"]),
  styleSheet: styleSheetSchema.optional(),
  prompts: z.array(z.object({
    assetKey: z.string(),
    slot: z.string(),
    promptType: z.enum(["background", "sprite", "cover_poster"]),
    finalImagePrompt: z.string(),
    negativePrompt: z.string(),
    format: z.enum(["png", "webp"]),
    runtimeUse: z.enum(["candidate_only", "runtime_after_confirmation"])
  })).min(1),
  isolationRules: z.array(z.string())
});

export const uiAssetKitSchema = z.object({
  packId: z.string(),
  prompts: z.array(z.object({
    assetKey: z.string(),
    componentType: z.enum(["skill_icons", "buttons", "hud_panel", "inventory_slots", "dialog_frame", "shop_card"]),
    finalImagePrompt: z.string(),
    slicingRequired: z.boolean(),
    runtimeEligible: z.boolean()
  })).min(1),
  sourceSkill: z.literal("game-ui-asset-kit")
});

export const audioPromptPackSchema = z.object({
  packId: z.string(),
  prompts: z.array(z.object({
    assetKey: z.enum([
      "bgm.loop",
      "sfx.collect",
      "sfx.hit",
      "sfx.win",
      "sfx.lose",
      "sfx.click",
      "sfx.explosion",
      "sfx.warning"
    ]),
    cue: z.string(),
    finalAudioPrompt: z.string(),
    durationSeconds: z.number(),
    loop: z.boolean()
  })).min(1),
  runtimeStrategy: z.enum(["procedural_fallback", "candidate_after_confirmation"])
});

export const modelPromptPackSchema = z.object({
  packId: z.string(),
  engineType: z.literal("threejs3d"),
  prompts: z.array(z.object({
    assetKey: z.enum(["three.model.player", "three.model.hazard", "three.model.collectible", "three.scene.environment"]),
    roleInGameplay: z.string(),
    finalModelPrompt: z.string(),
    qualityTier: z.enum(["builtin_low_poly", "uploaded", "tripo_enhanced", "cellcog_enhanced"]),
    polyBudget: z.number(),
    maxFileSizeMb: z.number(),
    runtimeScale: z.number(),
    colliderShape: z.enum(["sphere", "capsule", "box"])
  })).min(1),
  isolationRules: z.array(z.string())
});

export const sceneMapPlanSchema = z.object({
  engineType: z.enum(["phaser2d", "threejs3d"]),
  layoutMode: z.string(),
  backgroundMode: z.enum(["scene_cover", "tileable_map", "procedural_3d_scene"]),
  mapScale: z.string(),
  traversalBeats: z.array(z.string()),
  spawnZones: z.array(z.string())
});

export const assetReplacementReportSchema = z.object({
  projectId: z.string().optional(),
  assetKey: z.string(),
  previousFileUrl: z.string().optional(),
  candidateFileUrl: z.string(),
  status: z.enum(["candidate_created", "confirmed", "rejected"]),
  reason: z.string(),
  runtimeUpdated: z.boolean()
});

export const cellCogGenerationReportSchema = z.object({
  provider: z.literal("cellcog"),
  status: z.enum(["missing_key", "queued", "completed", "failed", "timeout"]),
  promptPackId: z.string(),
  slot: z.string(),
  requestedOutput: z.enum(["png", "webp", "glb", "mp3", "html", "pdf"]),
  outputFiles: z.array(z.object({
    fileUrl: z.string(),
    mimeType: z.string(),
    assetKey: z.string().optional()
  })),
  errors: z.array(z.string()),
  creditInfo: z.string().optional()
});

export const gddSchema = z.object({
  concept: z.string(),
  loop: z.array(z.string()),
  entities: z.array(z.string()),
  level: z.object({
    width: z.number(),
    height: z.number(),
    collectibles: z.number(),
    hazards: z.number(),
    winScore: z.number()
  }),
  numbers: z.record(z.union([z.string(), z.number()])),
  implementationRoute: z.string()
});

const assetTypeSchema = z.enum([
  "image",
  "sfx",
  "bgm",
  "effect",
  "ui",
  "build",
  "model",
  "texture",
  "skybox",
  "material",
  "audio",
  "icon"
]);

export const assetRequirementSchema = z.object({
  assetKey: z.string(),
  type: assetTypeSchema,
  purpose: z.string(),
  style: z.string(),
  generationMode: z.enum(["mock", "model", "uploaded", "preset"]),
  copyrightStatus: z.enum(["placeholder", "generated", "licensed", "user_provided"]),
  spec: z.string(),
  status: z.enum(["missing", "mock", "uploaded", "generated", "failed"]),
  prompt: z.string(),
  acceptedFileTypes: z.array(z.string()),
  previewUrl: z.string(),
  source: z.enum(["mock", "preset", "uploaded", "generated", "library"]),
  fileUrl: z.string(),
  provider: z.string(),
  model: z.string(),
  generationParams: z.record(z.union([z.string(), z.number(), z.boolean()])),
  transparentBackgroundRequired: z.boolean().optional(),
  targetSize: z.string().optional(),
  libraryTags: z.array(z.string()).optional(),
  libraryAssetId: z.string().optional(),
  derivedFromAssetKey: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  error: z.string().optional()
});

export const assetRequirementsSchema = z.array(assetRequirementSchema);

export const assetCandidateSchema = z.object({
  slot: z.enum(["player", "background", "hazard", "collectible", "cover", "bgm", "sfx"]),
  assetKey: z.string(),
  type: assetTypeSchema,
  label: z.string(),
  prompt: z.string(),
  style: z.string(),
  purpose: z.string(),
  acceptedFileTypes: z.array(z.string()),
  previewUrl: z.string().optional(),
  fileUrl: z.string().optional(),
  source: z.enum(["mock", "preset", "uploaded", "generated", "library"]).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  generationParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  error: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  slotRole: z.enum(["background", "sprite"]).optional(),
  requiresTransparency: z.boolean().optional(),
  subjectBounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }).optional(),
  alphaCoverage: z.number().optional(),
  validationStatus: z.enum(["passed", "warning", "failed"]).optional(),
  validationErrors: z.array(z.string()).optional()
});

export const assetCandidatesSchema = z.object({
  candidates: z.array(assetCandidateSchema).min(1)
});

export const confirmedAssetsSchema = z.object({
  assets: z.array(assetCandidateSchema.extend({
    previewUrl: z.string(),
    fileUrl: z.string(),
    source: z.enum(["mock", "preset", "uploaded", "generated", "library"])
  }))
});

export const revisionAnalysisSchema = z.object({
  understoodChange: z.string(),
  updatedDeveloperPrompt: z.string(),
  confirmationQuestions: z.array(designQuestionSchema),
  affectedAssets: z.array(z.string()),
  risks: z.array(z.string())
});

export const assetStyleGuideSchema = z.object({
  visualStyle: z.string(),
  palette: z.array(z.string()).min(4),
  shapeLanguage: z.string(),
  characterBrief: z.string(),
  environmentBrief: z.string(),
  audioStyle: z.string(),
  assetPrompts: z.record(z.string())
});

export const assetPackSchema = z.object({
  versionId: z.string(),
  assets: assetRequirementsSchema
}).superRefine((pack, context) => {
  for (const assetKey of findDuplicateAssetKeys(pack.assets)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Duplicate assetKey: ${assetKey}`,
      path: ["assets"]
    });
  }
});

export const gameConfigSchema = z.object({
  templateFamily: templateFamilySchema,
  title: z.string(),
  pitch: z.string(),
  playerGoal: z.string(),
  controls: z.array(z.string()),
  difficulty: z.enum(["easy", "normal", "hard"]),
  referencedAssetKeys: z.array(z.string()),
  gameplay: z.object({
    primaryAction: z.enum([
      "dodge_collect",
      "jump_reach_goal",
      "solve_grid",
      "defend_route",
      "manage_choices"
    ]),
    enemyBehavior: z.enum(["static", "patrol", "chase", "wave", "timer"]),
    objectiveMode: z.enum(["collect_score", "reach_exit", "survive_timer", "defend_base", "solve_state"]),
    playerAbility: z.enum(["dash", "jump", "push", "build", "choose"]),
    spawnPattern: z.enum(["fixed", "staggered", "lanes", "grid", "waves"])
  }),
  level: z.object({
    width: z.number(),
    height: z.number(),
    collectibles: z.number(),
    hazards: z.number(),
    winScore: z.number()
  })
});

export const gameHooksSchema = z.object({
  enemyRules: z.object({
    movement: z.enum(["static", "patrol", "chase", "wave"]),
    speed: z.number(),
    waveIntervalMs: z.number()
  }),
  collectibleRules: z.object({
    placement: z.enum(["line", "arc", "grid", "random"]),
    value: z.number(),
    respawn: z.boolean()
  }),
  winCondition: z.object({
    mode: z.enum(["collect_score", "reach_exit", "survive_timer", "defend_base", "solve_state"]),
    target: z.number()
  }),
  failCondition: z.object({
    mode: z.enum(["hit_hazard", "time_out", "base_destroyed", "moves_exhausted"]),
    lives: z.number()
  }),
  numberTuning: z.object({
    playerSpeed: z.number(),
    jumpVelocity: z.number(),
    hazardSpeed: z.number()
  }),
  levelLayout: z.object({
    platforms: z.array(z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })),
    lanes: z.array(z.object({ y: z.number(), speed: z.number(), count: z.number() })),
    grid: z.object({ columns: z.number(), rows: z.number() }),
    gridState: z.array(z.array(z.number())).optional()
  }),
  levelFlow: z.object({
    spawnPoint: z.object({ x: z.number(), y: z.number() }),
    safeZones: z.array(z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })),
    finishZone: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
    cameraIntent: z.string(),
    tutorialBeats: z.array(z.string())
  }).optional(),
  collisionRules: z.object({
    collisionRadius: z.number(),
    invulnerabilityMs: z.number(),
    knockbackForce: z.number()
  }).optional(),
  feedbackRules: z.object({
    particleCount: z.number(),
    screenShakeIntensity: z.number(),
    collectBurstCount: z.number(),
    floatingScore: z.boolean().optional(),
    comboText: z.boolean().optional(),
    audioCueKeys: z.array(z.string()).optional()
  }).optional(),
  spawnRules: z.object({
    hazardIntervalMs: z.number(),
    maxActiveHazards: z.number()
  }).optional(),
  visualLayerRules: z.object({
    backgroundTreatment: z.string(),
    foregroundProps: z.array(z.string()),
    uiBadgeStyle: z.string()
  }).optional(),
  difficultyRules: z.object({
    hazardRamp: z.string(),
    enemyPacing: z.string(),
    collectibleSpacing: z.string(),
    checkpointPolicy: z.string()
  }).optional(),
  enemyArchetypes: z.array(z.object({
    id: z.string(),
    type: z.enum(["chaser", "patroller", "charger", "shooter", "orbiter", "mine"]),
    count: z.number(),
    speed: z.number(),
    spawnAfterMs: z.number(),
    laneY: z.number().optional(),
    warningMs: z.number().optional()
  })).optional(),
  attackRules: z.object({
    contactDamage: z.number(),
    dashDamage: z.number(),
    projectileSpeed: z.number(),
    projectileCooldownMs: z.number(),
    explosionRadius: z.number(),
    explosionDelayMs: z.number(),
    warningMs: z.number()
  }).optional(),
  stageGoals: z.array(z.object({
    id: z.string(),
    label: z.string(),
    startsAtMs: z.number(),
    durationMs: z.number(),
    objective: z.enum(["learn_controls", "collect", "survive", "finale"]),
    target: z.number(),
    enemyMix: z.array(z.string()),
    rewardPacing: z.enum(["slow", "normal", "burst"]),
    enemySpawnDelta: z.number().optional(),
    speedMultiplier: z.number().optional(),
    bgmIntensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional()
  })).optional(),
  scoreTiers: z.object({
    targetDurationMs: z.number(),
    gold: z.object({
      minScore: z.number(),
      maxDeathCount: z.number(),
      maxDurationMs: z.number()
    }),
    silver: z.object({
      minScore: z.number(),
      maxDeathCount: z.number()
    }),
    bronze: z.object({
      minScore: z.number()
    }),
    rationale: z.string()
  }).optional(),
  impactRules: z.object({
    hitStopMs: z.number(),
    screenShakeIntensity: z.number(),
    explosionParticles: z.number(),
    knockbackForce: z.number(),
    invulnerabilityMs: z.number(),
    comboWindowMs: z.number()
  }).optional(),
  encounterTimeline: z.array(z.object({
    atMs: z.number(),
    trigger: z.enum(["time", "score"]),
    event: z.enum(["spawn_wave", "spawn_mine", "projectile_burst", "reward_burst", "finale"]),
    intensity: z.number(),
    message: z.string()
  })).optional()
});

export const gameplayDslRuleSchema = z.object({
  id: z.string(),
  when: z.string().refine((value) => /^(timeMs|score)\s*(>=|>|=)\s*\d+$/.test(value), {
    message: "Trigger must be declarative, for example: score >= 3"
  }),
  do: z.enum(["spawn_wave", "spawn_mine", "projectile_burst", "reward_burst", "stage_change", "effect"]),
  enemyType: z.enum(["chaser", "patroller", "charger", "shooter", "orbiter", "mine"]).optional(),
  count: z.number().optional(),
  effect: z.enum(["screen_shake", "explosion", "collect_burst", "hit_flash"]).optional(),
  stageId: z.string().optional(),
  assetKey: z.string().optional(),
  message: z.string().optional()
});

export const gameplayDslV1Schema = z.object({
  version: z.literal("1"),
  rules: z.array(gameplayDslRuleSchema).max(24)
});

const dslComparisonOpSchema = z.enum(["<", "<=", "=", ">=", ">"]);

export const gameplayDslV2WhenSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("time"), op: dslComparisonOpSchema, value: z.number() }),
  z.object({ type: z.literal("score"), op: dslComparisonOpSchema, value: z.number() }),
  z.object({ type: z.literal("collected"), assetKey: z.string(), count: z.number() }),
  z.object({ type: z.literal("enemiesAlive"), op: z.enum(["<=", "<", "="]), value: z.number() }),
  z.object({ type: z.literal("stage"), id: z.string() }),
  z.object({ type: z.literal("hpBelow"), percent: z.number().min(0).max(100) }),
  z.object({ type: z.literal("zoneEntered"), zoneId: z.string() }),
  z.object({ type: z.literal("combo"), op: z.enum([">=", ">", "="]), value: z.number() })
]);

export const gameplayDslV2ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("spawn_zone"),
    zoneId: z.string(),
    enemyType: z.enum(["chaser", "patroller", "charger", "shooter", "orbiter", "mine"]).optional(),
    count: z.number().optional()
  }),
  z.object({ type: z.literal("open_door"), assetKey: z.string() }),
  z.object({ type: z.literal("grant_item"), assetKey: z.string() }),
  z.object({ type: z.literal("set_counter"), name: z.string(), value: z.number() }),
  z.object({ type: z.literal("change_player_speed"), multiplier: z.number().optional(), mul: z.number().optional() }),
  z.object({ type: z.literal("fail"), message: z.string().optional() }),
  z.object({ type: z.literal("win"), message: z.string().optional() })
]);

export const gameplayDslV2RuleSchema = z.object({
  id: z.string(),
  when: gameplayDslV2WhenSchema,
  do: z.array(gameplayDslV2ActionSchema).min(1)
});

export const gameplayDslV2Schema = z.object({
  version: z.literal("2"),
  rules: z.array(gameplayDslV2RuleSchema).max(80),
  zones: z.array(z.object({ id: z.string(), x: z.number(), y: z.number(), width: z.number(), height: z.number() })).max(16).optional(),
  counters: z.array(z.object({ name: z.string(), initialValue: z.number() })).max(16).optional(),
  items: z.array(z.object({ assetKey: z.string(), grantsCounter: z.string().optional(), value: z.number().optional() })).max(16).optional()
});

export const gameplayDslSchema = z.discriminatedUnion("version", [
  gameplayDslV1Schema,
  gameplayDslV2Schema
]);

export const phaserPluginDirectorActionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.enum(["spawn_enemy", "spawn_projectile", "spawn_item"]),
    atMs: z.number(),
    count: z.number().optional(),
    enemyType: z.enum(["chaser", "patroller", "charger", "shooter", "orbiter", "mine"]).optional(),
    assetKey: z.string().optional()
  }),
  z.object({
    id: z.string(),
    type: z.enum(["moving_platform", "path_lane"]),
    atMs: z.number(),
    x: z.number().optional(),
    y: z.number().optional(),
    speed: z.number().optional(),
    count: z.number().optional()
  }),
  z.object({
    id: z.string(),
    type: z.literal("status_effect"),
    atMs: z.number(),
    effect: z.enum(["slow", "shield", "stun", "speed_boost"]),
    durationMs: z.number()
  }),
  z.object({
    id: z.string(),
    type: z.literal("camera_shake"),
    atMs: z.number(),
    intensity: z.number().optional()
  }),
  z.object({
    id: z.string(),
    type: z.enum(["particles", "hit_flash", "ui_update"]),
    atMs: z.number(),
    message: z.string().optional()
  }),
  z.object({
    id: z.string(),
    type: z.literal("player_ability"),
    ability: z.enum(["dash", "shoot", "jump", "block", "interact"])
  }),
  z.object({
    id: z.string(),
    type: z.literal("custom_code"),
    code: z.string()
  }),
  z.object({
    id: z.string(),
    type: z.literal("scene_lifecycle"),
    lifecycle: z.string()
  })
]);

export const phaserPluginDirectorSchema = z.object({
  version: z.literal("1"),
  profileId: z.string(),
  actions: z.array(phaserPluginDirectorActionSchema).max(32)
});

export const sandboxPluginSchema = z.object({
  version: z.literal("1"),
  name: z.string(),
  code: z.string().max(12000),
  allowedApis: z.array(z.string()),
  referencedAssetKeys: z.array(z.string()),
  fallbackLayer: z.enum(["gameplay-dsl", "game-hooks"])
});

export const sandboxValidationResultSchema = z.object({
  accepted: z.boolean(),
  errors: z.array(z.string()),
  referencedAssetKeys: z.array(z.string()),
  fallbackLayer: z.enum(["gameplay-dsl", "game-hooks"])
});

export const qaReportSchema = z.object({
  scores: z.object({
    buildHealth: z.number(),
    visualUsability: z.number(),
    intentAlignment: z.number(),
    firstThirtySeconds: z.number().optional(),
    visualDepth: z.number().optional(),
    gameFeel: z.number().optional()
  }),
  checks: z.array(z.string()),
  debugProtocolEntries: z.array(z.string()),
  gate: z.object({
    shouldPublish: z.boolean(),
    reasons: z.array(z.string()),
    dimensions: z.array(z.object({
      id: z.string(),
      score: z.number(),
      threshold: z.number(),
      gate: z.boolean(),
      passed: z.boolean()
    }))
  }).optional(),
  evidence: z.object({
    canvasNonEmpty: z.boolean(),
    consoleErrorCount: z.number(),
    screenshotCaptured: z.boolean(),
    playerMoved: z.boolean(),
    interactionObserved: z.boolean()
  }).optional()
});

export const publishRecordSchema = z.object({
  versionId: z.string(),
  status: z.enum(["draft", "published"]),
  playUrl: z.string(),
  publicUrl: z.string().url(),
  coverAssetKey: z.string(),
  shareTitle: z.string(),
  shareDescription: z.string(),
  visibility: z.enum(["private", "unlisted", "public"]),
  publishedAt: z.string()
});

export const iterationReportSchema = z.object({
  source: z.string(),
  recommendedChanges: z.array(z.string())
});

export const artifactSchemas = {
  "idea-intake": ideaIntakeSchema,
  "guided-questions": guidedQuestionsSchema,
  "design-brief": designBriefSchema,
  classification: classificationSchema,
  "mature-game-brief": matureGameBriefSchema,
  gdd: gddSchema,
  "style-sheet": styleSheetSchema,
  "asset-requirements": assetRequirementsSchema,
  "asset-candidates": assetCandidatesSchema,
  "confirmed-assets": confirmedAssetsSchema,
  "asset-style-guide": assetStyleGuideSchema,
  "asset-pack": assetPackSchema,
  "game-config": gameConfigSchema,
  "game-hooks": gameHooksSchema,
  "gameplay-dsl": gameplayDslSchema,
  "phaser-plugin-director": phaserPluginDirectorSchema,
  "sandbox-plugin": sandboxPluginSchema,
  "qa-report": qaReportSchema,
  "publish-record": publishRecordSchema,
  "iteration-report": iterationReportSchema
} as const;

export type ArtifactType = keyof typeof artifactSchemas;

export function validateArtifact(type: ArtifactType, payload: unknown) {
  return artifactSchemas[type].safeParse(payload);
}

export function createCoreSchemaSnapshot() {
  return {
    assetPack: summarizeZodSchema(assetPackSchema),
    gameConfig: summarizeZodSchema(gameConfigSchema),
    gameHooks: summarizeZodSchema(gameHooksSchema),
    gameplayDsl: summarizeZodSchema(gameplayDslSchema),
    styleSheet: summarizeZodSchema(styleSheetSchema)
  };
}

function summarizeZodSchema(schema: z.ZodTypeAny): unknown {
  const typeName = schema._def.typeName;
  if (typeName === z.ZodFirstPartyTypeKind.ZodObject) {
    const shape = (schema as z.ZodObject<Record<string, z.ZodTypeAny>>).shape;
    return {
      type: "object",
      fields: Object.fromEntries(
        Object.entries(shape)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => [key, summarizeZodSchema(value)])
      )
    };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodArray) {
    return {
      type: "array",
      item: summarizeZodSchema((schema as z.ZodArray<z.ZodTypeAny>)._def.type),
      min: (schema as z.ZodArray<z.ZodTypeAny>)._def.minLength?.value,
      max: (schema as z.ZodArray<z.ZodTypeAny>)._def.maxLength?.value
    };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodEnum) {
    return { type: "enum", values: (schema as z.ZodEnum<[string, ...string[]]>)._def.values };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodLiteral) {
    return { type: "literal", value: (schema as z.ZodLiteral<unknown>)._def.value };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
    return { type: "optional", inner: summarizeZodSchema((schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType) };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodRecord) {
    return { type: "record", value: summarizeZodSchema((schema as z.ZodRecord)._def.valueType) };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodUnion) {
    return { type: "union", options: (schema as z.ZodUnion<[z.ZodTypeAny, z.ZodTypeAny]>)._def.options.map(summarizeZodSchema) };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion) {
    const def = (schema as z.ZodDiscriminatedUnion<string, z.ZodDiscriminatedUnionOption<string>[]>)._def;
    return {
      type: "discriminatedUnion",
      discriminator: def.discriminator,
      options: Array.from(def.options.values()).map(summarizeZodSchema)
    };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    return { type: "effects", inner: summarizeZodSchema((schema as z.ZodEffects<z.ZodTypeAny>)._def.schema) };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodTuple) {
    return { type: "tuple", items: (schema as z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>)._def.items.map(summarizeZodSchema) };
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodString) return { type: "string" };
  if (typeName === z.ZodFirstPartyTypeKind.ZodNumber) return { type: "number" };
  if (typeName === z.ZodFirstPartyTypeKind.ZodBoolean) return { type: "boolean" };
  return { type: typeName };
}

export function findDuplicateAssetKeys(assets: Array<{ assetKey: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.assetKey)) {
      duplicates.add(asset.assetKey);
    }
    seen.add(asset.assetKey);
  }
  return Array.from(duplicates).sort();
}

export function validateProjectAssetUpload(
  requirement: { acceptedFileTypes: string[]; type: string },
  fileName: string
) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const accepted = requirement.acceptedFileTypes;
  const matches = accepted.some((type) => {
    if (type === "*/*") return true;
    if (type.startsWith(".")) return type.slice(1).toLowerCase() === extension;
    if (type === "image/*") return ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);
    if (type === "audio/*") return ["mp3", "wav", "ogg", "m4a"].includes(extension);
    if (type === "application/json") return extension === "json";
    if (type === "model/gltf-binary") return extension === "glb" || extension === "gltf";
    return false;
  });

  return matches
    ? { success: true as const }
    : {
        success: false as const,
        error: `File type .${extension || "unknown"} is not accepted for ${requirement.type}`
      };
}
