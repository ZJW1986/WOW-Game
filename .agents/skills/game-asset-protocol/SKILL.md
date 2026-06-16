---
name: game-asset-protocol
description: Create and validate asset requirements and asset-pack manifests for the AI game production platform. Use when turning a GDD into image, UI, SFX, BGM, VFX, and build resources with stable asset keys and metadata.
---

# Game Asset Protocol

Convert the GDD into `asset-requirements.json` and then `asset-pack.json`.

## Required Fields

Each asset must include:

- `assetKey`
- `type`
- `purpose`
- `style`
- `generationMode`
- `copyrightStatus`
- `spec`

## Rules

- Game code and config may only reference keys in `asset-pack.json`.
- Use deterministic placeholder assets in phase 1.
- Record source and model parameters when real providers are added.
- Treat missing or duplicate keys as build blockers.
