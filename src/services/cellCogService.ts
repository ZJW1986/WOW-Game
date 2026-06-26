import type { CellCogGenerationReport } from "../core/types";

export interface CellCogGenerateAssetInput {
  promptPackId: string;
  slot: string;
  prompt: string;
  requestedOutput: CellCogGenerationReport["requestedOutput"];
}

export interface CellCogServiceOptions {
  apiKey?: string;
}

export function createCellCogGenerationReport(
  input: CellCogGenerateAssetInput,
  options: CellCogServiceOptions = {}
): CellCogGenerationReport {
  if (!options.apiKey) {
    return {
      provider: "cellcog",
      status: "missing_key",
      promptPackId: input.promptPackId,
      slot: input.slot,
      requestedOutput: input.requestedOutput,
      outputFiles: [],
      errors: ["CELLCOG_API_KEY is not configured."]
    };
  }

  return {
    provider: "cellcog",
    status: "queued",
    promptPackId: input.promptPackId,
    slot: input.slot,
    requestedOutput: input.requestedOutput,
    outputFiles: [],
    errors: [],
    creditInfo: "Credit usage is reported by CellCog after task completion."
  };
}

export function assertCellCogPromptIsIsolated(prompt: string): string[] {
  const banned = ["developerPrompt", "Phaser", "Three.js", "gameHooks", "scene lifecycle", "WASD"];
  return banned.filter((term) => prompt.toLowerCase().includes(term.toLowerCase()));
}
