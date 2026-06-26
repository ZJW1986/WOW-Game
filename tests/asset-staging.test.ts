import { describe, expect, it } from "vitest";
import {
  buildConfirmedCoreAssets,
  hasConfirmedCoreAssets,
  readNextRequestedAssetSlots,
  shouldUseStagedAssetGeneration
} from "../src/ui/App";
import type { AssetCandidates } from "../src/core/types";

function candidate(slot: "background" | "player" | "hazard" | "collectible", assetKey: string) {
  return {
    slot,
    assetKey,
    type: "image" as const,
    label: slot,
    prompt: `${slot} prompt`,
    style: "test",
    purpose: slot,
    acceptedFileTypes: ["image/*"],
    previewUrl: `data:image/png;base64,${slot}`,
    fileUrl: `data:image/png;base64,${slot}`,
    source: "generated" as const,
    validationStatus: "passed" as const
  };
}

describe("staged asset generation", () => {
  it("starts every 2D template with background only", () => {
    expect(shouldUseStagedAssetGeneration("tower_defense")).toBe(true);
    expect(readNextRequestedAssetSlots("tower_defense")).toEqual(["background"]);
    expect(readNextRequestedAssetSlots("top_down")).toEqual(["background"]);
    expect(readNextRequestedAssetSlots("platformer")).toEqual(["background"]);
    expect(readNextRequestedAssetSlots("grid_logic")).toEqual(["background"]);
    expect(readNextRequestedAssetSlots("ui_heavy")).toEqual(["background"]);
  });

  it("requests remaining tower defense slots only after the background is confirmed", () => {
    const backgroundOnly: AssetCandidates = {
      candidates: [candidate("background", "world.path")]
    };
    const confirmedBackground = buildConfirmedCoreAssets(backgroundOnly, [], "tower_defense");

    expect(hasConfirmedCoreAssets(confirmedBackground)).toBe(false);
    expect(readNextRequestedAssetSlots("tower_defense", backgroundOnly, confirmedBackground)).toEqual([
      "player"
    ]);

    const withTower: AssetCandidates = {
      candidates: [
        candidate("background", "world.path"),
        candidate("player", "player.tower")
      ]
    };
    const confirmedTower = buildConfirmedCoreAssets(withTower, [], "tower_defense");
    expect(readNextRequestedAssetSlots("tower_defense", withTower, confirmedTower)).toEqual(["hazard"]);

    const withHazard: AssetCandidates = {
      candidates: [
        candidate("background", "world.path"),
        candidate("player", "player.tower"),
        candidate("hazard", "hazard.enemy")
      ]
    };
    const confirmedHazard = buildConfirmedCoreAssets(withHazard, [], "tower_defense");
    expect(readNextRequestedAssetSlots("tower_defense", withHazard, confirmedHazard)).toEqual(["collectible"]);
  });

  it("continues simple templates with player then hazard and collectible", () => {
    expect(shouldUseStagedAssetGeneration("top_down")).toBe(true);
    const backgroundOnly: AssetCandidates = {
      candidates: [candidate("background", "world.background")]
    };
    const confirmedBackground = buildConfirmedCoreAssets(backgroundOnly, [], "top_down");
    expect(readNextRequestedAssetSlots("top_down", backgroundOnly, confirmedBackground)).toEqual(["player"]);
  });
});
