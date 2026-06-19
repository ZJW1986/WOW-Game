import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import { getMessages } from "../src/ui/i18n";
import { buildStudioChatMessages } from "../src/ui/studioChat";

describe("asset candidates chat handoff", () => {
  it("shows asset candidates as an assistant chat turn without blocking generation", () => {
    const project = runMockPipeline("生成一个飞船躲避游戏");
    const messages = buildStudioChatMessages({
      idea: "生成一个飞船躲避游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "ready_to_generate",
      followups: [],
      assetCandidates: {
        candidates: [
          {
            slot: "player",
            assetKey: "player.ship",
            type: "image",
            label: "主角飞船",
            prompt: "霓虹飞船精灵图",
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

    const assetMessage = messages.find((message) => message.id === "asset-candidates");
    expect(assetMessage?.role).toBe("assistant");
    expect(assetMessage?.content).toContain("素材已生成，可选确认");
    expect(assetMessage?.assetCandidates?.candidates[0].label).toBe("主角飞船");
  });
});
