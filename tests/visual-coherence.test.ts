import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { analyzeVisualCoherence } from "../src/services/visualCoherence";
import type { AssetPack } from "../src/core/types";

async function pngDataUrl(width: number, height: number, color: [number, number, number]): Promise<string> {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="rgb(${color[0]},${color[1]},${color[2]})"/></svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function assetPack(images: Array<{ assetKey: string; fileUrl: string }>): AssetPack {
  return {
    versionId: "v1",
    assets: images.map((image) => ({
      assetKey: image.assetKey,
      slot: image.assetKey.includes("background")
        ? "background"
        : image.assetKey.includes("player")
          ? "player"
          : image.assetKey.includes("hazard")
            ? "hazard"
            : "collectible",
      type: "image",
      label: image.assetKey,
      prompt: image.assetKey,
      style: "arcade",
      purpose: image.assetKey,
      acceptedFileTypes: ["image/*"],
      previewUrl: image.fileUrl,
      fileUrl: image.fileUrl,
      source: "generated",
      provider: "test",
      model: "test-model",
      generationMode: "model",
      copyrightStatus: "generated",
      spec: image.assetKey,
      status: "generated",
      generationParams: {}
    }))
  };
}

describe("visual coherence", () => {
  it("scores same-tone image sets higher than mismatched sets", async () => {
    const coherent = await analyzeVisualCoherence(
      assetPack([
        { assetKey: "world.background", fileUrl: await pngDataUrl(32, 32, [24, 28, 40]) },
        { assetKey: "player.ship", fileUrl: await pngDataUrl(32, 32, [28, 34, 46]) },
        { assetKey: "hazard.enemy", fileUrl: await pngDataUrl(32, 32, [30, 32, 42]) },
        { assetKey: "item.collectible", fileUrl: await pngDataUrl(32, 32, [32, 36, 48]) }
      ])
    );
    const incoherent = await analyzeVisualCoherence(
      assetPack([
        { assetKey: "world.background", fileUrl: await pngDataUrl(32, 32, [8, 16, 120]) },
        { assetKey: "player.ship", fileUrl: await pngDataUrl(32, 32, [240, 220, 16]) },
        { assetKey: "hazard.enemy", fileUrl: await pngDataUrl(32, 32, [210, 32, 32]) },
        { assetKey: "item.collectible", fileUrl: await pngDataUrl(32, 32, [32, 220, 80]) }
      ])
    );

    expect(coherent.score).toBeGreaterThan(incoherent.score);
    expect(coherent.score).toBeGreaterThanOrEqual(0.6);
    expect(incoherent.score).toBeLessThan(0.6);
  });
});
