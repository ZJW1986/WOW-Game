import { describe, expect, it } from "vitest";
import { createConversationSession } from "../src/core/conversation";
import { runMockPipeline } from "../src/core/pipeline";
import { createStartGameDraft } from "../src/core/start";
import { createDeepSeekExecutor } from "../src/services/deepSeekExecutor";
import { createGenerationService } from "../src/services/generationService";

describe("fast playable generation experience", () => {
  it("starts a guided session from the create draft without skipping questions", () => {
    const draft = createStartGameDraft({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      model: "deepseek-v4-flash",
      templateFamily: "top_down"
    });
    const session = createConversationSession(draft.idea, {
      projectId: "project-fast-1",
      preferredTemplate: draft.templateFamily
    });

    expect(session.projectId).toBe("project-fast-1");
    expect(session.stage).toBe("guided_questions");
    expect(session.questions).toHaveLength(4);
    expect(session.turns.map((turn) => turn.content).join(" ")).toContain("关键问题");
  });

  it("executes DeepSeek-compatible json requests and validates output", async () => {
    const executor = createDeepSeekExecutor({
      apiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  templateFamily: "top_down",
                  reasons: ["飞船躲避陨石是俯视角移动与碰撞"],
                  risks: [],
                  unsupportedRequests: []
                })
              }
            }
          ]
        })
    });

    const result = await executor.runJsonTask({
      taskType: "llm.classification",
      prompt: "判断模板",
      model: "deepseek-v4-flash"
    });

    expect(result.status).toBe("success");
    expect(result.rawJson).toContain("top_down");
  });

  it("uses DeepSeek model tasks for classification, GDD, and game config when configured", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        let content: unknown;
        if (prompt.includes("llm.classification")) {
          content = {
            templateFamily: "platformer",
            reasons: ["横版跳跃和重力节奏是核心机制"],
            risks: ["第一版只支持配置驱动关卡"],
            unsupportedRequests: []
          };
        } else if (prompt.includes("llm.gdd")) {
          content = {
            concept: "跳动森林",
            loop: ["开始", "移动", "跳跃", "收集", "抵达终点"],
            entities: ["玩家", "金币", "尖刺", "终点旗"],
            level: { width: 960, height: 540, collectibles: 6, hazards: 3, winScore: 6 },
            numbers: { playerSpeed: 230, jumpVelocity: 430 },
            implementationRoute: "使用 platformer Phaser 模板，只生成配置和资源引用。"
          };
        } else {
          content = {
            templateFamily: "platformer",
            title: "跳动森林",
            pitch: "横版跳跃收集金币",
            playerGoal: "收集 6 枚金币并抵达终点",
            controls: ["ArrowLeft", "ArrowRight", "Space"],
            difficulty: "normal",
            referencedAssetKeys: ["cover.main", "ui.button", "player.hero", "world.tiles"],
            level: { width: 960, height: 540, collectibles: 6, hazards: 3, winScore: 6 }
          };
        }
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "做一个横版跳跃收集金币的森林游戏",
      answers: [{ questionId: "goal", value: "收集金币并到达终点", answeredAt: "2026-06-17T00:00:00.000Z" }],
      templateFamily: "platformer",
      projectId: "project-deepseek-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.classification.templateFamily).toBe("platformer");
    expect(result.project.gameConfig.title).toBe("跳动森林");
    expect(result.modelTasks.map((task) => task.taskType)).toEqual([
      "llm.classification",
      "llm.gdd",
      "llm.game_config"
    ]);
    expect(result.modelTasks.every((task) => task.status === "success")).toBe(true);
    expect(result.fallbacksUsed).toEqual([]);
  });

  it("falls back to mock artifacts when DeepSeek key is missing", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-fallback-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.gameConfig.templateFamily).toBe("top_down");
    expect(result.modelTasks).toHaveLength(3);
    expect(result.fallbacksUsed).toEqual([
      "llm.classification",
      "llm.gdd",
      "llm.game_config"
    ]);
  });

  it("generates a playable version with publish share metadata and a QR payload", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个横版跳跃收集金币的森林游戏",
      answers: [
        { questionId: "goal", value: "收集金币并到达终点", answeredAt: "2026-06-17T00:00:00.000Z" }
      ],
      templateFamily: "platformer",
      projectId: "project-share-1",
      baseUrl: "https://wow-game.example"
    });

    expect(result.version.status).toBe("published");
    expect(result.project.gameConfig.templateFamily).toBe("platformer");
    expect(result.publishRecord.publicUrl).toBe("https://wow-game.example/play/project-share-1/v1");
    expect(result.share.qrPayload).toContain(result.publishRecord.publicUrl);
    expect(result.share.webShareData.title).toContain("WOW Game");
  });

  it("keeps generated UI-facing strings free from mojibake", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const visibleText = [
      project.title,
      project.feedback.comment,
      project.feedback.iterationSuggestion,
      ...project.artifacts.map((artifact) => String(artifact.content))
    ].join(" ");

    expect(visibleText).not.toMatch(/[涓鍋绋鏄鐢棰璧浠骞妯淇鈻鈾乺乽乴乪乶乮]/);
  });
});
