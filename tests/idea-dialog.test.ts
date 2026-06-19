import { describe, expect, it } from "vitest";
import { answerDesignQuestion, createConversationSession } from "../src/core/conversation";
import { buildIdeaDialogModel, readIdeaDialogActionState } from "../src/ui/ideaDialogModel";

describe("idea dialog flow", () => {
  it("starts from the user's idea and exposes one unanswered Chinese question at a time", () => {
    const session = createConversationSession("生成一个飞船小游戏");
    const model = buildIdeaDialogModel(session);

    expect(model.turns[0]).toMatchObject({
      role: "user",
      content: "生成一个飞船小游戏"
    });
    expect(model.currentQuestion?.id).toBe("goal");
    expect(model.currentQuestion?.prompt).toContain("玩家");
    expect(model.currentQuestion?.prompt).not.toMatch(/[A-Za-z]{4,}/);
    expect(model.canGenerate).toBe(false);
  });

  it("asks five professional design questions covering gameplay, failure, roles, visual/audio, and pacing", () => {
    const session = createConversationSession("生成一个太空猫躲避陨石收集鱼干的小游戏", {
      preferredTemplate: "top_down"
    });
    const visibleText = session.questions.map((question) => `${question.label} ${question.prompt}`).join(" ");

    expect(session.questions).toHaveLength(5);
    expect(visibleText).toContain("胜利目标");
    expect(visibleText).toContain("核心操作");
    expect(visibleText).toContain("失败条件");
    expect(visibleText).toContain("角色与道具");
    expect(visibleText).toContain("视听与节奏");
    expect(visibleText).toContain("音效");
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

  it("allows game generation while asset prompts are still preparing", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "guided_questions"
    });

    expect(state.canGenerate).toBe(true);
    expect(state.isPreparingAssets).toBe(true);
    expect(state.buttonLabel).toBe("生成游戏");
    expect(state.statusLabel).toBe("AI 正在生成素材提示词，不影响生成游戏");
  });

  it("allows local fallback generation when design brief is missing", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: false,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "chatting"
    });

    expect(state.canGenerate).toBe(true);
    expect(state.buttonLabel).toBe("生成游戏");
    expect(state.statusLabel).toBe("信息已补齐，可用本地兜底方案生成游戏");
  });

  it("allows generation if questions are answered before model thinking finishes", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: false,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "ai_thinking"
    });

    expect(state.canGenerate).toBe(true);
    expect(state.buttonLabel).toBe("生成游戏");
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

    expect(platformer.questions.map((question) => question.id)).toContain("core_action");
    expect(towerDefense.questions.map((question) => question.defaultAnswer).join(" ")).toContain("炮塔");
    expect(gridLogic.questions.map((question) => question.defaultAnswer).join(" ")).toContain("有限步数");
    expect(platformer.questions.map((question) => question.prompt).join(" ")).not.toBe(
      towerDefense.questions.map((question) => question.prompt).join(" ")
    );
  });
});
