---
name: phaser-template-builder
description: Build Phaser playable prototypes from template family, game-config, and asset-pack artifacts. Use when producing a Web 2D game while preserving locked Phaser lifecycle code and limiting generated behavior to config and approved hooks.
---

# Phaser Template Builder

Build from stable Phaser templates. Do not generate a new engine lifecycle.

## Required Inputs

- `classification.json`
- `game-config.json`
- `asset-pack.json`

## Allowed Hooks

- `setupEntities`
- `setupCollisions`
- `handleCustomRules`
- `onWin`
- `onLose`

## Rules

- Keep scene registration, preload, create, update, and restart flow in template-owned code.
- Validate every referenced asset key before runtime.
- Every playable must support start, play, lose, win, and restart.
