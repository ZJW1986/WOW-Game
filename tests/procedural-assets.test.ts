import { describe, expect, it } from "vitest";
import { createAssetRequirements, createAssetStyleGuide, runMockPipeline } from "../src/core/pipeline";
import { createGenerationService } from "../src/services/generationService";
import { createMediaGateway } from "../src/services/mediaGateway";
import { createRuntimeAssetReport, selectPreviewRuntimeAssets } from "../src/ui/previewAssets";
import sharp from "sharp";

async function pngDataUrl(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

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

  it("generates cover poster artifacts and marks large-map backgrounds as tileable", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "大地图飞船躲避陨石收集能量，背景要能循环平铺",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-tileable-poster",
      baseUrl: "https://wow-game.example",
      model: "mock-designer"
    });

    const background = result.project.assetPack.assets.find((asset) => asset.assetKey === "world.background");

    expect(background?.generationParams.backgroundMode).toBe("tileable_map");
    expect(background?.generationParams.runtimeFormat).toBe("webp");
    expect(result.project.coverPosterUrl).toBeTruthy();
    expect(result.project.coverThumbnailUrl).toBeTruthy();
    expect(result.project.artifacts.map((artifact) => artifact.fileName)).toEqual(
      expect.arrayContaining(["developer-brief.json", "developer-brief.md", "cover-poster.json", "cover-poster.webp"])
    );
  });

  it("derives a stable project title from the player idea when model title is generic", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "太空猫躲避陨石收集鱼干",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-title-from-idea",
      baseUrl: "https://wow-game.example",
      model: "mock-designer"
    });

    expect(result.project.title).toBe("太空猫鱼干航线");
    expect(result.project.gameConfig.title).toBe("太空猫鱼干航线");
    expect(result.publishRecord.shareTitle).toBe("WOW Game - 太空猫鱼干航线");
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

  it("does not use cover art as the gameplay background", () => {
    const project = runMockPipeline("test strict background slot");
    const assetPack = {
      ...project.assetPack,
      assets: project.assetPack.assets.map((asset) => {
        if (asset.assetKey === "world.background") {
          return { ...asset, status: "missing" as const, fileUrl: "" };
        }
        if (asset.assetKey === "cover.main") {
          return { ...asset, fileUrl: "/projects/project-1/v1/assets/cover.main.png" };
        }
        return asset;
      })
    };

    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);
    const report = createRuntimeAssetReport(assetPack);
    const background = report.slots.find((slot) => slot.slot === "background");

    expect(runtimeAssets.background).toBeUndefined();
    expect(background?.assetKey).toBe("world.background");
    expect(background?.status).toBe("failed");
    expect(report.ready).toBe(false);
  });

  it("reports exact runtime core asset bindings for delivery diagnostics", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const assetPack = {
      ...project.assetPack,
      assets: project.assetPack.assets.map((asset) => {
        if (asset.assetKey === "world.background") {
          return { ...asset, fileUrl: "/projects/project-1/v1/assets/world.background.png", provider: "agnes" };
        }
        if (asset.assetKey === "player.ship") {
          return { ...asset, fileUrl: "/projects/project-1/v1/assets/player.ship.png", provider: "agnes" };
        }
        if (asset.assetKey === "hazard.enemy") {
          return { ...asset, fileUrl: "/projects/project-1/v1/assets/hazard.enemy.png", provider: "agnes" };
        }
        if (asset.assetKey === "item.collectible") {
          return { ...asset, fileUrl: "/projects/project-1/v1/assets/item.collectible.png", provider: "agnes" };
        }
        return asset;
      })
    };

    const report = createRuntimeAssetReport(assetPack);

    expect(report.ready).toBe(true);
    expect(report.slots.map((slot) => slot.assetKey)).toEqual([
      "world.background",
      "player.ship",
      "hazard.enemy",
      "item.collectible"
    ]);
    expect(report.slots.every((slot) => slot.status === "bound")).toBe(true);
    expect(report.slots.every((slot) => slot.provider === "agnes")).toBe(true);
    expect(report.slots.find((slot) => slot.slot === "background")).toMatchObject({
      slotRole: "background",
      runtimeWidth: 960,
      runtimeHeight: 540
    });
    expect(report.slots.find((slot) => slot.slot === "player")).toMatchObject({
      slotRole: "sprite",
      runtimeWidth: 64,
      runtimeHeight: 64
    });
  });

  it("does not mark remote provider urls as runtime-ready before localization", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const assetPack = {
      ...project.assetPack,
      assets: project.assetPack.assets.map((asset) =>
        asset.assetKey === "player.ship"
          ? {
              ...asset,
              fileUrl: "https://platform-outputs.agnes-ai.space/images/player.png",
              previewUrl: "https://platform-outputs.agnes-ai.space/images/player.png",
              provider: "agnes",
              status: "generated" as const
            }
          : asset
      )
    };

    const report = createRuntimeAssetReport(assetPack);
    const player = report.slots.find((slot) => slot.slot === "player");

    expect(report.ready).toBe(false);
    expect(player?.status).toBe("invalid_url");
    expect(player?.error).toContain("localized");
  });

  it("applies confirmed core image assets to the exact runtime asset keys", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个霓虹飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-confirmed-core-assets",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      confirmedAssets: {
        assets: [
          {
            slot: "background",
            assetKey: "world.background",
            type: "image",
            label: "星空背景",
            prompt: "blue neon space background",
            style: "neon sci-fi",
            purpose: "game background",
            acceptedFileTypes: ["image/*"],
            previewUrl: "/projects/draft/v1/assets/background.png",
            fileUrl: "/projects/draft/v1/assets/background.png",
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "player",
            assetKey: "player.ship",
            type: "image",
            label: "飞船",
            prompt: "neon spaceship sprite",
            style: "neon sci-fi",
            purpose: "player",
            acceptedFileTypes: ["image/*"],
            previewUrl: "/projects/draft/v1/assets/player.png",
            fileUrl: "/projects/draft/v1/assets/player.png",
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "hazard",
            assetKey: "hazard.asteroid",
            type: "image",
            label: "陨石",
            prompt: "asteroid hazard sprite",
            style: "neon sci-fi",
            purpose: "hazard",
            acceptedFileTypes: ["image/*"],
            previewUrl: "/projects/draft/v1/assets/hazard.png",
            fileUrl: "/projects/draft/v1/assets/hazard.png",
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "collectible",
            assetKey: "item.collectible",
            type: "image",
            label: "星星",
            prompt: "glowing star collectible",
            style: "neon sci-fi",
            purpose: "collectible",
            acceptedFileTypes: ["image/*"],
            previewUrl: "/projects/draft/v1/assets/item.png",
            fileUrl: "/projects/draft/v1/assets/item.png",
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          }
        ]
      }
    });

    const assetByKey = new Map(result.project.assetPack.assets.map((asset) => [asset.assetKey, asset]));
    const runtimeAssets = selectPreviewRuntimeAssets(result.project.assetPack);

    expect(assetByKey.get("world.background")?.fileUrl).toBe("/projects/draft/v1/assets/background.png");
    expect(assetByKey.get("player.ship")?.fileUrl).toBe("/projects/draft/v1/assets/player.png");
    expect(assetByKey.get("hazard.enemy")?.fileUrl).toBe("/projects/draft/v1/assets/hazard.png");
    expect(assetByKey.get("item.collectible")?.fileUrl).toBe("/projects/draft/v1/assets/item.png");
    expect(runtimeAssets.background).toBe("/projects/draft/v1/assets/background.png");
    expect(runtimeAssets.player).toBe("/projects/draft/v1/assets/player.png");
    expect(runtimeAssets.hazard).toBe("/projects/draft/v1/assets/hazard.png");
    expect(runtimeAssets.collectible).toBe("/projects/draft/v1/assets/item.png");
  });

  it("does not call the image provider again when confirmed core images already exist", async () => {
    let imageProviderCalls = 0;
    const service = createGenerationService({
      mediaGateway: {
        imageProvider: async () => {
          imageProviderCalls += 1;
          throw new Error("image provider should not block confirmed-assets generation");
        }
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "spaceship dodge asteroids collect stars",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-skip-image-provider",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      confirmedAssets: {
        assets: [
          {
            slot: "background",
            assetKey: "world.background",
            type: "image",
            label: "background",
            prompt: "space background",
            style: "neon",
            purpose: "background",
            acceptedFileTypes: ["image/*"],
            previewUrl: await pngDataUrl(160, 90),
            fileUrl: await pngDataUrl(160, 90),
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "player",
            assetKey: "player.ship",
            type: "image",
            label: "ship",
            prompt: "spaceship",
            style: "neon",
            purpose: "player",
            acceptedFileTypes: ["image/*"],
            previewUrl: await pngDataUrl(32, 32),
            fileUrl: await pngDataUrl(32, 32),
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "hazard",
            assetKey: "hazard.enemy",
            type: "image",
            label: "asteroid",
            prompt: "asteroid",
            style: "neon",
            purpose: "hazard",
            acceptedFileTypes: ["image/*"],
            previewUrl: await pngDataUrl(32, 32),
            fileUrl: await pngDataUrl(32, 32),
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          },
          {
            slot: "collectible",
            assetKey: "item.collectible",
            type: "image",
            label: "star",
            prompt: "star",
            style: "neon",
            purpose: "collectible",
            acceptedFileTypes: ["image/*"],
            previewUrl: await pngDataUrl(32, 32),
            fileUrl: await pngDataUrl(32, 32),
            source: "generated",
            provider: "agnes",
            approvalStatus: "approved"
          }
        ]
      }
    });

    expect(imageProviderCalls).toBe(0);
    expect(result.deliveryReady).toBe(true);
  });

  it("selects uploaded audio urls for the Phaser preview runtime", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const assetPack = {
      ...project.assetPack,
      assets: project.assetPack.assets.map((asset) => {
        if (asset.assetKey === "bgm.loop") return { ...asset, fileUrl: "data:audio/mpeg;base64,bgm" };
        if (asset.assetKey === "sfx.collect") return { ...asset, fileUrl: "data:audio/wav;base64,collect" };
        if (asset.assetKey === "sfx.hit") return { ...asset, fileUrl: "data:audio/wav;base64,hit" };
        return asset;
      })
    };

    const runtimeAssets = selectPreviewRuntimeAssets(assetPack);

    expect(runtimeAssets.bgm).toBe("data:audio/mpeg;base64,bgm");
    expect(runtimeAssets.sfx.collect).toBe("data:audio/wav;base64,collect");
    expect(runtimeAssets.sfx.hit).toBe("data:audio/wav;base64,hit");
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

    const background = result.project.assetPack.assets.find((asset) => asset.assetKey === "world.background");
    const hero = result.project.assetPack.assets.find((asset) => asset.assetKey === "player.ship");
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

  it("gives uploaded audio user materials priority in generated playable asset-packs", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-uploaded-audio",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      userMaterials: [
        {
          assetKey: "bgm.loop",
          slot: "bgm",
          fileName: "loop.mp3",
          fileUrl: "data:audio/mpeg;base64,bgm",
          previewUrl: "data:audio/mpeg;base64,bgm",
          mimeType: "audio/mpeg"
        },
        {
          assetKey: "sfx.hit",
          slot: "sfx",
          fileName: "hit.wav",
          fileUrl: "data:audio/wav;base64,hit",
          previewUrl: "data:audio/wav;base64,hit",
          mimeType: "audio/wav"
        }
      ]
    });

    const bgm = result.project.assetPack.assets.find((asset) => asset.assetKey === "bgm.loop");
    const hit = result.project.assetPack.assets.find((asset) => asset.assetKey === "sfx.hit");
    const runtimeAssets = selectPreviewRuntimeAssets(result.project.assetPack);

    expect(bgm?.source).toBe("uploaded");
    expect(bgm?.fileUrl).toBe("data:audio/mpeg;base64,bgm");
    expect(hit?.source).toBe("uploaded");
    expect(hit?.fileUrl).toBe("data:audio/wav;base64,hit");
    expect(runtimeAssets.bgm).toBe("data:audio/mpeg;base64,bgm");
    expect(runtimeAssets.sfx.hit).toBe("data:audio/wav;base64,hit");
  });
});
