import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import { getMessages } from "../src/ui/i18n";
import { buildStudioChatMessages } from "../src/ui/studioChat";

describe("asset candidates chat handoff", () => {
  it("shows per-slot asset generation progress while Agnes is running", () => {
    const project = runMockPipeline("生成一个飞船躲避游戏");
    const messages = buildStudioChatMessages({
      idea: "生成一个飞船躲避游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "asset_generating",
      followups: [],
      assetCandidateStatus: "loading"
    });

    const loadingMessage = messages.find((message) => message.id === "asset-candidates-loading");
    expect(loadingMessage?.assetProgress?.map((step) => step.slot)).toEqual([
      "background",
      "player",
      "hazard",
      "collectible"
    ]);
    expect(loadingMessage?.content).toContain("背景生成中");
    expect(loadingMessage?.content).toContain("收集物生成中");
  });

  it("shows asset candidates as a required assistant confirmation turn before generation", () => {
    const project = runMockPipeline("生成一个飞船躲避游戏");
    const messages = buildStudioChatMessages({
      idea: "生成一个飞船躲避游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "asset_review",
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
    expect(assetMessage?.content).toContain("请确认背景、主角、危险物和收集物");
    expect(assetMessage?.assetCandidates?.candidates[0].label).toBe("主角飞船");
  });

  it("keeps generated asset cards limited to core image slots", () => {
    const project = runMockPipeline("生成一个飞船躲避游戏");
    const messages = buildStudioChatMessages({
      idea: "生成一个飞船躲避游戏",
      project,
      messages: getMessages("zh-CN"),
      phase: "asset_review",
      followups: [],
      assetCandidates: {
        candidates: [
          {
            slot: "background",
            assetKey: "world.background",
            type: "image",
            label: "背景",
            prompt: "星空背景",
            style: "未来科技",
            purpose: "游戏背景",
            acceptedFileTypes: ["image/*"],
            previewUrl: "data:image/svg+xml;base64,bg",
            fileUrl: "data:image/svg+xml;base64,bg",
            source: "generated"
          },
          {
            slot: "player",
            assetKey: "player.ship",
            type: "image",
            label: "主角",
            prompt: "飞船",
            style: "未来科技",
            purpose: "玩家角色",
            acceptedFileTypes: ["image/*"],
            previewUrl: "data:image/svg+xml;base64,player",
            fileUrl: "data:image/svg+xml;base64,player",
            source: "generated"
          },
          {
            slot: "hazard",
            assetKey: "hazard.enemy",
            type: "image",
            label: "危险物",
            prompt: "陨石",
            style: "未来科技",
            purpose: "危险物",
            acceptedFileTypes: ["image/*"],
            previewUrl: "data:image/svg+xml;base64,hazard",
            fileUrl: "data:image/svg+xml;base64,hazard",
            source: "generated"
          },
          {
            slot: "collectible",
            assetKey: "item.collectible",
            type: "image",
            label: "收集物",
            prompt: "星星",
            style: "未来科技",
            purpose: "收集物",
            acceptedFileTypes: ["image/*"],
            previewUrl: "data:image/svg+xml;base64,item",
            fileUrl: "data:image/svg+xml;base64,item",
            source: "generated"
          }
        ]
      },
      assetCandidateStatus: "ready"
    });

    const assetMessage = messages.find((message) => message.id === "asset-candidates");
    expect(assetMessage?.assetCandidates?.candidates.map((candidate) => candidate.slot)).toEqual([
      "background",
      "player",
      "hazard",
      "collectible"
    ]);
    expect(assetMessage?.assetCandidates?.candidates.every((candidate) => candidate.type === "image")).toBe(true);
  });
});
