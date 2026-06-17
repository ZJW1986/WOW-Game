import { describe, expect, it } from "vitest";
import { answerDesignQuestion, createConversationSession } from "../src/core/conversation";
import { buildIdeaDialogModel } from "../src/ui/ideaDialogModel";

describe("idea dialog flow", () => {
  it("starts from the user's idea and exposes one unanswered question at a time", () => {
    const session = createConversationSession("生成一个飞船小游戏");
    const model = buildIdeaDialogModel(session);

    expect(model.turns[0]).toMatchObject({
      role: "user",
      content: "生成一个飞船小游戏"
    });
    expect(model.currentQuestion?.id).toBe(session.questions[0].id);
    expect(model.canGenerate).toBe(false);
  });

  it("becomes ready to generate after all guided questions are answered", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const model = buildIdeaDialogModel(session);

    expect(model.currentQuestion).toBeUndefined();
    expect(model.answeredCount).toBe(model.totalQuestions);
    expect(model.canGenerate).toBe(true);
    expect(model.turns.at(-1)?.content).toContain("游戏生成预览界面");
  });
});
