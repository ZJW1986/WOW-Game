import type { AssetPack } from "../core/types";

export interface PreviewRuntimeAssets {
  player?: string;
  collectible?: string;
  hazard?: string;
  background?: string;
  tile?: string;
}

export function selectPreviewRuntimeAssets(assetPack?: AssetPack): PreviewRuntimeAssets {
  if (!assetPack) return {};
  const imageAssets = assetPack.assets.filter(
    (asset) =>
      (asset.type === "image" || asset.type === "ui") &&
      asset.fileUrl.startsWith("data:image") &&
      asset.status !== "missing" &&
      asset.status !== "failed"
  );
  return {
    player: findAssetUrl(imageAssets, ["player.ship", "player.hero", "player.cursor", "player.tower", "player.panel"]),
    collectible: findAssetUrl(imageAssets, ["item.collectible"]),
    hazard: findAssetUrl(imageAssets, ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer"]),
    background: findAssetUrl(imageAssets, ["world.background", "cover.main"]),
    tile: findAssetUrl(imageAssets, ["world.tiles", "world.path"])
  };
}

function findAssetUrl(assets: AssetPack["assets"], keys: string[]): string | undefined {
  return keys
    .map((assetKey) => assets.find((asset) => asset.assetKey === assetKey)?.fileUrl)
    .find((fileUrl): fileUrl is string => Boolean(fileUrl));
}
