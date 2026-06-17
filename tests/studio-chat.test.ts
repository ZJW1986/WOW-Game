import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import { getMessages } from "../src/ui/i18n";
import { createConversationSession, answerDesignQuestion } from "../src/core/conversation";
import { buildStudioChatMessages } from "../src/ui/studioChat";

describe("studio chat message layout", () => {
  it("keeps the original idea, follow-up requirements, and assistant proposal as separate turns", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const messages = buildStudioChatMessages({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "proposal",
      followups: [
        {
          id: "followup-1",
          content: "增加一个限时模式",
          createdAt: "2026-06-17T00:00:00.000Z"
        }
      ]
    });

    expect(messages.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "user",
      "assistant"
    ]);
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
      phase: "proposal",
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

  it("shows the current guided question and then the user's answer as chat turns", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const session = createConversationSession("做一个飞船躲避陨石并收集星星的小游戏");
    const firstQuestion = session.questions[0];
    const answered = answerDesignQuestion(session, firstQuestion.id, "收集 8 颗星星并到达传送门");
    const messages = buildStudioChatMessages({
      idea: session.idea,
      project,
      messages: getMessages("zh-CN"),
      phase: "thinking",
      followups: [],
      session: answered
    });

    expect(messages.some((message) => message.role === "assistant" && message.content === firstQuestion.prompt)).toBe(
      true
    );
    expect(messages.some((message) => message.role === "user" && message.content.includes("收集 8 颗星星"))).toBe(
      true
    );
    expect(messages.some((message) => message.role === "assistant" && message.content === session.questions[1].prompt)).toBe(
      true
    );
  });
});
