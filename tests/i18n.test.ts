import { describe, expect, it } from "vitest";
import { getMessages, messages, supportedLocales } from "../src/ui/i18n";
import { containsMojibake } from "./mojibake";

function flatten(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flatten);
  }
  return [];
}

describe("ui i18n messages", () => {
  it("uses Chinese as the default product language", () => {
    expect(getMessages("zh-CN").brand.agent).toBe("WOW Game 智能体");
    expect(getMessages("zh-CN").tabs.preview).toBe("预览");
    expect(getMessages("zh-CN").prompt.localEngine).toBe("本地体验引擎");
    expect(getMessages("zh-CN").projects.title).toBe("我的项目");
  });

  it("includes cooking copy for the preview generation state", () => {
    expect(getMessages("zh-CN").preview.cookingTitle).toBe("正在生成你的游戏");
    expect(getMessages("zh-CN").preview.cookingSubtitle).toBe("We're cooking...");
  });

  it("keeps all visible locale copy free from mojibake", () => {
    const visibleText = flatten(messages).join("\n");

    expect(containsMojibake(visibleText)).toBe(false);
  });

  it("keeps an English locale available for future language switching", () => {
    expect(supportedLocales).toEqual(["zh-CN", "en-US"]);
    expect(getMessages("en-US").tabs.assets).toBe("Asset Hub");
    expect(getMessages("en-US").prompt.localEngine).toBe("Local Experience Engine");
    expect(getMessages("en-US").projects.title).toBe("My Projects");
  });
});
