---
name: game-physics-classifier
description: Classify natural-language game ideas into first-stage physics-first template families for this AI game production platform. Use when choosing between platformer, top_down, grid_logic, tower_defense, and ui_heavy before GDD, asset, or Phaser generation.
---

# Game Physics Classifier

Classify by dominant physical or spatial mechanic before theme.

## Template Families

- `platformer`: gravity, jumping, horizontal levels, ledges, spikes, pits.
- `top_down`: free 2D movement, arenas, mazes, avoidance, collection, chase.
- `grid_logic`: discrete cells, turns, push/pull, match, path logic, puzzle boards.
- `tower_defense`: route defense, waves, towers, timed enemy flow.
- `ui_heavy`: card, management, dialog, menu-driven, simulation with dense panels.

## Output

Return:

- `templateFamily`
- `reasons`
- `risks`
- `unsupportedRequests`

Reject or defer 3D, multiplayer networking, full commercial publishing, and free engine rewrites in phase 1.
