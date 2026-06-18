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
```
