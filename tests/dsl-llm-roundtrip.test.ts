import { describe, expect, it } from "vitest";
import { createGameConfig } from "../src/core/pipeline";
import type { AssetPack, DesignBrief, GameplayDsl } from "../src/core/types";
import { requestGameplayDsl } from "../src/services/gameplayDslRequest";

describe("LLM gameplay DSL roundtrip", () => {
  it("retries invalid DSL responses with validation errors and falls back when repair fails", async () => {
    const prompts: string[] = [];
    const fallback: GameplayDsl = {
      version: "2",
      rules: [
        {
          id: "fallback-win",
          when: { type: "score", op: ">=", value: 3 },
          do: [{ type: "win", message: "fallback cleared" }]
        }
      ]
    };

    const result = await requestGameplayDsl({
      idea: "集齐 3 把钥匙开启传送门",
      designBrief: createDesignBrief(),
      gameConfig: createGameConfig("Key Gate", "集齐 3 把钥匙开启传送门", "top_down", createAssetPack()),
      assetPack: createAssetPack(),
      fallback,
      provider: async (request) => {
        prompts.push(request.prompt);
        return JSON.stringify({
          version: "2",
          rules: [{ id: "bad", when: { type: "score", op: ">=", value: 3 }, do: [] }]
        });
      }
    });

    expect(result.dsl).toEqual(fallback);
    expect(result.status).toBe("fallback");
    expect(result.attempts).toBe(3);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(prompts[1]).toContain("请修复以下 GameplayDSL 校验错误");
  });
});

function createDesignBrief(): DesignBrief {
  return {
    coreGameplay: "Collect keys to unlock a portal.",
    playerGoal: "Collect 3 keys and open the portal.",
    referenceTakeaways: [],
    risks: [],
    questionFocus: ["gameplay"],
    developerPrompt: "A top-down key collection game with a locked portal."
  };
}

function createAssetPack(): AssetPack {
  return {
    versionId: "v1",
    assets: [
      createAsset("item.key", "/key.png"),
      createAsset("door.portal", "/door.png")
    ]
  };
}

function createAsset(assetKey: string, fileUrl: string): AssetPack["assets"][number] {
  return {
    assetKey,
    type: "image",
    purpose: "test",
    style: "test",
    generationMode: "mock",
    copyrightStatus: "placeholder",
    spec: "test",
    status: "mock",
    prompt: "test",
    acceptedFileTypes: ["image/png"],
    previewUrl: fileUrl,
    source: "mock",
    fileUrl,
    provider: "mock",
    model: "mock",
    generationParams: {}
  };
}
