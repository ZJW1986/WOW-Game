import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { createGenerationService } from "../src/services/generationService";
import {
  createVisualAssetReport,
  validateCoreAssetCandidate
} from "../src/services/visualAssetValidation";
import type { AssetCandidate } from "../src/core/types";

function pngDataUrl(width: number, height: number, colorType: 2 | 6): string {
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const raw = Buffer.alloc((width * bytesPerPixel + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * bytesPerPixel + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * bytesPerPixel;
      raw[offset] = 255;
      raw[offset + 1] = 255;
      raw[offset + 2] = 255;
      if (colorType === 6) raw[offset + 3] = x < width / 2 ? 0 : 255;
    }
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const chunks = [
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ];
  return `data:image/png;base64,${Buffer.concat([signature, ...chunks]).toString("base64")}`;
}

function chunk(type: string, data: Buffer): Buffer {
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, 4, "ascii");
  data.copy(output, 8);
  output.writeUInt32BE(0, 8 + data.length);
  return output;
}

function candidate(slot: AssetCandidate["slot"], fileUrl: string): AssetCandidate {
  return {
    slot,
    assetKey: slot === "player" ? "player.ship" : slot === "hazard" ? "hazard.enemy" : slot === "collectible" ? "item.collectible" : "world.background",
    type: "image",
    label: slot,
    prompt: `${slot} prompt`,
    style: "arcade",
    purpose: slot,
    acceptedFileTypes: ["image/*"],
    previewUrl: fileUrl,
    fileUrl,
    source: "generated",
    provider: "test",
    approvalStatus: "approved"
  };
}

describe("visual asset validation", () => {
  it("rejects opaque sprite PNGs before they can be confirmed", () => {
    const validated = validateCoreAssetCandidate(candidate("player", pngDataUrl(32, 32, 2)));

    expect(validated.validationStatus).toBe("failed");
    expect(validated.validationErrors?.join(" ")).toContain("transparent");
  });

  it("accepts transparent sprite PNGs and records visual metadata", () => {
    const validated = validateCoreAssetCandidate(candidate("player", pngDataUrl(32, 32, 6)));

    expect(validated.validationStatus).toBe("passed");
    expect(validated.requiresTransparency).toBe(true);
    expect(validated.alphaCoverage).toBeGreaterThan(0);
    expect(validated.subjectBounds).toMatchObject({ width: 32, height: 32 });
  });

  it("records visual asset and playability reports in generated artifacts", async () => {
    const service = createGenerationService();
    const result = await service.generatePlayableVersion({
      idea: "太空猫躲避陨石收集鱼干",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-visual-report",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      confirmedAssets: {
        assets: [
          candidate("background", pngDataUrl(160, 90, 2)),
          candidate("player", pngDataUrl(32, 32, 6)),
          candidate("hazard", pngDataUrl(32, 32, 6)),
          candidate("collectible", pngDataUrl(32, 32, 6))
        ]
      }
    });

    const visualReport = createVisualAssetReport(result.project.assetPack);

    expect(result.project.artifacts.some((artifact) => artifact.fileName === "visual-asset-report.json")).toBe(true);
    expect(result.project.artifacts.some((artifact) => artifact.fileName === "playability-report.json")).toBe(true);
    expect(visualReport.ready).toBe(true);
  });
});
