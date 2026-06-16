---
name: game-debug-protocol
description: Record and reuse verified debug fixes for generated Phaser games in the AI game production platform. Use when build, runtime, asset reference, scene registration, or config validation failures occur.
---

# Game Debug Protocol

Create a debug entry for every verified failure.

## Entry Shape

- `signature`
- `stage`
- `symptom`
- `rootCause`
- `verifiedFix`
- `regressionCheck`

## Common Signatures

- `asset-key-mismatch`
- `scene-registration-missing`
- `config-field-missing`
- `canvas-blank`
- `input-not-bound`

Keep entries short and reusable. Do not add speculative fixes that were not verified.
