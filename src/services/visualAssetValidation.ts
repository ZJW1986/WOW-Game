import type {
  AssetCandidate,
  AssetPack,
  RuntimeAssetSlotName,
  VisualAssetReport
} from "../core/types";
import { getCompatibleAssetKeysForSlot } from "./gameAssetProfiles";
import { analyzeVisualCoherence } from "./visualCoherence";

const coreAssetKeys: Record<RuntimeAssetSlotName, string> = {
  background: "world.background",
  player: "player.ship",
  hazard: "hazard.enemy",
  collectible: "item.collectible"
};

const runtimeSizes: Record<RuntimeAssetSlotName, { width: number; height: number }> = {
  background: { width: 960, height: 540 },
  player: { width: 64, height: 64 },
  hazard: { width: 58, height: 58 },
  collectible: { width: 42, height: 42 }
};

const coherenceThreshold = 0.6;

export function validateCoreAssetCandidate(candidate: AssetCandidate): AssetCandidate {
  const slot = normalizeCoreSlot(candidate.slot);
  if (!slot) return candidate;
  const requiresTransparency = slot !== "background";
  const role = requiresTransparency ? "sprite" : "background";
  const errors: string[] = [];
  const png = readPngMetadata(candidate.fileUrl || candidate.previewUrl);

  if (requiresTransparency && png && !png.hasAlpha) {
    errors.push("Sprite assets must be transparent PNGs or include alpha channel data.");
  }
  if (requiresTransparency && looksLikeCheckerboard(candidate.prompt, candidate.style)) {
    errors.push("Sprite prompt/style must not request checkerboard or visible background.");
  }
  if (!requiresTransparency && png) {
    const ratio = png.width / Math.max(1, png.height);
    if (ratio < 1.45 || ratio > 1.9) {
      errors.push("Background assets should be close to a 16:9 gameplay scene.");
    }
  }

  const validationStatus = errors.length > 0 ? "failed" : png || isRuntimeLocalUrl(candidate.fileUrl) ? "passed" : "warning";
  return {
    ...candidate,
    assetKey: candidate.assetKey || coreAssetKeys[slot],
    slotRole: role,
    requiresTransparency,
    subjectBounds: png ? { x: 0, y: 0, width: png.width, height: png.height } : undefined,
    alphaCoverage: png?.hasAlpha ? 0.5 : 0,
    validationStatus,
    validationErrors: errors,
    error: errors.length > 0 ? errors.join(" ") : candidate.error
  };
}

export async function createVisualAssetReport(assetPack: AssetPack): Promise<VisualAssetReport> {
  const slots = (Object.keys(coreAssetKeys) as RuntimeAssetSlotName[]).map((slot) => {
    const compatibleKeys = getCompatibleAssetKeysForSlot(slot);
    const asset = assetPack.assets.find((item) => compatibleKeys.includes(item.assetKey));
    const requiresTransparency = slot !== "background";
    const size = runtimeSizes[slot];
    const errors: string[] = [];
    if (!asset) {
      errors.push(`Missing ${slot} asset ${coreAssetKeys[slot]}.`);
    } else if (asset.status === "failed" || asset.error) {
      errors.push(asset.error || `${slot} asset failed.`);
    } else if (requiresTransparency && asset.fileUrl.startsWith("data:image/png")) {
      const png = readPngMetadata(asset.fileUrl);
      if (png && !png.hasAlpha) errors.push(`${slot} sprite must have a transparent alpha channel.`);
    }
    return {
      slot,
      assetKey: asset?.assetKey ?? coreAssetKeys[slot],
      fileUrl: asset?.fileUrl ?? "",
      requiresTransparency,
      validationStatus: errors.length > 0 ? "failed" as const : "passed" as const,
      validationErrors: errors,
      runtimeWidth: size.width,
      runtimeHeight: size.height
    };
  });
  const errors = slots.flatMap((slot) => slot.validationErrors);
  const coherenceScore = await analyzeVisualCoherence(assetPack).then((report) => report.score);
  return {
    ready: errors.length === 0 && coherenceScore >= coherenceThreshold,
    coherenceScore,
    coherenceThreshold,
    slots,
    errors
  };
}

function normalizeCoreSlot(slot: AssetCandidate["slot"]): RuntimeAssetSlotName | null {
  if (slot === "background" || slot === "player" || slot === "hazard" || slot === "collectible") return slot;
  return null;
}

function isRuntimeLocalUrl(value?: string): boolean {
  return Boolean(value?.startsWith("/projects/") || value?.startsWith("blob:"));
}

function looksLikeCheckerboard(prompt = "", style = ""): boolean {
  const normalized = `${prompt} ${style}`
    .replace(/\b(no|without)\s+[^.;,\n]*(checkerboard|checkboard|grid background|white background|background)[^.;,\n]*/gi, "");
  return /checkerboard|checkboard|grid background|white background/i.test(normalized);
}

function readPngMetadata(dataUrl?: string): { width: number; height: number; hasAlpha: boolean } | null {
  if (!dataUrl?.startsWith("data:image/png;base64,")) return null;
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  const bytes = base64ToBytes(base64);
  if (bytes.length < 33) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== "IHDR") return null;
  const width = readUInt32(bytes, 16);
  const height = readUInt32(bytes, 20);
  const colorType = bytes[25];
  return {
    width,
    height,
    hasAlpha: colorType === 4 || colorType === 6
  };
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(base64, "base64"));
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
