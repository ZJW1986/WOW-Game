import sharp from "sharp";
import type { AssetPack } from "../core/types";
import { getCompatibleAssetKeysForSlot } from "./gameAssetProfiles";

export interface VisualCoherenceReport {
  score: number;
  pairwiseScores: Array<{
    leftAssetKey: string;
    rightAssetKey: string;
    score: number;
  }>;
}

export async function analyzeVisualCoherence(assetPack: AssetPack): Promise<VisualCoherenceReport> {
  const slots = ["background", "player", "hazard", "collectible"] as const;
  const assets = slots
    .map((slot) => {
      const compatibleKeys = getCompatibleAssetKeysForSlot(slot);
      return assetPack.assets.find((asset) => compatibleKeys.includes(asset.assetKey) && isReadableImage(asset.fileUrl));
    })
    .filter((asset): asset is AssetPack["assets"][number] => Boolean(asset));
  const vectors = (
    await Promise.all(
      assets.map(async (asset) => {
        try {
          return { assetKey: asset.assetKey, vector: await averageRgb(asset.fileUrl) };
        } catch {
          return null;
        }
      })
    )
  ).filter((item): item is { assetKey: string; vector: [number, number, number] } => Boolean(item));
  const pairwiseScores: VisualCoherenceReport["pairwiseScores"] = [];
  let total = 0;
  let count = 0;

  for (let left = 0; left < vectors.length; left += 1) {
    for (let right = left + 1; right < vectors.length; right += 1) {
      const score = similarityScore(vectors[left].vector, vectors[right].vector);
      pairwiseScores.push({
        leftAssetKey: vectors[left].assetKey,
        rightAssetKey: vectors[right].assetKey,
        score
      });
      total += score;
      count += 1;
    }
  }

  return {
    score: count > 0 ? total / count : 0,
    pairwiseScores
  };
}

function isReadableImage(fileUrl: string): boolean {
  return fileUrl.startsWith("data:image");
}

async function averageRgb(fileUrl: string): Promise<[number, number, number]> {
  const input = decodeImageDataUrl(fileUrl);
  if (input.length === 0) return [0, 0, 0];
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize(16, 16, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3] ?? 255;
    if (alpha <= 8) continue;
    red += data[offset];
    green += data[offset + 1];
    blue += data[offset + 2];
    samples += 1;
  }
  if (samples === 0) return [0, 0, 0];
  return [red / samples, green / samples, blue / samples];
}

function decodeImageDataUrl(fileUrl: string): Buffer {
  const match = fileUrl.match(/^data:image\/([^;,]+)(;charset=[^;,]+)?(?:;base64)?,(.*)$/);
  if (!match) return Buffer.alloc(0);
  const mime = match[1];
  const isBase64 = fileUrl.includes(";base64,");
  const payload = match[3] ?? "";
  if (mime === "svg+xml" && !isBase64) {
    return Buffer.from(decodeURIComponent(payload), "utf8");
  }
  if (!isBase64) return Buffer.from(decodeURIComponent(payload), "utf8");
  return Buffer.from(payload, "base64");
}

function similarityScore(left: [number, number, number], right: [number, number, number]): number {
  const distance = Math.sqrt(
    (left[0] - right[0]) ** 2 +
    (left[1] - right[1]) ** 2 +
    (left[2] - right[2]) ** 2
  );
  return Math.max(0, 1 - distance / 255);
}
