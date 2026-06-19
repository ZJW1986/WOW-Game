import type { AssetPack } from "../core/types";

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
    player: findAssetUrl(imageAssets, ["player.ship", "player.hero", "player.cursor", "player.tower", "player.panel"]),
    collectible: findAssetUrl(imageAssets, ["item.collectible"]),
    hazard: findAssetUrl(imageAssets, ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer"]),
    background: findAssetUrl(imageAssets, ["world.background", "cover.main"]),
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

function isPreviewImageUrl(fileUrl: string): boolean {
  return (
    fileUrl.startsWith("data:image") ||
    fileUrl.startsWith("/projects/") ||
    fileUrl.startsWith("blob:") ||
    /^https?:\/\//.test(fileUrl)
  );
}

function isPreviewAudioUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("data:audio") || fileUrl.startsWith("blob:") || /^https?:\/\//.test(fileUrl);
}

function findAssetUrl(assets: AssetPack["assets"], keys: string[]): string | undefined {
  return keys
    .map((assetKey) => assets.find((asset) => asset.assetKey === assetKey)?.fileUrl)
    .find((fileUrl): fileUrl is string => Boolean(fileUrl));
}
