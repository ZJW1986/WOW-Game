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

export const qaReportSchema = z.object({
  scores: z.object({
    buildHealth: z.number(),
    visualUsability: z.number(),
    intentAlignment: z.number()
  }),
  checks: z.array(z.string()),
  debugProtocolEntries: z.array(z.string())
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
  classification: classificationSchema,
  gdd: gddSchema,
  "asset-requirements": assetRequirementsSchema,
  "asset-style-guide": assetStyleGuideSchema,
  "asset-pack": assetPackSchema,
  "game-config": gameConfigSchema,
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
