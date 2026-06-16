# DeepSeek Create Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Create flow call a backend-only DeepSeek generation endpoint and update the Studio preview with the generated playable version.

**Architecture:** Add a small Vite development API endpoint at `/api/generate-playable` that reads `DEEPSEEK_API_KEY` from the Node process and calls `createGenerationService`. The browser only sends idea, answers, template, model, project id, and base URL, then renders returned project/model task state with Mock fallback if the endpoint is unavailable.

**Tech Stack:** React, TypeScript, Vite dev middleware, existing DeepSeek executor, Zod-backed generation service, Vitest.

---

### Task 1: Backend Generation API Boundary

**Files:**
- Create: `src/services/generationApi.ts`
- Modify: `vite.config.ts`
- Test: `tests/generation-api.test.ts`

- [ ] Add a request handler that validates method/path, parses JSON body, reads backend env, and returns `generatePlayableVersion` output.
- [ ] Add a Vite dev middleware that delegates `/api/generate-playable` to the handler.
- [ ] Test success and method rejection with mocked fetcher.

### Task 2: Browser Generation Client

**Files:**
- Create: `src/services/generationClient.ts`
- Test: `tests/generation-client.test.ts`

- [ ] Add `requestPlayableGeneration(input, fetcher)` that posts to `/api/generate-playable`.
- [ ] Return parsed JSON on 2xx and throw a readable error on non-2xx or malformed response.
- [ ] Test that the API key is never part of the browser request body.

### Task 3: Create UI Integration

**Files:**
- Modify: `src/ui/App.tsx`
- Test: `tests/generation-experience.test.ts`

- [ ] Replace the static `runMockPipeline(idea)` project source with generated result state plus Mock fallback.
- [ ] On Create, create a session, show the Studio immediately, call `requestPlayableGeneration`, and update Preview/Assets/Code when done.
- [ ] Render model status badges for generating, success, fallback used, and failure.
- [ ] Keep the app usable if the backend endpoint fails by falling back to `createGenerationService()` in browser Mock mode.

### Task 4: Environment Documentation and Verification

**Files:**
- Create: `.env.example`
- Modify: tests if needed for encoding checks

- [ ] Document `DEEPSEEK_API_KEY`, `MODEL_PROVIDER`, `PUBLIC_BASE_URL`, and `DEEPSEEK_BASE_URL`.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit with message `feat: connect create flow to generation api`.

### Self-Review

- The plan keeps API keys server-side in Vite middleware.
- The plan preserves Mock fallback for no-key/offline use.
- The plan does not let models generate Phaser lifecycle code.
- The plan is small enough for one implementation pass.
