import { describe, expect, it } from "vitest";
import { answerDesignQuestion, createConversationSession } from "../src/core/conversation";
import { buildIdeaDialogModel, readIdeaDialogActionState } from "../src/ui/ideaDialogModel";
import { buildConfirmedCoreAssets, hasConfirmedCoreAssets } from "../src/ui/App";
import { getMessages } from "../src/ui/i18n";
import type { AssetCandidate } from "../src/core/types";
import type { StartUploadedMaterial } from "../src/core/start";

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

  it("asks five professional design questions covering goal, enemy pressure, roles, feedback, and pacing", () => {
    const session = createConversationSession("生成一个太空猫躲避陨石收集鱼干的小游戏", {
      preferredTemplate: "top_down"
    });
    const visibleText = session.questions.map((question) => `${question.label} ${question.prompt}`).join(" ");

    expect(session.questions).toHaveLength(5);
    expect(visibleText).toContain("玩法目标");
    expect(visibleText).toContain("敌人");
    expect(visibleText).toContain("反馈");
    expect(visibleText).toContain("角色与道具");
    expect(visibleText).toContain("关卡节奏");
    expect(visibleText).toContain("音效");
  });

  it("asks smart required optimization slots before generation", () => {
    const session = createConversationSession("做一个霓虹飞船躲陨石收集星星", {
      preferredTemplate: "top_down"
    });
    const visibleText = session.questions.map((question) => `${question.label} ${question.prompt}`).join(" ");

    expect(visibleText).toContain("玩法目标");
    expect(visibleText).toContain("敌人");
    expect(visibleText).toContain("关卡节奏");
    expect(visibleText).toContain("反馈");
    expect(session.questions.every((question) => question.required)).toBe(true);
  });

  it("becomes ready to generate assets after all guided questions are answered", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const model = buildIdeaDialogModel(session);

    expect(model.currentQuestion).toBeUndefined();
    expect(model.answeredCount).toBe(model.totalQuestions);
    expect(model.canGenerate).toBe(true);
    expect(model.turns.at(-1)?.content).toContain("Generate assets first");
  });

  it("uses localized Chinese copy after guided questions are answered", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }
    const copy = getMessages("zh-CN").ideaDialog;

    const model = buildIdeaDialogModel(session, copy);
    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "guided_questions",
      copy
    });

    expect(model.turns.at(-1)?.content).toBe("信息已补全。请先生成素材，确认素材方向后再生成可玩游戏。");
    expect(state.buttonLabel).toBe("生成素材");
    expect(state.statusLabel).toBe("问题已完成，请继续生成核心素材。");
  });

  it("starts asset generation before playable generation", () => {
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

    expect(state.canGenerate).toBe(false);
    expect(state.canStartAssets).toBe(true);
    expect(state.isPreparingAssets).toBe(false);
    expect(state.buttonLabel).toBe("Generate assets");
    expect(state.statusLabel).toBe("Questions are complete. Generate core assets next.");
  });

  it("keeps asset generation as the primary action after answers even if design brief state is delayed", () => {
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

    expect(state.canGenerate).toBe(false);
    expect(state.canStartAssets).toBe(true);
    expect(state.buttonLabel).toBe("Generate assets");
    expect(state.statusLabel).toBe("Questions are complete. Generate core assets next.");
  });

  it("allows asset generation when answered questions recover to chatting phase", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "chatting"
    });

    expect(state.canGenerate).toBe(false);
    expect(state.canStartAssets).toBe(true);
    expect(state.buttonLabel).toBe("Generate assets");
  });

  it("keeps the asset action label while candidates wait for confirmation", () => {
    let session = createConversationSession("生成一个飞船小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const state = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: true,
      hasConfirmedAssets: false,
      creationPhase: "asset_review"
    });

    expect(state.isPreparingAssets).toBe(true);
    expect(state.buttonLabel).toBe("Generate assets");
    expect(state.statusLabel).toBe("Confirm background, player, hazard, and collectible before generating the game.");
  });

  it("blocks generation if questions are answered before model thinking finishes", () => {
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

    expect(state.canGenerate).toBe(false);
    expect(state.buttonLabel).toBe("Send");
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

describe("asset-gated generation flow", () => {
  it("requires confirmed core assets before playable generation", () => {
    let session = createConversationSession("做一个飞船躲避小游戏");
    for (const question of session.questions) {
      session = answerDesignQuestion(session, question.id, question.defaultAnswer);
    }

    const beforeAssets = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: false,
      hasConfirmedAssets: false,
      creationPhase: "guided_questions"
    });
    const afterAssets = readIdeaDialogActionState({
      session,
      hasDesignBrief: true,
      hasAssetCandidates: true,
      hasConfirmedAssets: true,
      creationPhase: "assets_confirmed"
    });

    expect(beforeAssets.canGenerate).toBe(false);
    expect(beforeAssets.canStartAssets).toBe(true);
    expect(beforeAssets.isPreparingAssets).toBe(false);
    expect(beforeAssets.buttonLabel).toBe("Generate assets");
    expect(afterAssets.canGenerate).toBe(true);
    expect(afterAssets.buttonLabel).toBe("Generate game");
  });

  it("allows confirming asset direction when uploaded images replace failed generated slots", () => {
    const candidate = (slot: AssetCandidate["slot"], failed = false): AssetCandidate => ({
      slot,
      assetKey:
        slot === "background"
          ? "world.background"
          : slot === "player"
            ? "player.ship"
            : slot === "hazard"
              ? "hazard.enemy"
              : "item.collectible",
      type: "image",
      label: slot,
      prompt: slot,
      style: "test",
      purpose: slot,
      acceptedFileTypes: ["image/*"],
      previewUrl: failed ? "" : `data:image/png;base64,${slot}`,
      fileUrl: failed ? "" : `data:image/png;base64,${slot}`,
      source: "generated",
      validationStatus: failed ? "failed" : "passed",
      error: failed ? "Agnes image request timed out" : undefined
    });
    const uploadedCollectible: StartUploadedMaterial = {
      id: "uploaded-collectible",
      slot: "collectible",
      assetKey: "item.collectible",
      fileName: "collectible.png",
      mimeType: "image/png",
      fileUrl: "blob:collectible",
      previewUrl: "blob:collectible"
    };

    const confirmed = buildConfirmedCoreAssets(
      {
        candidates: [
          candidate("background"),
          candidate("player"),
          candidate("hazard"),
          candidate("collectible", true)
        ]
      },
      [uploadedCollectible]
    );

    expect(hasConfirmedCoreAssets(confirmed)).toBe(true);
    expect(confirmed.assets.find((asset) => asset.slot === "collectible")?.source).toBe("uploaded");
  });

  it("allows processed cutout sprites with edge-residue warnings to continue generation", () => {
    const candidate = (slot: AssetCandidate["slot"]): AssetCandidate => ({
      slot,
      assetKey:
        slot === "background"
          ? "world.background"
          : slot === "player"
            ? "player.ship"
            : slot === "hazard"
              ? "hazard.enemy"
              : "item.collectible",
      type: "image",
      label: slot,
      prompt: slot,
      style: "test",
      purpose: slot,
      acceptedFileTypes: ["image/*"],
      previewUrl: `/projects/asset-candidates/draft/assets/generated/processed/${slot}.cutout.png`,
      fileUrl: `/projects/asset-candidates/draft/assets/generated/processed/${slot}.cutout.png`,
      source: "generated",
      validationStatus: slot === "background" || slot === "player" ? "passed" : "warning",
      validationErrors:
        slot === "hazard" || slot === "collectible"
          ? ["Sprite has edge residue or subject touches the image edge after cutout."]
          : [],
      generationParams: {
        cutoutApplied: slot !== "background",
        processedLibraryUrl: `/asset-library/assets/test/processed/${slot}.cutout.png`
      }
    });

    const confirmed = buildConfirmedCoreAssets({
      candidates: [candidate("background"), candidate("player"), candidate("hazard"), candidate("collectible")]
    });

    expect(hasConfirmedCoreAssets(confirmed)).toBe(true);
  });
});

