import { describe, expect, it } from "vitest";
import {
  assetPackSchema,
  findDuplicateAssetKeys,
  validateProjectAssetUpload
} from "../src/core/schemas";
import { createAssetRequirements } from "../src/core/pipeline";
import { createMediaGateway } from "../src/services/mediaGateway";

describe("project asset protocol", () => {
  it("adds image constraints for character and environment requirements", () => {
    const requirements = createAssetRequirements("top_down");
    const player = requirements.find((asset) => asset.assetKey === "player.ship");
    const background = requirements.find((asset) => asset.assetKey === "world.background");

    expect(player?.transparentBackgroundRequired).toBe(true);
    expect(player?.targetSize).toBe("512x512");
    expect(player?.libraryTags).toEqual(expect.arrayContaining(["character", "top_down"]));
    expect(background?.transparentBackgroundRequired).toBe(false);
    expect(background?.targetSize).toBe("1536x864");
    expect(background?.libraryTags).toEqual(expect.arrayContaining(["environment", "top_down"]));
  });

  it("marks generated project assets with status, source, file url and model metadata", async () => {
    const requirement = createAssetRequirements("top_down").find(
      (asset) => asset.assetKey === "player.ship"
    );
    if (!requirement) throw new Error("missing player.ship fixture");

    const gateway = createMediaGateway({
      imageProvider: async ({ requirement }) => ({
        status: "generated",
        source: "generated",
        fileUrl: `/projects/project-1/v1/assets/${requirement.assetKey}.png`,
        previewUrl: `/projects/project-1/v1/assets/${requirement.assetKey}.png`,
        provider: "image-provider",
        model: "test-image-model",
        generationParams: { size: "512x512" }
      })
    });

    const asset = await gateway.generateProjectAsset("project-1", "v1", requirement);

    expect(asset.assetKey).toBe("player.ship");
    expect(asset.status).toBe("generated");
    expect(asset.source).toBe("generated");
    expect(asset.provider).toBe("image-provider");
    expect(asset.fileUrl).toContain("player.ship.png");
    expect(assetPackSchema.parse({ versionId: "v1", assets: [asset] }).assets[0].assetKey).toBe(
      "player.ship"
    );
  });

  it("falls back to mock or preset assets when provider execution fails", async () => {
    const requirement = createAssetRequirements("top_down").find(
      (asset) => asset.assetKey === "bgm.loop"
    );
    if (!requirement) throw new Error("missing bgm.loop fixture");

    const gateway = createMediaGateway({
      audioProvider: async () => {
        throw new Error("audio provider unavailable");
      }
    });

    const asset = await gateway.generateProjectAsset("project-1", "v1", requirement);

    expect(asset.assetKey).toBe("bgm.loop");
    expect(asset.status).toBe("mock");
    expect(asset.source).toBe("mock");
    expect(asset.error).toContain("audio provider unavailable");
  });

  it("uses asset library fallback for images when no image provider is configured", async () => {
    const requirement = createAssetRequirements("top_down").find(
      (asset) => asset.assetKey === "player.ship"
    );
    if (!requirement) throw new Error("missing player.ship fixture");

    const gateway = createMediaGateway();
    const asset = await gateway.generateProjectAsset("project-1", "v1", requirement);

    expect(asset.assetKey).toBe("player.ship");
    expect(asset.source).toBe("library");
    expect(asset.status).toBe("generated");
    expect(asset.provider).toBe("asset-library");
    expect(asset.fileUrl).toMatch(/^data:image\/png/);
    expect(asset.generationParams.transparentBackground).toBe(true);
    expect(asset.libraryAssetId).toContain("player.ship");
    expect(asset.approvalStatus).toBe("pending");
  });

  it("falls back to asset library for images when provider execution fails", async () => {
    const requirement = createAssetRequirements("top_down").find(
      (asset) => asset.assetKey === "world.background"
    );
    if (!requirement) throw new Error("missing world.background fixture");

    const gateway = createMediaGateway({
      imageProvider: async () => {
        throw new Error("image provider unavailable");
      }
    });

    const asset = await gateway.generateProjectAsset("project-1", "v1", requirement);

    expect(asset.source).toBe("library");
    expect(asset.provider).toBe("asset-library");
    expect(asset.error).toContain("image provider unavailable");
    expect(asset.generationParams.transparentBackground).toBe(false);
  });

  it("keeps the same asset key when regenerating a failed asset", async () => {
    const requirement = {
      ...createAssetRequirements("top_down")[0],
      assetKey: "cover.main",
      status: "failed" as const,
      error: "previous failure"
    };
    const gateway = createMediaGateway({
      imageProvider: async ({ requirement }) => ({
        status: "generated",
        source: "generated",
        fileUrl: `/projects/project-1/v1/assets/${requirement.assetKey}-new.png`,
        provider: "image-provider",
        model: "test-image-model"
      })
    });

    const asset = await gateway.regenerateProjectAsset("project-1", "v1", requirement);

    expect(asset.assetKey).toBe("cover.main");
    expect(asset.status).toBe("generated");
    expect(asset.fileUrl).toContain("cover.main-new.png");
    expect(asset.error).toBeUndefined();
  });

  it("accepts matching uploaded files and rejects mismatched file types", () => {
    const imageRequirement = createAssetRequirements("top_down")[0];

    expect(validateProjectAssetUpload(imageRequirement, "cover.png").success).toBe(true);
    expect(validateProjectAssetUpload(imageRequirement, "cover.mp3").success).toBe(false);
  });

  it("reports duplicate asset keys as build blockers", () => {
    expect(
      findDuplicateAssetKeys([
        { assetKey: "player.ship" },
        { assetKey: "bgm.loop" },
        { assetKey: "player.ship" }
      ])
    ).toEqual(["player.ship"]);
  });
});
