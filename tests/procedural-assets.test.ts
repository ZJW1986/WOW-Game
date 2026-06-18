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
    expect(generated.find((asset) => asset.assetKey === "player.ship")?.source).toBe("library");
    expect(generated.find((asset) => asset.assetKey === "player.ship")?.provider).toBe("asset-library");
    expect(generated.find((asset) => asset.assetKey === "player.ship")?.fileUrl).toMatch(/^data:image\/png/);
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
    expect(project.assetPack.assets.find((asset) => asset.assetKey === "player.ship")?.source).toBe("library");
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
    expect(result.project.assetPack.assets.find((asset) => asset.assetKey === "player.ship")?.provider).toBe("asset-library");
    expect(result.project.assetPack.assets.every((asset) => asset.fileUrl.startsWith("data:"))).toBe(true);
    expect(result.project.qaReport.scores.buildHealth).toBeGreaterThan(80);
  });

  it("selects generated asset-pack images for the Phaser preview runtime", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");

    const runtimeAssets = selectPreviewRuntimeAssets(project.assetPack);

    expect(runtimeAssets.player).toMatch(/^data:image\/png/);
    expect(runtimeAssets.collectible).toMatch(/^data:image\/png/);
    expect(runtimeAssets.hazard).toMatch(/^data:image\/png/);
    expect(runtimeAssets.background).toMatch(/^data:image\/png/);
  });

  it("selects project image urls for the Phaser preview runtime", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const assetPack = {
      ...project.assetPack,
      assets: project.assetPack.assets.map((asset) =>
        asset.assetKey === "player.ship"
          ? { ...asset, fileUrl: "/projects/project-1/v1/assets/player.ship.png" }
          : asset
      )
    };

    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);

    expect(runtimeAssets.player).toBe("/projects/project-1/v1/assets/player.ship.png");
  });

  it("gives uploaded user materials priority in generated playable asset-packs and preview runtime", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个横版平台跳跃游戏，主角收集金币到终点",
      answers: [],
      templateFamily: "platformer",
      projectId: "project-uploaded-materials",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      userMaterials: [
        {
          assetKey: "world.background",
          slot: "background",
          fileName: "forest-bg.png",
          fileUrl: "data:image/png;base64,uploadedBackground",
          previewUrl: "data:image/png;base64,uploadedBackground",
          mimeType: "image/png"
        },
        {
          assetKey: "player.hero",
          slot: "player",
          fileName: "hero.png",
          fileUrl: "data:image/png;base64,uploadedHero",
          previewUrl: "data:image/png;base64,uploadedHero",
          mimeType: "image/png"
        }
      ]
    });

    const background = result.project.assetPack.assets.find((asset) => asset.assetKey === "cover.main");
    const hero = result.project.assetPack.assets.find((asset) => asset.assetKey === "player.hero");
    const runtimeAssets = selectPreviewRuntimeAssets(result.project.assetPack);

    expect(result.project.gameConfig.templateFamily).toBe("platformer");
    expect(result.project.gameConfig.gameplay.primaryAction).toBe("jump_reach_goal");
    expect(background?.source).toBe("uploaded");
    expect(background?.provider).toBe("uploaded");
    expect(background?.fileUrl).toBe("data:image/png;base64,uploadedBackground");
    expect(hero?.source).toBe("uploaded");
    expect(runtimeAssets.background).toBe("data:image/png;base64,uploadedBackground");
    expect(runtimeAssets.player).toBe("data:image/png;base64,uploadedHero");
  });
});
