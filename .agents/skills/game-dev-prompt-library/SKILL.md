---
name: game-dev-prompt-library
description: Use when turning a player game idea into professional 2D or 3D game production prompts, gameplay directors, asset prompts, UI/audio/model prompt packs, or when generated games feel too simple, generic, or prompt-contaminated.
---

# Game Dev Prompt Library

## Core Rule
Use typed game design prompts to produce executable WOW Game artifacts. Do not ask models to write Phaser or Three.js lifecycle code. The model may produce brief, director JSON, prompt packs, and candidate assets only.

## Output Layers
Every generation pass must produce these layers separately:

1. **Production Brief**
   - Player fantasy
   - Core loop
   - First minute experience
   - Difficulty curve
   - Reward feedback
   - Failure feedback
   - Restart motivation

2. **Gameplay Director**
   - JSON only
   - Three-stage pacing
   - At least two pressure types
   - Reward path
   - Failure and victory conditions
   - Feedback events
   - Mobile input mode

3. **Visual Prompt Pack**
   - Background, player, hazard, collectible, cover poster are separate prompts.
   - Background prompts are environment-only.
   - Sprite prompts are single-subject and isolated.
   - Never mix code, controls, developerPrompt, runtime hooks, scoring rules, or engine terms into image prompts.

4. **UI Prompt Pack**
   - Must use: `Context / Subject / Items / Style / Technical`.
   - UI assets are HUD, buttons, icons, panels, dialogs, inventory/shop slots.
   - UI prompts must not describe gameplay sprites or runtime logic.

5. **Audio Prompt Pack**
   - Include `bgm.loop`, `sfx.collect`, `sfx.hit`, `sfx.win`, `sfx.lose`, `sfx.warning`.
   - Describe mood, duration, cue purpose, and mix clarity only.

6. **Model Prompt Pack**
   - For 3D only.
   - Separate player, hazard, collectible, environment blockout.
   - Prefer low-poly GLB, centered origin, readable silhouette, explicit model budget.

7. **Validation Checklist**
   - 60fps target
   - Mobile input
   - Win/loss/restart loop
   - HUD readability
   - Asset readability
   - Audio cues
   - Three-stage pacing
   - Two pressure types
   - Reward path

## 2D Prompt Profiles
- Side-scroll action adventure: ninja movement, patrol enemies, projectiles, platforms, parallax.
- 2D fighting: light/heavy attack, block, dodge, combo, hit stun.
- Steampunk action adventure: mount inertia, mechanical switches, fog map, scrap collection.
- Vertical flight shooter: enemy formations, boss bullets, weapon upgrade branches.
- Strategy tower defense: path, tower placement, waves, gold, upgrades, base health.
- Logic puzzle: drag blocks, connect paths, move limit, timer, reset, hint.
- Point-click adventure: inventory, clue combination, room unlock, branching endings.
- Board strategy: board pieces, turn timer, skill range, AI decision, legal move hints.
- Shooting tower defense: manual aim plus auto turrets, base health, enemy lanes.
- Simulation management: orders, customer mood, income, upgrades, rush time.
- Farm life: planting, weather, market price, tasks, inventory.
- Pet care: feeding, training, evolution, collection book, stat panel.
- Romance visual novel: branch dialogue, affection, events, multiple endings.
- Match three: grid match, chain reactions, special items, step or time limit.
- Platform jumper: run, jump, double jump, dash, checkpoint, hidden area.
- Sports competition: movement, shooting, passing, steal, timer, training.
- Card battle: draw, mana, turn flow, card resolution, deck building.
- Racing: steering, drift, collision, lap time, vehicle upgrades.
- Light RPG: skills, monsters, quests, inventory, experience, teleport.

## 3D Prompt Profiles
- 3D space shooter: spaceship control, enemy ships, weapon upgrades, shields, boss phases.
- Tower defense maps to futuristic tower defense.
- Runner, racing, sports, and platform jumper map to runner-style Three.js directors.
- RPG, exploration, point-click, and farm-life map to exploration or third-person collect directors.

## Platform Mapping
- 2D targets: `platformer`, `top_down`, `grid_logic`, `tower_defense`, `ui_heavy`.
- 3D targets: `flight_shooter`, `runner`, `third_person_collect`, `exploration`, `dodge_collect`, `futuristic_tower_defense`.

## Common Mistakes
- Do not put the full gameplay prompt into image prompts.
- Do not let background prompts include player, enemy, collectible, or UI subjects.
- Do not use one generic director for every genre.
- Do not mark a game delivery-ready if it lacks three stages, two pressures, rewards, failure, restart, and audio cues.
