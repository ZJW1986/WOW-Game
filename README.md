# WOW Game

WOW Game is a Web MVP for generating small playable 2D games from natural-language ideas.

## Local Demo

Run from the project directory:

```powershell
cd "D:\2026工作\AI自动化游戏开发平台"
Copy-Item .env.example .env.local
notepad .env.local
npm.cmd run dev:demo
```

Open:

```text
http://localhost:5175/
```

Set `DEEPSEEK_API_KEY` in `.env.local` to enable real DeepSeek generation. If the key is missing or the model output is invalid, the app falls back to the local mock pipeline so the demo remains playable.

## Public Tunnel Demo

When using Cloudflare Tunnel or another public tunnel, set:

```powershell
$env:PUBLIC_BASE_URL="https://your-tunnel-domain.trycloudflare.com"
npm.cmd run dev:demo
```

Vite is configured to accept external tunnel hosts during development. Share links are generated from `PUBLIC_BASE_URL` and use `/play/:projectId/:versionId`.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run build:analyze
```

For real browser acceptance, start the dev server first and run the browser check:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5176 --strictPort
npm.cmd run verify:browser
```

`verify:browser` tries Playwright Chromium first, then system Microsoft Edge, then system Google Chrome. If none can launch, install the Playwright browser runtime:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=".playwright-browsers"
npx playwright install chromium
```

`verify:browser` skips with a clear message when no browser can launch, so it does not block the normal unit/build regression path. Restart the dev server after changing `.env.local` or installing new dependencies.
