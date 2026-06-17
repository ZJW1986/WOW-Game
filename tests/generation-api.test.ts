import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";

function memoryStore() {
  const writes = new Map<string, string>();
  return {
    writeText: async (path: string, content: string) => {
      writes.set(path, content);
    },
    readText: async (path: string) => writes.get(path) ?? null,
    ensureDir: async () => undefined
  };
}

describe("generation api handler", () => {
  it("generates a playable response through the backend-only DeepSeek boundary", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DEEPSEEK_API_KEY: "server-key",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "top_down",
              reasons: ["视角和自由移动决定为俯视角玩法"],
              risks: [],
              unsupportedRequests: []
            }
          : prompt.includes("llm.gdd")
            ? {
                concept: "星尘航线",
                loop: ["开始", "移动", "躲避", "收集", "胜利"],
                entities: ["飞船", "星星", "陨石"],
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
                numbers: { playerSpeed: 260 },
                implementationRoute: "使用 top_down 模板和配置驱动关卡"
              }
            : {
                templateFamily: "top_down",
                title: "星尘航线",
                pitch: "飞船躲避陨石并收集星星。",
                playerGoal: "收集 6 颗星星",
                controls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
                difficulty: "normal",
                referencedAssetKeys: ["cover.main", "player.ship", "world.background"],
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-api-1",
        model: "deepseek-v4-flash"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.project.gameConfig.title).toBe("星尘航线");
    expect(response.body.modelTasks.every((task: { status: string }) => task.status === "success")).toBe(true);
    expect(response.body.fallbacksUsed).toEqual([]);
  });

  it("rejects unsupported methods without running model generation", async () => {
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async () => {
        throw new Error("fetcher should not run");
      }
    });

    const response = await handler({
      method: "GET",
      path: "/api/generate-playable",
      body: {}
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("No route");
  });

  it("persists generated playables and reads them through play api paths", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO
    });

    const generateResponse = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-api-persisted",
        model: "mock-designer"
      }
    });
    const playResponse = await handler({
      method: "GET",
      path: "/api/play/project-api-persisted/v1",
      body: {}
    });

    expect(generateResponse.status).toBe(200);
    expect(playResponse.status).toBe(200);
    expect(playResponse.body.project.id).toBe("project-api-persisted");
    expect(playResponse.body.publishRecord.publicUrl).toBe(
      "https://wow-game.example/play/project-api-persisted/v1"
    );
  });

  it("saves player feedback for a persisted playable", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO
    });

    await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个横版跳跃收集金币的森林游戏",
        answers: [],
        templateFamily: "platformer",
        projectId: "project-api-feedback",
        model: "mock-designer"
      }
    });
    const feedbackResponse = await handler({
      method: "POST",
      path: "/api/play/project-api-feedback/v1/feedback",
      body: {
        rating: 5,
        comment: "跳跃手感可以更轻快",
        playerName: "player-a"
      }
    });
    const playResponse = await handler({
      method: "GET",
      path: "/api/play/project-api-feedback/v1",
      body: {}
    });

    expect(feedbackResponse.status).toBe(201);
    expect(feedbackResponse.body.feedback.iterationSuggestion).toContain("下一版");
    expect(playResponse.body.feedback).toHaveLength(1);
  });
});
