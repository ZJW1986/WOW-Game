import { describe, expect, it } from "vitest";
import { getMessages, supportedLocales } from "../src/ui/i18n";

describe("ui i18n messages", () => {
  it("uses Chinese as the default product language", () => {
    expect(getMessages("zh-CN").brand.agent).toBe("WOW Game 智能体");
    expect(getMessages("zh-CN").tabs.preview).toBe("预览");
    expect(getMessages("zh-CN").prompt.localEngine).toBe("本地体验引擎");
  });

  it("keeps an English locale available for future language switching", () => {
    expect(supportedLocales).toEqual(["zh-CN", "en-US"]);
    expect(getMessages("en-US").tabs.assets).toBe("Asset Hub");
    expect(getMessages("en-US").prompt.localEngine).toBe("Local Experience Engine");
  });
});
