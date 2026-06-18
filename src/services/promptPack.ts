import type { ModelTaskRequest } from "./backend";

type PromptTaskType = ModelTaskRequest["taskType"];

const TEMPLATE_FAMILIES = '"platformer" | "top_down" | "grid_logic" | "tower_defense" | "ui_heavy"';

export function createPromptForTask(
  taskType: PromptTaskType,
  input: Record<string, unknown>
): string {
  const payload = JSON.stringify(input, null, 2);
  const taskInstruction: Record<PromptTaskType, string> = {
    "llm.classification": [
      "Task: llm.classification.",
      "Choose a Physics-First templateFamily.",
      `templateFamily must be one of: ${TEMPLATE_FAMILIES}.`,
      'Return exactly this JSON shape: {"templateFamily":"top_down","reasons":["..."],"risks":["..."],"unsupportedRequests":["..."]}.',
      "reasons, risks, and unsupportedRequests must be string arrays."
    ].join("\n"),
    "llm.guided_questions": [
      "Task: llm.guided_questions.",
      "Generate 3 to 5 concise design questions.",
      'inputType must be "single_choice", "multi_choice", "short_text", or "number".',
      'Return exactly this JSON shape: {"questions":[{"id":"goal","label":"Goal","prompt":"...","inputType":"short_text","options":[],"defaultAnswer":"...","required":true}]}'
    ].join("\n"),
    "llm.gdd": [
      "Task: llm.gdd.",
      "Create a constrained technical GDD that fits the selected template capability.",
      'Return exactly this JSON shape: {"concept":"...","loop":["..."],"entities":["..."],"level":{"width":960,"height":540,"collectibles":6,"hazards":4,"winScore":6},"numbers":{"playerSpeed":260},"implementationRoute":"..."}.',
      "loop and entities must be string arrays.",
      "level must contain numeric width, height, collectibles, hazards, and winScore."
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
      'Return exactly this JSON shape: {"enemyRules":{"movement":"patrol","speed":120,"waveIntervalMs":0},"collectibleRules":{"placement":"arc","value":1,"respawn":false},"winCondition":{"mode":"collect_score","target":6},"failCondition":{"mode":"hit_hazard","lives":1},"numberTuning":{"playerSpeed":250,"jumpVelocity":430,"hazardSpeed":120},"levelLayout":{"platforms":[{"x":480,"y":510,"width":920,"height":28}],"lanes":[{"y":150,"speed":95,"count":3}],"grid":{"columns":0,"rows":0}}}.',
      'Allowed movement values: "static", "patrol", "chase", "wave". Do not include code strings.'
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
