import { describe, expect, it } from "vitest";
import { createAssetRequirements, createAssetStyleGuide, runMockPipeline } from "../src/core/pipeline";
import { createGenerationService } from "../src/services/generationService";
import { createMediaGateway } from "../src/services/mediaGateway";
import { selectPreviewRuntimeAssets } from "../src/ui/previewAssets";

describe("procedural game resources", () => {
  it("creates a standard asset style guide for generated resources", () => {
    const guide = createAssetStyleGuide({
      title: "Star Runner",
      templateFamily: "top_down",
      gdd: {
        concept: "collect energy cores",
        loop: ["move", "avoid", "collect"],
        entities: ["ship", "core", "asteroid"],
        level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
        numbers: { playerSpeed: 260 },
        implementationRoute: "Use top_down template"
      }
    });

    expect(guide.palette).toHaveLength(4);
    expect(guide.visualStyle).toContain("top_down");
    expect(guide.audioStyle).toContain("loop");
    expect(guide.assetPrompts["player.ship"]).toContain("Star Runner");
  });

  it("generates usable procedural data urls for every required asset type", async () => {
    const gateway = createMediaGateway();
    const requirements = createAssetRequirements("top_down");

    const generated = await Promise.all(
      requirements.map((requirement) =>
        gateway.generateProjectAsset("project-procedural", "v1", requirement)
      )
    );

    expect(generated.every((asset) => asset.status === "generated")).toBe(true);
    expect(generated.every((asset) => asset.source === "generated")).toBe(true);
    expect(generated.every((asset) => asset.provider === "procedural")).toBe(true);
    expect(generated.find((asset) => asset.assetKey === "player.ship")?.fileUrl).toMatch(/^data:image\/svg\+xml/);
    expect(generated.find((asset) => asset.assetKey === "sfx.collect")?.fileUrl).toMatch(/^data:application\/json/);
    expect(generated.find((asset) => asset.assetKey === "bgm.loop")?.generationParams.pattern).toBe("loop");
    expect(generated.find((asset) => asset.assetKey === "vfx.collect")?.generationParams.preset).toBe("collect-burst");
  });

  it("includes asset-style-guide and procedural assets in the full pipeline", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");

    expect(project.artifacts.some((artifact) => artifact.fileName === "asset-style-guide.json")).toBe(true);
    expect(project.assetPack.assets.some((asset) => asset.assetKey === "item.collectible")).toBe(true);
    expect(project.assetPack.assets.some((asset) => asset.assetKey === "vfx.collect")).toBe(true);
    expect(project.assetPack.assets.every((asset) => asset.fileUrl.startsWith("data:"))).toBe(true);
  });

  it("keeps the asset key stable when users upload replacement resources", () => {
    const gateway = createMediaGateway();
    const asset = createAssetRequirements("top_down").find((item) => item.assetKey === "player.ship");
    if (!asset) throw new Error("missing player.ship requirement");

    const uploaded = gateway.uploadProjectAsset("project-1", "v1", asset, {
      fileName: "hero.png",
      fileUrl: "blob:https://example.test/hero"
    });

    expect(uploaded.assetKey).toBe("player.ship");
    expect(uploaded.status).toBe("uploaded");
    expect(uploaded.fileUrl).toBe("blob:https://example.test/hero");
  });

  it("uses procedural assets in generated playable versions", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-procedural-generation",
      baseUrl: "https://wow-game.example",
      model: "mock-designer"
    });

    expect(result.project.artifacts.some((artifact) => artifact.fileName === "asset-style-guide.json")).toBe(true);
    expect(result.project.assetPack.assets.every((asset) => asset.provider === "procedural")).toBe(true);
    expect(result.project.assetPack.assets.every((asset) => asset.fileUrl.startsWith("data:"))).toBe(true);
    expect(result.project.qaReport.scores.buildHealth).toBeGreaterThan(80);
  });

  it("selects generated asset-pack images for the Phaser preview runtime", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");

    const runtimeAssets = selectPreviewRuntimeAssets(project.assetPack);

    expect(runtimeAssets.player).toMatch(/^data:image\/svg\+xml/);
    expect(runtimeAssets.collectible).toMatch(/^data:image\/svg\+xml/);
    expect(runtimeAssets.hazard).toMatch(/^data:image\/svg\+xml/);
    expect(runtimeAssets.background).toMatch(/^data:image\/svg\+xml/);
  });
});
