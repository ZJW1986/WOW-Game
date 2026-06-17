# WOW Game MVP Architecture

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

## Local Demo Commands

Use the automatic-port command for daily development. Vite will move to the next free port if `5173` is already in use:

```powershell
$env:DEEPSEEK_API_KEY="your DeepSeek API key"
npm.cmd run dev:auto
```

Use the fixed-port command only when you need a stable customer demo URL and you know port `5173` is free:

```powershell
$env:DEEPSEEK_API_KEY="your DeepSeek API key"
npm.cmd run dev:fixed
```

When the port is automatic, use the URL printed by Vite in the terminal as `PUBLIC_BASE_URL` for sharing links.

## Model Gateway

The MVP success path uses `mock`. Real providers are represented by adapter placeholders with this task shape:

```ts
{
  taskType: "llm.gdd" | "llm.classification" | "image.asset" | "audio.sfx" | "audio.bgm" | "effect.preset",
  prompt: string,
  provider: "mock" | "openai" | "deepseek" | "custom",
  model: string
}
```

DeepSeek is wired as the first real LLM provider adapter:

- Provider: `deepseek`
- Default text model: `deepseek-v4-flash`
- Base URL: `https://api.deepseek.com`
- Endpoint: `/chat/completions`
- Environment variable: `DEEPSEEK_API_KEY`

The DeepSeek API is OpenAI-compatible. Keep API keys on a trusted backend service only; do not expose them in the browser bundle. Future providers should return standard artifacts or asset metadata instead of direct engine code.

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
