import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";

describe("generation api handler", () => {
  it("generates a playable response through the backend-only DeepSeek boundary", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DEEPSEEK_API_KEY: "server-key",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "top_down",
              reasons: ["俯视角飞船躲避是自由移动碰撞玩法"],
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
                implementationRoute: "使用 top_down 模板和配置驱动关卡。"
              }
            : {
                templateFamily: "top_down",
                title: "星尘航线",
                pitch: "飞船躲避陨石并收集星星",
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
});
