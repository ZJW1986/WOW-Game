import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import { answerDesignQuestion, createConversationSession } from "../src/core/conversation";
import { getMessages } from "../src/ui/i18n";
import { buildStudioChatMessages } from "../src/ui/studioChat";

describe("studio chat message layout", () => {
  it("keeps the original idea, follow-up requirements, and assistant proposal as separate turns", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const messages = buildStudioChatMessages({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "ready",
      followups: [
        {
          id: "followup-1",
          content: "增加一个限时模式",
          createdAt: "2026-06-17T00:00:00.000Z"
        }
      ]
    });

    expect(messages.map((message) => message.role)).toEqual(["assistant", "user", "user", "assistant"]);
    expect(messages[1].content).toBe("做一个飞船躲避陨石并收集星星的小游戏");
    expect(messages[2].content).toBe("增加一个限时模式");
    expect(messages[3].content).toContain(project.gameConfig.playerGoal);
    expect(messages[1].content).not.toContain(messages[2].content);
  });

  it("splits legacy newline-based follow-ups into separate turns", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const messages = buildStudioChatMessages({
      idea: "做一个飞船躲避陨石并收集星星的小游戏\n补充需求：增加一个限时模式",
      project,
      messages: getMessages("zh-CN"),
      phase: "chatting",
      followups: []
    });

    expect(messages[1].content).toBe("做一个飞船躲避陨石并收集星星的小游戏");
    expect(messages[2].content).toBe("增加一个限时模式");
  });

  it("keeps the follow-up as a visible user turn even before regeneration", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const messages = buildStudioChatMessages({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "revision",
      followups: [
        {
          id: "followup-visible",
          content: "让失败后能马上重开",
          createdAt: "2026-06-17T00:00:00.000Z"
        }
      ]
    });

    expect(messages.map((message) => message.role)).toContain("user");
    expect(messages.some((message) => message.content.includes("让失败后能马上重开"))).toBe(true);
  });

  it("deduplicates repeated follow-up submissions in the chat stream", () => {
    const project = runMockPipeline("做一个跳跃小游戏");
    const repeated = "已上传素材，替换主角: ball01.png";
    const messages = buildStudioChatMessages({
      idea: "做一个跳跃小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "revision",
      followups: [
        { id: "followup-1", content: repeated, createdAt: "2026-06-19T00:00:00.000Z" },
        { id: "followup-2", content: repeated, createdAt: "2026-06-19T00:00:01.000Z" },
        { id: "followup-3", content: repeated, createdAt: "2026-06-19T00:00:02.000Z" }
      ]
    });

    expect(messages.filter((message) => message.content === repeated)).toHaveLength(1);
  });

  it("shows the current guided question and then the user's answer as chat turns", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const session = createConversationSession("做一个飞船躲避陨石并收集星星的小游戏");
    const firstQuestion = session.questions[0];
    const answered = answerDesignQuestion(session, firstQuestion.id, "收集 8 颗星星并到达传送门");
    const messages = buildStudioChatMessages({
      idea: session.idea,
      project,
      messages: getMessages("zh-CN"),
      phase: "chatting",
      followups: [],
      session: answered
    });

    expect(messages.some((message) => message.role === "assistant" && message.content === firstQuestion.prompt)).toBe(
      true
    );
    expect(messages.some((message) => message.role === "user" && message.content.includes("收集 8 颗星星"))).toBe(
      true
    );
    expect(
      messages.some((message) => message.role === "assistant" && message.content === session.questions[1].prompt)
    ).toBe(true);
  });

  it("shows uploaded zip reference as a separate system turn", () => {
    const project = runMockPipeline("做一个太空猫躲避陨石的小游戏");
    const messages = buildStudioChatMessages({
      idea: "做一个太空猫躲避陨石的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "chatting",
      followups: [],
      referencePackageName: "飞机大战参考包"
    });

    expect(messages.some((message) => message.role === "system" && message.content === "已参考：飞机大战参考包")).toBe(
      true
    );
  });

  it("does not append playable-ready copy during asset generation or review", () => {
    const project = runMockPipeline("做一个太空猫躲避陨石的小游戏");
    const loadingMessages = buildStudioChatMessages({
      idea: "做一个太空猫躲避陨石的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "asset_generating",
      followups: [],
      assetCandidateStatus: "loading"
    });
    const reviewMessages = buildStudioChatMessages({
      idea: "做一个太空猫躲避陨石的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "asset_review",
      followups: [],
      assetCandidates: {
        candidates: [
          {
            slot: "player",
            assetKey: "player.ship",
            type: "image",
            label: "太空猫飞船",
            prompt: "太空猫飞船，透明背景",
            style: "未来科技",
            purpose: "玩家角色",
            acceptedFileTypes: ["image/*"],
            previewUrl: "data:image/svg+xml;base64,abc",
            fileUrl: "data:image/svg+xml;base64,abc",
            source: "generated"
          }
        ]
      },
      assetCandidateStatus: "ready"
    });

    expect(loadingMessages.some((message) => message.id === "asset-candidates-loading")).toBe(true);
    expect(reviewMessages.some((message) => message.id === "asset-candidates")).toBe(true);
    expect(loadingMessages.map((message) => message.content).join("\n")).not.toContain("成熟体验");
    expect(reviewMessages.map((message) => message.content).join("\n")).not.toContain("成熟体验");
  });
});
