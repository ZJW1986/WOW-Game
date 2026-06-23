import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("three preview layout", () => {
  it("keeps renderer, camera, and DOM aspect ratios synchronized", () => {
    const source = readFileSync("src/ui/ThreePreview.tsx", "utf8");
    const baseStyles = readFileSync("src/ui/styles.css", "utf8");
    const layoutStyles = readFileSync("src/ui/preview-layout.css", "utf8");

    expect(source).toContain("ResizeObserver");
    expect(source).toContain("camera.aspect = nextWidth / nextHeight");
    expect(source).toContain("camera.updateProjectionMatrix()");
    expect(source).toContain("renderer.setSize(nextWidth, nextHeight, false)");
    expect(source).toContain("GLTFLoader");
    expect(source).toContain("three-preview-asset-error");
    expect(source).toContain("runFlightShooterRuntime");
    expect(source).toContain("runRunnerRuntime");
    expect(source).toContain("runThirdPersonCollectRuntime");
    expect(source).toContain("runExplorationRuntime");
    expect(source).toContain("createThreeGenreRuntime");
    expect(source).not.toContain('horizontalInputSign = director.movementMode === "auto_runner" ? -1 : 1');
    expect(source).toContain("delta * 0.015 * arcadeRuntime.pointerXSign");
    expect(source).toContain("createThreeAudioRuntime");
    expect(source).toContain("spawnParticleBurst");
    expect(source).toContain("shakeUntilMs");
    expect(source).toContain("hitCooldownMs");
    expect(source).toContain("flashUntilMs");
    expect(source).toContain("runTowerDefenseRuntime");
    expect(source).toContain('director.movementMode === "tower_defense"');
    expect(source).toContain("createTowerDefenseTower");
    expect(source).toContain("createTowerDefenseEnemy");
    expect(source).toContain("towerDefense");
    expect(source).toContain("selectedBuildPadIndex");
    expect(source).toContain("selectBuildPad");
    expect(source).toContain("buildSelectedTower");
    expect(source).toContain("塔防：WASD/方向键选择建造点");
    expect(source).toContain("}, [assetLoadReport, assetPack, director, viewportMode]);");

    expect(baseStyles).toContain(".three-preview-shell.web_16_9");
    expect(baseStyles).toContain("aspect-ratio: 16 / 9");
    expect(baseStyles).toContain(".three-preview-shell.app_9_16");
    expect(baseStyles).toContain("aspect-ratio: 9 / 16");
    expect(layoutStyles).not.toContain("max-height: min(44vh, 405px)");
    expect(layoutStyles).not.toContain("max-height: min(50vh, 440px)");
  });
});
