import { describe, expect, it } from "vitest";
import { createDeepSeekExecutor } from "../src/services/deepSeekExecutor";
import { createPromptForTask } from "../src/services/promptPack";
import { containsMojibake } from "./mojibake";

describe("DeepSeek JSON contract", () => {
  it("uses readable strict JSON prompts for core LLM artifacts", () => {
    const classificationPrompt = createPromptForTask("llm.classification", {
      idea: "make a spaceship collect energy cores",
      preferredTemplate: "top_down"
    });
    const gddPrompt = createPromptForTask("llm.gdd", {
      idea: "make a platform coin collector",
      classification: { templateFamily: "platformer" }
    });
    const configPrompt = createPromptForTask("llm.game_config", {
      idea: "make a platform coin collector",
      assetPack: { assets: [{ assetKey: "player.hero" }] }
    });
    const hooksPrompt = createPromptForTask("llm.game_hooks", {
      idea: "make a platform coin collector",
      gameConfig: { templateFamily: "platformer" }
    });

    expect(classificationPrompt).toContain("Return strict JSON only");
    expect(classificationPrompt).toContain('"templateFamily"');
    expect(classificationPrompt).toContain('"unsupportedRequests"');
    expect(gddPrompt).toContain('"concept"');
    expect(gddPrompt).toContain('"implementationRoute"');
    expect(configPrompt).toContain('"referencedAssetKeys"');
    expect(configPrompt).toContain("asset-pack");
    expect(hooksPrompt).toContain('"enemyRules"');
    expect(hooksPrompt).toContain("Do not output JavaScript or TypeScript");
    expect(containsMojibake(`${classificationPrompt}\n${gddPrompt}\n${configPrompt}\n${hooksPrompt}`)).toBe(false);
  });

  it("accepts fenced JSON content returned by the chat model", async () => {
    const executor = createDeepSeekExecutor({
      apiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '```json\n{"templateFamily":"top_down","reasons":["free movement"],"risks":[],"unsupportedRequests":[]}\n```'
              }
            }
          ]
        })
    });

    const result = await executor.runJsonTask({
      taskType: "llm.classification",
      prompt: "Return JSON",
      model: "deepseek-v4-flash"
    });

    expect(result.status).toBe("success");
    expect(result.rawJson).toBe(
      '{"templateFamily":"top_down","reasons":["free movement"],"risks":[],"unsupportedRequests":[]}'
    );
  });
});
