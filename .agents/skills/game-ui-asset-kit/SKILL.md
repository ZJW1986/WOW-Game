---
name: game-ui-asset-kit
description: Generate 2D game UI component image prompts and asset requirements for mobile/web games. Use when creating UI icon packs, skill icons, buttons, HUD panels, menus, inventory slots, badges, progress bars, dialog frames, shop cards, or any 2D Game UI Asset Kit image assets.
---

# Game UI Asset Kit

Use this skill whenever WOW Game needs generated 2D UI components, especially icon packs and reusable UI sprites. Keep UI assets separate from gameplay sprites and from game-design/developer prompts.

## Core Prompt Structure

Every UI image prompt must use this five-part structure:

1. `Context`: target game, platform, and UI asset pack purpose.
2. `Subject`: exact UI pack layout, count, and component type.
3. `Items`: numbered list of each component with meaning, color, and core visual symbol.
4. `Style`: art direction, finish, corner/edge treatment, and visual consistency.
5. `Technical`: crop/background/readability requirements for production use.

Do not send raw game-design prompts to image providers. Convert the game idea into a UI-specific prompt first.

## Required Rules

- Generate a set, not unrelated single images, when the request asks for multiple UI elements.
- Each item must have a clear semantic role and color identity.
- Use high contrast and strong silhouettes so assets remain readable on mobile.
- Specify output layout: grid, atlas sheet, isolated single icon, horizontal bar, panel set, or button states.
- Specify crop background: solid black, transparent PNG, or chroma background depending on the pipeline.
- Keep labels/text out of images unless the UI element explicitly needs text.
- Keep style consistent across all UI items in one pack.
- Avoid gameplay implementation words such as Phaser, Three.js, WASD, controls, score logic, win condition, code, template, scene lifecycle.

## Prompt Template

```text
Context: Generate a 2D Game UI Asset Pack for [game genre/platform].
Subject: [count and layout], [component type], arranged as [grid/atlas/single row/panel set].
Items:
1. [Name] ([primary color], [symbol], [game meaning])
2. [Name] ([primary color], [symbol], [game meaning])
3. [Name] ([primary color], [symbol], [game meaning])
4. [Name] ([primary color], [symbol], [game meaning])
Style: [art style], cohesive game UI, readable silhouette, polished finish, [corner/edge treatment].
Technical: [transparent PNG or solid black/chroma background], high contrast, readable at small mobile sizes, centered components, enough padding, no text unless requested.
```

## Slot Guidance

- `ui.skill_icons`: square icons, usually 4/8/12 items in a grid, rounded corners, strong symbolic shapes.
- `ui.buttons`: normal/hover/pressed/disabled states, same size, readable borders, no baked text unless requested.
- `ui.hud_panel`: frame, resource bars, counters, compact mobile readability.
- `ui.inventory_slots`: empty, selected, locked, rare/epic states, consistent frame system.
- `ui.dialog_frame`: panel frame, title tab, close button, content-safe center area.
- `ui.shop_card`: item frame, price badge, rarity border, purchase button area.

## WOW Game Integration

When converting a WOW Game idea into UI asset requirements:

- Use stable asset keys such as `ui.skill.fireball`, `ui.button.primary`, `ui.panel.hud`, `ui.slot.inventory`.
- Record `type: "ui"` and `generationMode: "model"`.
- Store the final image prompt in `generationParams.finalImagePrompt`.
- Never mix UI image prompts with `designBrief.developerPrompt`, Phaser director, Three.js director, gameplay hooks, or code-generation prompts.
- If a provider returns a full sheet, require downstream slicing metadata before runtime use.

## Example

```text
Context: Generate a 2D Game UI Asset Pack for a mobile space-cat arcade RPG.
Subject: A set of 4 square skill icons arranged in a 2x2 grid.
Items:
1. Meteor Dash (orange meteor trail, speed boost)
2. Star Shield (cyan star barrier, protection)
3. Fish Snack Heal (gold fish snack with green sparkle, recovery)
4. Laser Swipe (magenta beam slash, attack)
Style: hand-painted vector game art, bright mobile arcade style, glossy finish, rounded corners, cohesive icon frame.
Technical: isolated on solid black background for easy cropping, high contrast, readable at 48px mobile size, centered icons, no text.
```

## Quality Gate

Reject or regenerate UI prompts when:

- Items are vague or visually indistinguishable.
- The prompt describes gameplay code or engine behavior instead of UI visuals.
- The pack lacks count/layout information.
- The style differs per item.
- Small-size readability is not specified.
- Background/cropping requirements are missing.
