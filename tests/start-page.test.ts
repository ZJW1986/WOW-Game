import { describe, expect, it } from "vitest";
import {
  createStartGameDraft,
  modelOptions,
  templateOptions
} from "../src/core/start";

describe("start page draft", () => {
  it("uses DeepSeek v4 flash and top_down template by default", () => {
    const draft = createStartGameDraft({
      idea: "做一个飞船躲避陨石的小游戏"
    });

    expect(draft.model).toBe("deepseek-v4-flash");
    expect(draft.templateFamily).toBe("top_down");
    expect(draft.idea).toContain("飞船");
  });

  it("keeps selectable models and templates explicit for the create dialog", () => {
    expect(modelOptions.map((model) => model.id)).toContain("deepseek-v4-flash");
    expect(templateOptions.map((template) => template.id)).toEqual([
      "top_down",
      "platformer",
      "grid_logic",
      "tower_defense",
      "ui_heavy"
    ]);
  });

  it("captures uploaded file names without storing file content in the draft", () => {
    const draft = createStartGameDraft({
      idea: "做一个跳跃收集金币的游戏",
      templateFamily: "platformer",
      uploadedFileNames: ["character.png", "music.mp3"]
    });

    expect(draft.templateFamily).toBe("platformer");
    expect(draft.uploadedFileNames).toEqual(["character.png", "music.mp3"]);
  });
});
