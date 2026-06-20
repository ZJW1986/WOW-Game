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

export const assetRequirementSchema = z.object({
  assetKey: z.string(),
  type: z.enum(["image", "sfx", "bgm", "effect", "ui", "build"]),
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
  type: z.enum(["image", "sfx", "bgm", "effect", "ui", "build"]),
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
    grid: z.object({ columns: z.number(), rows: z.number() })
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
    rewardPacing: z.enum(["slow", "normal", "burst"])
  })).optional(),
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

export const gameplayDslSchema = z.object({
  version: z.literal("1"),
  rules: z.array(gameplayDslRuleSchema).max(24)
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
  "asset-requirements": assetRequirementsSchema,
  "asset-candidates": assetCandidatesSchema,
  "confirmed-assets": confirmedAssetsSchema,
  "asset-style-guide": assetStyleGuideSchema,
  "asset-pack": assetPackSchema,
  "game-config": gameConfigSchema,
  "game-hooks": gameHooksSchema,
  "gameplay-dsl": gameplayDslSchema,
  "sandbox-plugin": sandboxPluginSchema,
  "qa-report": qaReportSchema,
  "publish-record": publishRecordSchema,
  "iteration-report": iterationReportSchema
} as const;

export type ArtifactType = keyof typeof artifactSchemas;

export function validateArtifact(type: ArtifactType, payload: unknown) {
  return artifactSchemas[type].safeParse(payload);
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
