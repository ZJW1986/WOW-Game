import type { ModelTaskRequest } from "./backend";

type PromptTaskType = ModelTaskRequest["taskType"];

const TEMPLATE_FAMILIES = '"platformer" | "top_down" | "grid_logic" | "tower_defense" | "ui_heavy"';

export const styleSheetPromptPack = [
  "Task: llm.style_sheet.",
  "Create one global art direction style sheet for the whole game after the GDD.",
  'Return strict JSON: {"palette":["#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB"],"brushwork":"cel_shaded","lighting":"rim","era":"sci_fi","subjectScale":"medium","negativePrompt":"..."}.',
  "palette must contain exactly 5 unique hex colors.",
  "brushwork must be one of pixel_clean, cel_shaded, painterly, low_poly, vector_flat.",
  "lighting must be one of flat, rim, soft, neon, dramatic.",
  "era must be one of fantasy, modern, retro, sci_fi, nature.",
  "subjectScale must be one of tiny, small, medium, large, heroic.",
  "negativePrompt must be non-empty and <= 200 characters."
].join("\n");

export function createPromptForTask(
  taskType: PromptTaskType,
  input: Record<string, unknown>
): string {
  const payload = JSON.stringify(input, null, 2);
  const taskInstruction: Record<PromptTaskType, string> = {
    "llm.design_brief": [
      "Task: llm.design_brief.",
      "Act as a professional game designer before asking the player questions.",
      "Analyze engineType, idea, uploaded reference summary, user materials, target template or 3D genre, and phase-1 constraints.",
      "Produce a practical developer prompt that can drive the later GDD, asset prompts, config, and hooks.",
      'Return exactly this JSON shape: {"coreGameplay":"...","playerGoal":"...","referenceTakeaways":["..."],"risks":["..."],"questionFocus":["gameplay","character","visual","audio","pacing"],"developerPrompt":"..."}.',
      "For phaser2d, developerPrompt must be specific enough to generate a first playable Phaser template game. For threejs3d, use llm.three_design_brief instead."
    ].join("\n"),
    "llm.classification": [
      "Task: llm.classification.",
      "Choose a Physics-First templateFamily.",
      `templateFamily must be one of: ${TEMPLATE_FAMILIES}.`,
      'Return exactly this JSON shape: {"templateFamily":"top_down","reasons":["..."],"risks":["..."],"unsupportedRequests":["..."]}.',
      "reasons, risks, and unsupportedRequests must be string arrays."
    ].join("\n"),
    "llm.guided_questions": [
      "Task: llm.guided_questions.",
      "Generate exactly 5 concise, player-facing design questions using guidedQuestionPromptBundle, gameDevPromptBundle, designBrief, previousAnswers, userMaterials, and referencePackageSummary when present.",
      "If guidedQuestionPromptBundle is present, preserve its five decision slots and profile intent, but rewrite copy only when it improves clarity.",
      "Questions must be profile-aware. Tower defense asks route/towers/waves/economy/base health. Flight shooter asks weapon/enemy formations/bullets/shield/Boss. Platformer asks jump rhythm/traps/checkpoints/hidden rewards. Match-three asks targets/chains/special items/move limits. RPG asks skills/monsters/quests/inventory/growth.",
      "Each question must help the player make a concrete design decision for a first playable 2D game.",
      "Do not display internal developer prompts, engine setup, lifecycle/code instructions, original prompt headers, or phrases like '请生成一款 2D Phaser 游戏'.",
      "When possible include profileId, decisionSlot, and affectsDirector in each question object.",
      'inputType must be "single_choice", "multi_choice", "short_text", or "number".',
      'Return exactly this JSON shape: {"questions":[{"id":"goal","label":"Goal","prompt":"...","inputType":"short_text","options":[],"defaultAnswer":"...","required":true}]}'
    ].join("\n"),
    "llm.three_design_brief": [
      "Task: llm.three_design_brief.",
      "Act as a senior Three.js game director for a first playable 3D web/mobile MVP.",
      "Analyze idea, gameType3d, viewportMode, player psychology, mobile controls, scene readability, and provider availability.",
      "Return strict JSON with title, genre, coreLoop, cameraIntent, movementIntent, spaceLayout, interactionFeedback, mobileControlPlan, assetNeeds, and skillWorkflow.",
      "The brief must be practical enough to drive three-scene-director, three-asset-plan, and verification."
    ].join("\n"),
    "llm.three_guided_questions": [
      "Task: llm.three_guided_questions.",
      "Generate exactly 5 concise but professional questions for a 3D game idea.",
      "Cover camera/view, movement feel/mobile controls, spatial route/pacing, hazard pressure, feedback, and 3D asset style.",
      "Questions must reflect player psychology: clear goal, fair failure, first 30 seconds achievement, replay motivation.",
      'Return exactly this JSON shape: {"questions":[{"id":"three_camera","label":"3D Camera","prompt":"...","inputType":"single_choice","options":["..."],"defaultAnswer":"...","required":true}]}'
    ].join("\n"),
    "llm.three_scene_director": [
      "Task: llm.three_scene_director.",
      "Convert threeDesignBrief and answers into a constrained Three.js scene director.",
      "Do not output JavaScript. Use declarative camera, controls, player, world, objectives, enemies, and feedback.",
      "The director must include at least 3 stages covering learn_controls, collect, survive, and finale pacing.",
      "Include at least 2 enemy entries using behavior falling, patrol, chase, or orbit.",
      "Define keyboard and touch_drag controls, collect target, time limit, hit feedback, and restart-safe win/loss rules.",
      "Return strict JSON matching the WOW Game three-scene-director artifact."
    ].join("\n"),
    "llm.three_asset_plan": [
      "Task: llm.three_asset_plan.",
      "Plan 3D assets for Tripo, Gemini image, ElevenLabs, and procedural fallback.",
      "Include model, texture, skybox, audio, and icon requirements with provider, prompt, purpose, and fallback flag.",
      "Do not invent frontend asset URLs. Return an asset plan only."
    ].join("\n"),
    "llm.gdd": [
      "Task: llm.gdd.",
      "Create a constrained technical GDD that fits the selected template capability.",
      'Return exactly this JSON shape: {"concept":"...","loop":["..."],"entities":["..."],"level":{"width":960,"height":540,"collectibles":6,"hazards":4,"winScore":6},"numbers":{"playerSpeed":260},"implementationRoute":"..."}.',
      "loop and entities must be string arrays.",
      "level must contain numeric width, height, collectibles, hazards, and winScore."
    ].join("\n"),
    "llm.mature_game_brief": [
      "Task: llm.mature_game_brief.",
      "Use referencePattern, designBrief, user idea, user materials, and template constraints to create a more mature first playable plan.",
      "Do not copy commercial games, names, levels, code, or assets. Use only reusable game design patterns.",
      "Focus on the first 30 seconds, visual depth, feedback, difficulty curve, and concrete game-feel moments.",
      "Target one playthrough length of 60-90 seconds. Design a 3-stage difficulty curve covering safe (0-20s), pressure (20-50s), and climax (50-90s).",
      "Each stage must add one new pressure source and surface one readable reward beat.",
      'Return exactly this JSON shape: {"referencePatternId":"pattern-platformer-first-run","coreLoop":["..."],"firstThirtySeconds":["..."],"visualTheme":"...","feedbackChecklist":["..."],"difficultyCurve":["..."],"gameFeelMoments":["..."]}.',
      "firstThirtySeconds must include goal, reward, risk, and outcome beats.",
      "difficultyCurve must contain exactly three entries, each describing the dominant pressure and reward in one stage."
    ].join("\n"),
    "llm.game_config": [
      "Task: llm.game_config.",
      "Create template-readable config from the GDD and asset-pack.",
      `templateFamily must be one of: ${TEMPLATE_FAMILIES}.`,
      'difficulty must be "easy", "normal", or "hard".',
      'Return exactly this JSON shape: {"templateFamily":"top_down","title":"...","pitch":"...","playerGoal":"...","controls":["ArrowUp"],"difficulty":"normal","referencedAssetKeys":["player.hero"],"level":{"width":960,"height":540,"collectibles":6,"hazards":4,"winScore":6}}.',
      "referencedAssetKeys must only use keys already present in asset-pack."
    ].join("\n"),
    "llm.game_hooks": [
      "Task: llm.game_hooks.",
      "Create config-only hook parameters for the locked Phaser template.",
      "Do not output JavaScript or TypeScript.",
      "Map designBrief, matureGameBrief, GDD, confirmedAssets, and gameConfig into concrete playable rules.",
      "If gameDevPromptBundle is present, follow its directorPrompt and profile-specific mechanics before using generic template behavior.",
      "Do not use vague phrases. Every rule must be numeric or selected from the allowed enums.",
      "Target one playthrough between 60000 and 90000 ms. stageGoals must contain exactly 3 entries covering learn_controls (0-20000 ms), collect or survive (20000-50000 ms), and finale (50000-90000 ms).",
      "Each stageGoals entry must set enemySpawnDelta (0..6), speedMultiplier (0.9..1.6), and bgmIntensity (0..3); intensity must strictly increase across stages.",
      "scoreTiers gold rewards a perfect run (no death, fastest target time). silver fits a skilled retry (<=1 death). bronze recognises completion (lower minScore).",
      "scoreTiers.targetDurationMs must be between 60000 and 90000. gold.maxDurationMs must be <= targetDurationMs * 0.8. gold.minScore >= silver.minScore >= bronze.minScore. gold.maxDeathCount <= silver.maxDeathCount.",
      'Return exactly this JSON shape: {"enemyRules":{"movement":"patrol","speed":120,"waveIntervalMs":0},"collectibleRules":{"placement":"arc","value":1,"respawn":false},"winCondition":{"mode":"collect_score","target":6},"failCondition":{"mode":"hit_hazard","lives":1},"numberTuning":{"playerSpeed":250,"jumpVelocity":430,"hazardSpeed":120},"levelLayout":{"platforms":[{"x":480,"y":510,"width":920,"height":28}],"lanes":[{"y":150,"speed":95,"count":3}],"grid":{"columns":0,"rows":0}},"collisionRules":{"collisionRadius":12,"invulnerabilityMs":520,"knockbackForce":160},"feedbackRules":{"particleCount":18,"screenShakeIntensity":0.012,"collectBurstCount":12,"floatingScore":true,"comboText":true,"audioCueKeys":["sfx.collect","sfx.hit","sfx.win","sfx.lose"]},"spawnRules":{"hazardIntervalMs":900,"maxActiveHazards":6},"enemyArchetypes":[{"id":"chaser_1","type":"chaser","count":2,"speed":130,"spawnAfterMs":0,"laneY":260,"warningMs":300}],"attackRules":{"contactDamage":1,"dashDamage":0,"projectileSpeed":180,"projectileCooldownMs":1400,"explosionRadius":72,"explosionDelayMs":650,"warningMs":420},"stageGoals":[{"id":"teach","label":"Learn movement and collect the first reward","startsAtMs":0,"durationMs":20000,"objective":"learn_controls","target":1,"enemyMix":[],"rewardPacing":"slow","enemySpawnDelta":0,"speedMultiplier":1,"bgmIntensity":0},{"id":"pressure","label":"Pressure rises and reward path opens","startsAtMs":20000,"durationMs":30000,"objective":"collect","target":3,"enemyMix":["patroller_1"],"rewardPacing":"normal","enemySpawnDelta":1,"speedMultiplier":1.15,"bgmIntensity":1},{"id":"climax","label":"Finale sprint to the goal","startsAtMs":50000,"durationMs":30000,"objective":"finale","target":6,"enemyMix":["patroller_1","charger_1"],"rewardPacing":"burst","enemySpawnDelta":2,"speedMultiplier":1.3,"bgmIntensity":2}],"scoreTiers":{"targetDurationMs":75000,"gold":{"minScore":6,"maxDeathCount":0,"maxDurationMs":56000},"silver":{"minScore":4,"maxDeathCount":1},"bronze":{"minScore":2},"rationale":"Gold rewards a perfect run, silver a skilled retry, bronze recognises completion."},"impactRules":{"hitStopMs":80,"screenShakeIntensity":0.018,"explosionParticles":24,"knockbackForce":180,"invulnerabilityMs":650,"comboWindowMs":1800},"encounterTimeline":[{"atMs":5000,"trigger":"time","event":"spawn_wave","intensity":2,"message":"Hazard wave incoming"}]}.',
      'Allowed movement values: "static", "patrol", "chase", "wave".',
      'Allowed enemyArchetypes.type values: "chaser", "patroller", "charger", "shooter", "orbiter", "mine".',
      'Allowed stage objective values: "learn_controls", "collect", "survive", "finale".',
      'Allowed timeline event values: "spawn_wave", "spawn_mine", "projectile_burst", "reward_burst", "finale".',
      "For top_down, include at least two enemy archetype types. For platformer, include patroller plus either charger or mine."
    ].join("\n"),
    "llm.gameplay_dsl": [
      "Task: llm.gameplay_dsl.",
      "Convert designBrief.developerPrompt, matureGameBrief, answers, gameConfig, gameHooks, and asset-pack into executable declarative gameplay rules.",
      "If gameDevPromptBundle is present, use its directorPrompt to express profile-specific actions, pressure, reward, and stage beats.",
      "Do not output JavaScript or TypeScript. Do not describe implementation in prose.",
      "Every rule must use a structured trigger and one or more whitelisted actions.",
      'Return exactly this JSON shape: {"version":"2","rules":[{"id":"score-pressure","when":{"type":"score","op":">=","value":3},"do":[{"type":"spawn_zone","zoneId":"right-lane","enemyType":"chaser","count":2}]}],"zones":[{"id":"right-lane","x":640,"y":120,"width":160,"height":260}],"counters":[],"items":[]}.',
      "Allowed triggers: time, score, collected, enemiesAlive, stage, hpBelow, zoneEntered, combo.",
      "Allowed trigger comparison ops: <, <=, =, >=, >. combo only uses >=, >, =. enemiesAlive only uses <=, <, =.",
      "Allowed actions: spawn_zone, open_door, grant_item, set_counter, change_player_speed, fail, win.",
      'Allowed enemyType values for spawn_zone: "chaser", "patroller", "charger", "shooter", "orbiter", "mine".',
      "Complexity budget: rules <= 80, zones <= 16, counters <= 16, items <= 16.",
      'Few-shot 1: {"version":"2","items":[{"assetKey":"item.key","grantsCounter":"keys","value":1}],"rules":[{"id":"three-keys-open-door","when":{"type":"collected","assetKey":"item.key","count":3},"do":[{"type":"open_door","assetKey":"door.portal"}]}]}.',
      'Few-shot 2: {"version":"2","zones":[{"id":"right-lane","x":640,"y":120,"width":160,"height":260}],"rules":[{"id":"score-spawn-pressure","when":{"type":"score","op":">=","value":5},"do":[{"type":"spawn_zone","zoneId":"right-lane","enemyType":"chaser","count":3}]}]}.',
      'Few-shot 3: {"version":"2","counters":[{"name":"comboReward","initialValue":0}],"rules":[{"id":"combo-reward","when":{"type":"combo","op":">=","value":4},"do":[{"type":"set_counter","name":"comboReward","value":1}]}]}.',
      "For top_down, include at least one score-triggered pressure or reward rule. For platformer, include at least one collected, zoneEntered, stage, or score rule that changes progression.",
      "assetKey may only reference keys already present in asset-pack."
    ].join("\n"),
    "llm.asset_prompts": [
      "Task: llm.asset_prompts.",
      "Create confirmable asset candidates from visualPromptPack, designBrief, GDD, referencePackageSummary, requestedSlots, and template constraints.",
      "Return image asset candidates only for requestedSlots when provided; otherwise return background, player, hazard, and collectible.",
      "Do not create BGM, SFX, voice, audio, VFX, or effect candidates in this task.",
      "Use assetKey values from visualPromptPack when present. Do not force every game type to use world.background or player.ship.",
      "Each candidate prompt must be different, slot-specific, and game-type-specific. Include subject identity, composition, visual constraints, and negative constraints for that slot.",
      "Never return generic placeholder concepts such as square, block, grid, default, test, platformer, sky background, player character, spike hazard, or coin collectible unless the user explicitly asked for them.",
      "For sprite slots, request an isolated centered game sprite on transparent or solid chroma background. For background, request an environment/map only and explicitly exclude foreground characters, enemies, pickups, UI, and text.",
      "Tower defense background must be top-down path/buildable map; tower defense player slot must be tower/base; tower defense collectible must be currency/resource, not an abstract yellow ring.",
      "Do not reference uploaded ZIP paths as final runtime asset keys. Use stable WOW Game asset keys.",
      'Return exactly this JSON shape: {"candidates":[{"slot":"player","assetKey":"player.ship","type":"image","label":"...","prompt":"...","style":"...","purpose":"...","acceptedFileTypes":["image/*"]}]}'
    ].join("\n"),
    "llm.revision_analysis": [
      "Task: llm.revision_analysis.",
      "Analyze a player follow-up before changing the game.",
      "Explain the understood change, update the developer prompt, ask confirmation questions when needed, and list affected assets.",
      'Return exactly this JSON shape: {"understoodChange":"...","updatedDeveloperPrompt":"...","confirmationQuestions":[{"id":"restart","label":"...","prompt":"...","inputType":"single_choice","options":["..."],"defaultAnswer":"...","required":true}],"affectedAssets":["sfx.hit"],"risks":["..."]}.'
    ].join("\n"),
    "image.asset": [
      "Task: image.asset.",
      'Return JSON with {"assetKey","style","spec","prompt","copyrightStatus"}.'
    ].join("\n"),
    "audio.sfx": [
      "Task: audio.sfx.",
      'Return JSON with {"assetKey","purpose","duration","style","loop"} for a short sound effect.'
    ].join("\n"),
    "audio.bgm": [
      "Task: audio.bgm.",
      'Return JSON with {"assetKey","purpose","duration","style","loop"} for background music.'
    ].join("\n"),
    "effect.preset": [
      "Task: effect.preset.",
      'Return JSON with {"assetKey","trigger","preset","params"} for a preset visual effect.'
    ].join("\n")
  };

  return [
    "You are the WOW Game production agent.",
    "Return strict JSON only. Do not wrap the response in markdown fences.",
    "Do not generate Phaser lifecycle code, scene registration code, asset loader code, or engine setup.",
    "Only produce the requested standard artifact for the configured template pipeline.",
    "If referencePackageSummary is present, use it only as gameplay, pacing, and asset-style reference.",
    "Do not modify uploaded ZIP files, do not copy source code, and do not invent asset keys from the reference package.",
    "",
    taskInstruction[taskType],
    "",
    "Input JSON:",
    payload
  ].join("\n");
}
