import type { AssetPack, RuntimeAssetReport, RuntimeAssetSlotName, RuntimeAssetSlotReport } from "../core/types";
import { getCompatibleAssetKeysForSlot } from "../services/gameAssetProfiles";

export interface PreviewRuntimeAssets {
  player?: string;
  collectible?: string;
  hazard?: string;
  background?: string;
  tile?: string;
  bgm?: string;
  sfx: {
    collect?: string;
    hit?: string;
    win?: string;
    lose?: string;
  };
}

const coreSlotKeys: Record<RuntimeAssetSlotName, string> = {
  background: "world.background",
  player: "player.ship",
  hazard: "hazard.enemy",
  collectible: "item.collectible"
};

const runtimeSlotSizes: Record<RuntimeAssetSlotName, { width: number; height: number; slotRole: "background" | "sprite" }> = {
  background: { width: 960, height: 540, slotRole: "background" },
  player: { width: 64, height: 64, slotRole: "sprite" },
  hazard: { width: 58, height: 58, slotRole: "sprite" },
  collectible: { width: 42, height: 42, slotRole: "sprite" }
};

export function selectPreviewRuntimeAssets(assetPack?: AssetPack): PreviewRuntimeAssets {
  if (!assetPack) return { sfx: {} };
  const imageAssets = assetPack.assets.filter(
    (asset) =>
      (asset.type === "image" || asset.type === "ui") &&
      isPreviewImageUrl(asset.fileUrl) &&
      asset.status !== "missing" &&
      asset.status !== "failed"
  );
  const audioAssets = assetPack.assets.filter(
    (asset) =>
      (asset.type === "sfx" || asset.type === "bgm") &&
      isPreviewAudioUrl(asset.fileUrl) &&
      asset.status !== "missing" &&
      asset.status !== "failed"
  );
  return {
    player: findAssetUrl(imageAssets, getCompatibleAssetKeysForSlot("player")),
    collectible: findAssetUrl(imageAssets, getCompatibleAssetKeysForSlot("collectible")),
    hazard: findAssetUrl(imageAssets, getCompatibleAssetKeysForSlot("hazard")),
    background: findAssetUrl(imageAssets, getCompatibleAssetKeysForSlot("background")),
    tile: findAssetUrl(imageAssets, ["world.tiles", "world.path"]),
    bgm: findAssetUrl(audioAssets, ["bgm.loop"]),
    sfx: {
      collect: findAssetUrl(audioAssets, ["sfx.collect"]),
      hit: findAssetUrl(audioAssets, ["sfx.hit"]),
      win: findAssetUrl(audioAssets, ["sfx.win"]),
      lose: findAssetUrl(audioAssets, ["sfx.lose"])
    }
  };
}

export function createRuntimeAssetReport(assetPack?: AssetPack): RuntimeAssetReport {
  const slots = (Object.keys(coreSlotKeys) as RuntimeAssetSlotName[]).map((slot) => {
    const compatibleKeys = getCompatibleAssetKeysForSlot(slot);
    const asset = assetPack?.assets.find((item) => compatibleKeys.includes(item.assetKey));
    const assetKey = asset?.assetKey ?? coreSlotKeys[slot];
    const size = runtimeSlotSizes[slot];
    const fileUrl = asset?.fileUrl ?? "";
    const validUrl = Boolean(fileUrl) && isRuntimeImageUrl(fileUrl);
    const failed = asset?.status === "failed" || asset?.status === "missing";
    const validType = asset ? asset.type === "image" || asset.type === "ui" : false;
    const status: RuntimeAssetSlotReport["status"] = !asset
      ? "missing"
      : failed
        ? "failed"
        : validUrl && validType
          ? "bound"
          : "invalid_url";
    return {
      slot,
      assetKey,
      provider: asset?.provider ?? "",
      source: asset?.source ?? "mock",
      fileUrl,
      slotRole: size.slotRole,
      runtimeWidth: size.width,
      runtimeHeight: size.height,
      status,
      error:
        asset?.error ||
        (!validType && asset
          ? `Runtime ${slot} asset must be image/ui, got ${asset.type}.`
          : status === "invalid_url"
            ? "Runtime image URL must be localized before Phaser preview."
            : undefined)
    };
  });
  const errors = slots
    .filter((slot) => slot.status !== "bound")
    .map((slot) => `${slot.slot}:${slot.assetKey}:${slot.error ?? slot.status}`);
  return {
    ready: errors.length === 0,
    slots,
    errors
  };
}

function isPreviewImageUrl(fileUrl: string): boolean {
  return (
    fileUrl.startsWith("data:image") ||
    fileUrl.startsWith("/projects/") ||
    fileUrl.startsWith("blob:") ||
    /^https?:\/\//.test(fileUrl)
  );
}

function isRuntimeImageUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("data:image") || fileUrl.startsWith("/projects/") || fileUrl.startsWith("blob:");
}

function isPreviewAudioUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("data:audio") || fileUrl.startsWith("blob:") || /^https?:\/\//.test(fileUrl);
}

function findAssetUrl(assets: AssetPack["assets"], keys: string[]): string | undefined {
  return keys
    .map((assetKey) => assets.find((asset) => asset.assetKey === assetKey)?.fileUrl)
    .find((fileUrl): fileUrl is string => Boolean(fileUrl));
}
