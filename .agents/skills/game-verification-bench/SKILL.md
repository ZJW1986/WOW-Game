---
name: game-verification-bench
description: Verify generated game builds for the AI game production platform. Use when checking Build Health, Visual Usability, Intent Alignment, resource references, browser runtime status, and basic playability before publishing.
---

# Game Verification Bench

Verify before publishing to Play.

## Scores

- Build Health: install, build, runtime boot, no fatal console errors.
- Visual Usability: canvas is nonblank, player/hazards/UI visible, no incoherent overlap.
- Intent Alignment: implemented mechanics match GDD core loop and template family.

## Rules

- Validate `asset-pack.json` references first.
- Run browser checks when available.
- Limit automatic repair to three rounds.
- Write verified failures to Game Debug Protocol.
