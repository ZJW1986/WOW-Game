# AI Game Production Platform MVP Architecture

This MVP implements the first closed loop for natural-language game generation:

1. Idea intake
2. Guided questions
3. Physics-first classification
4. Technical GDD
5. Asset protocol
6. Asset production
7. Config-driven playable build
8. Verification
9. Play publish
10. Iteration advice

The product follows an OpenGame-style constraint: agents must not freely rewrite engine lifecycle code. They generate standard artifacts, a game config, an asset pack, and limited template hook data.

## Runtime Shape

- Frontend: React, TypeScript, Vite
- Game runtime: Phaser, dynamically imported in `PhaserPreview`
- Core pipeline: deterministic TypeScript mock in `src/core/pipeline.ts`
- Backend boundary: in-memory service facade in `src/services/backend.ts`
- Tests: Vitest coverage for pipeline, asset validation, service boundaries, and model routing

## Model Gateway

The MVP success path uses `mock`. Real providers are represented by adapter placeholders with this task shape:

```ts
{
  taskType: "llm.gdd" | "llm.classification" | "image.asset" | "audio.sfx" | "audio.bgm" | "effect.preset",
  prompt: string,
  provider: "mock" | "openai" | "custom",
  model: string
}
```

Future providers should return standard artifacts or asset metadata instead of direct engine code.

## Data Boundary

The current store is in memory but mirrors the future database entities:

- Project
- GameVersion
- PipelineArtifact
- Asset
- ModelTask
- PlayableBuild
- PlayFeedback
- DebugProtocolEntry
- TemplateFamily

## Verification

The first verification bench reports:

- Build Health
- Visual Usability
- Intent Alignment

It also records Debug Protocol entries such as asset key mismatches. Browser automation can be added later as a drop-in replacement for the deterministic mock checks.
