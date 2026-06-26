import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { AssetCandidate, AssetPack } from "../src/core/types";
import { createGenerationService } from "../src/services/generationService";
import { createVisualAssetReport, validateCoreAssetCandidate } from "../src/services/visualAssetValidation";

async function pngDataUrl(width: number, height: number, transparent: boolean): Promise<string> {
  const buffer = transparent
    ? await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([
          {
            input: await sharp({
              create: {
                width: Math.floor(width / 2),
                height: Math.floor(height / 2),
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
              }
            })
              .png()
              .toBuffer(),
            left: Math.floor(width / 4),
            top: Math.floor(height / 4)
          }
        ])
        .png()
        .toBuffer()
    : await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .png()
        .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function candidate(slot: AssetCandidate["slot"], fileUrl: string): AssetCandidate {
  return {
    slot,
    assetKey:
      slot === "player"
        ? "player.ship"
        : slot === "hazard"
          ? "hazard.enemy"
          : slot === "collectible"
            ? "item.collectible"
            : "world.background",
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
    model: "test-model",
    generationParams: {},
    approvalStatus: "approved"
  } as AssetCandidate;
}

function assetPackFromCandidates(candidates: AssetCandidate[]): AssetPack {
  return {
    versionId: "v1",
    assets: candidates.map((asset) => ({
      ...asset,
      provider: asset.provider ?? "test",
      generationMode: "model" as const,
      copyrightStatus: "generated" as const,
      spec: asset.prompt,
      status: "generated" as const,
      generationParams: {}
    }))
  } as AssetPack;
}

describe("visual asset validation", () => {
  it("rejects opaque sprite PNGs before they can be confirmed", async () => {
    const validated = validateCoreAssetCandidate(candidate("player", await pngDataUrl(32, 32, false)));

    expect(validated.validationStatus).toBe("failed");
    expect(validated.validationErrors?.join(" ")).toContain("transparent");
  });

  it("accepts transparent sprite PNGs and records visual metadata", async () => {
    const validated = validateCoreAssetCandidate(candidate("player", await pngDataUrl(32, 32, true)));

    expect(validated.validationStatus).toBe("passed");
    expect(validated.requiresTransparency).toBe(true);
    expect(validated.alphaCoverage).toBeGreaterThan(0);
    expect(validated.subjectBounds).toMatchObject({ width: 32, height: 32 });
  });

  it("records visual asset and playability reports in generated artifacts", async () => {
    const service = createGenerationService();
    const result = await service.generatePlayableVersion({
      idea: "太空猫躲避陨石收集星星",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-visual-report",
      baseUrl: "https://wow-game.example",
      model: "mock-designer",
      confirmedAssets: {
        assets: [
          candidate("background", await pngDataUrl(160, 90, false)),
          candidate("player", await pngDataUrl(32, 32, true)),
          candidate("hazard", await pngDataUrl(32, 32, true)),
          candidate("collectible", await pngDataUrl(32, 32, true))
        ]
      }
    });

    const visualReport = await createVisualAssetReport(
      assetPackFromCandidates([
        candidate("background", await pngDataUrl(160, 90, false)),
        candidate("player", await pngDataUrl(32, 32, true)),
        candidate("hazard", await pngDataUrl(32, 32, true)),
        candidate("collectible", await pngDataUrl(32, 32, true))
      ])
    );

    expect(result.project.artifacts.some((artifact) => artifact.fileName === "visual-asset-report.json")).toBe(true);
    expect(result.project.artifacts.some((artifact) => artifact.fileName === "playability-report.json")).toBe(true);
    expect(visualReport.ready).toBe(true);
    expect(visualReport.coherenceScore).toBeGreaterThanOrEqual(visualReport.coherenceThreshold);
  });
});
