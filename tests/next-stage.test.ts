import { describe, expect, it } from "vitest";
import {
  classificationSchema,
  gameConfigSchema,
  publishRecordSchema,
  validateArtifact
} from "../src/core/schemas";
import { classifyIdea, runMockPipeline } from "../src/core/pipeline";
import {
  answerDesignQuestion,
  createConversationSession,
  getNextConversationAction
} from "../src/core/conversation";
import { createModelGateway } from "../src/services/modelGateway";
import { createPromptForTask } from "../src/services/promptPack";
import { createInMemoryBackend } from "../src/services/backend";
import { getMessages } from "../src/ui/i18n";

describe("next-stage foundation", () => {
  it("keeps Chinese classification and UI messages readable", () => {
    expect(classifyIdea("做一个小机器人跳跃躲避尖刺并收集能量的游戏").templateFamily).toBe(
      "platformer"
    );
    expect(classifyIdea("做一个炮塔防守路线，抵御三波怪物的塔防游戏").templateFamily).toBe(
      "tower_defense"
    );
    expect(classifyIdea("做一个格子推箱解谜游戏").templateFamily).toBe("grid_logic");
    expect(getMessages("zh-CN").brand.agent).toBe("WOW Game 智能体");
    expect(getMessages("zh-CN").prompt.defaultIdea).toContain("飞船");
  });

  it("validates standard artifacts with zod schemas", () => {
    const project = runMockPipeline("做一个俯视角飞船躲避陨石并收集星星的小游戏");

    expect(validateArtifact("classification", project.classification).success).toBe(true);
    expect(validateArtifact("game-config", project.gameConfig).success).toBe(true);
    expect(classificationSchema.parse(project.classification).templateFamily).toBe("top_down");
    expect(gameConfigSchema.parse(project.gameConfig).referencedAssetKeys.length).toBeGreaterThan(0);
  });
});

describe("conversation flow", () => {
  it("turns an idea into guided questions and advances to gdd review after answers", () => {
    let session = createConversationSession("做一个霓虹飞船躲避陨石并收集星星的小游戏");

    expect(session.stage).toBe("guided_questions");
    expect(session.questions).toHaveLength(4);
    expect(session.turns.at(-1)?.role).toBe("assistant");

    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const action = getNextConversationAction(session);
    expect(action.stage).toBe("gdd_review");
    expect(action.canGenerateArtifact).toBe(true);
  });
});

describe("model gateway orchestration", () => {
  it("falls back to mock output when a provider returns invalid json", async () => {
    const gateway = createModelGateway({
      provider: async () => "not json"
    });

    const result = await gateway.runModelTask({
      taskType: "llm.classification",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      prompt: "判断模板",
      schema: classificationSchema,
      fallback: {
        templateFamily: "top_down",
        reasons: ["fallback"],
        risks: [],
        unsupportedRequests: []
      }
    });

    expect(result.status).toBe("fallback");
    expect(result.output.templateFamily).toBe("top_down");
    expect(result.error).toContain("JSON");
  });

  it("keeps model prompts tied to standard artifacts instead of free code generation", () => {
    const prompt = createPromptForTask("llm.gdd", {
      idea: "做一个跳跃收集金币的森林游戏",
      templateFamily: "platformer"
    });

    expect(prompt).toContain("标准 JSON");
    expect(prompt).toContain("不要生成 Phaser 生命周期代码");
    expect(prompt).toContain("platformer");
  });
});

describe("publish and share", () => {
  it("publishes a version with public share metadata and accepts feedback", () => {
    const backend = createInMemoryBackend();
    const project = backend.projects.createProject("做一个跳跃收集金币的森林游戏");
    const version = backend.pipeline.generateVersion(project.id);

    const publishRecord = backend.play.publish(version.id, {
      visibility: "public",
      baseUrl: "https://wow-game.example"
    });
    const feedback = backend.play.submitFeedback(version.id, {
      rating: 5,
      comment: "可以分享给朋友试玩",
      playerName: "tester"
    });

    expect(publishRecordSchema.parse(publishRecord).publicUrl).toBe(
      `https://wow-game.example/play/${project.id}/${version.id}`
    );
    expect(publishRecord.shareTitle).toContain("WOW Game");
    expect(feedback.iterationSuggestion).toContain("下一版");
  });
});
