import { describe, expect, it } from "vitest";
import {
  answerDesignQuestion,
  createConversationSession,
  createGuidedQuestions,
  createThreeGuidedQuestions
} from "../src/core/conversation";

describe("engine-aware guided questions", () => {
  it("asks different professional questions for 2D and 3D ideas", () => {
    const twoD = createGuidedQuestions("平台跳跃收集金币", "platformer");
    const threeD = createThreeGuidedQuestions("手机竖屏太空飞船躲避陨石收集能量", "flight_shooter");

    expect(twoD.map((question) => question.prompt).join(" ")).toContain("平台");
    expect(threeD.map((question) => question.prompt).join(" ")).toContain("镜头");
    expect(threeD.map((question) => question.prompt).join(" ")).toContain("手机");
    expect(threeD.map((question) => question.prompt).join(" ")).toContain("前 30 秒");
    expect(threeD.map((question) => question.prompt).join(" ")).not.toBe(twoD.map((question) => question.prompt).join(" "));
  });

  it("creates 3D conversation sessions without Phaser-only template questions", () => {
    const session = createConversationSession("手机竖屏太空飞船躲避陨石收集能量", {
      engineType: "threejs3d",
      threeGameGenre: "flight_shooter"
    });

    expect(session.questions).toHaveLength(5);
    expect(session.questions.map((question) => question.id)).toEqual([
      "three_camera",
      "three_controls",
      "three_space_route",
      "three_hazard_feedback",
      "three_asset_style"
    ]);
  });

  it("updates an existing 3D answer instead of appending duplicate turns", () => {
    let session = createConversationSession("手机竖屏飞机射击，躲避陨石并收集能量", {
      engineType: "threejs3d",
      threeGameGenre: "flight_shooter"
    });

    session = answerDesignQuestion(session, "three_camera", "追尾飞行镜头");
    session = answerDesignQuestion(session, "three_camera", "俯视飞行镜头");

    expect(session.answers).toHaveLength(1);
    expect(session.answers[0]).toMatchObject({ questionId: "three_camera", value: "俯视飞行镜头" });
    expect(session.turns.filter((turn) => turn.content.includes("3D视角与镜头"))).toHaveLength(1);
    expect(session.turns.map((turn) => turn.content).join(" ")).not.toContain("锟");
  });
});
