import { describe, expect, it } from "vitest";
import { createConversationSession } from "../src/core/conversation";
import { runMockPipeline } from "../src/core/pipeline";
import { createStartGameDraft } from "../src/core/start";
import { createGenerationService } from "../src/services/generationService";
import { createDeepSeekExecutor } from "../src/services/deepSeekExecutor";

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

    expect(visibleText).not.toMatch(/[涓鍋绋鏄鐢棰璧浠骞妯淇]/);
  });
});
