import { describe, expect, it } from "vitest";
import { answerDesignQuestion, createConversationSession } from "../src/core/conversation";
import { buildIdeaDialogModel } from "../src/ui/ideaDialogModel";

describe("idea dialog flow", () => {
  it("starts from the user's idea and exposes one unanswered Chinese question at a time", () => {
    const session = createConversationSession("生成一个飞船小游戏");
    const model = buildIdeaDialogModel(session);

    expect(model.turns[0]).toMatchObject({
      role: "user",
      content: "生成一个飞船小游戏"
    });
    expect(model.currentQuestion?.id).toBe(session.questions[0].id);
    expect(model.currentQuestion?.prompt).toContain("玩家");
    expect(model.currentQuestion?.prompt).not.toMatch(/[A-Za-z]{4,}/);
    expect(model.canGenerate).toBe(false);
  });

  it("becomes ready to generate after all guided questions are answered with readable Chinese copy", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const model = buildIdeaDialogModel(session);

    expect(model.currentQuestion).toBeUndefined();
    expect(model.answeredCount).toBe(model.totalQuestions);
    expect(model.canGenerate).toBe(true);
    expect(model.turns.at(-1)?.content).toContain("可以开始生成首版游戏");
  });
});

describe("physics-aware guided questions", () => {
  it("asks different guided questions for different game physics families", () => {
    const platformer = createConversationSession("make a platform jump game with coins", {
      preferredTemplate: "platformer"
    });
    const towerDefense = createConversationSession("make a tower defense game with waves", {
      preferredTemplate: "tower_defense"
    });
    const gridLogic = createConversationSession("make a grid puzzle game with limited moves", {
      preferredTemplate: "grid_logic"
    });

    expect(platformer.questions.map((question) => question.id)).toContain("jump_feel");
    expect(towerDefense.questions.map((question) => question.id)).toContain("tower_types");
    expect(gridLogic.questions.map((question) => question.id)).toContain("rule_goal");
    expect(platformer.questions.map((question) => question.prompt).join(" ")).not.toBe(
      towerDefense.questions.map((question) => question.prompt).join(" ")
    );
  });
});
