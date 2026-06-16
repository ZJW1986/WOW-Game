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
  spec: z.string()
});

export const assetRequirementsSchema = z.array(assetRequirementSchema);

export const assetPackSchema = z.object({
  versionId: z.string(),
  assets: assetRequirementsSchema
});

export const gameConfigSchema = z.object({
  templateFamily: templateFamilySchema,
  title: z.string(),
  pitch: z.string(),
  playerGoal: z.string(),
  controls: z.array(z.string()),
  difficulty: z.enum(["easy", "normal", "hard"]),
  referencedAssetKeys: z.array(z.string()),
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
  classification: classificationSchema,
  gdd: gddSchema,
  "asset-requirements": assetRequirementsSchema,
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
