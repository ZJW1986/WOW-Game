import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const genreFiles = [
  "src/runtime/three/genres/index.ts",
  "src/runtime/three/genres/flight.ts",
  "src/runtime/three/genres/runner.ts",
  "src/runtime/three/genres/thirdPersonCollect.ts",
  "src/runtime/three/genres/exploration.ts",
  "src/runtime/three/genres/genericDodgeCollect.ts",
  "src/runtime/three/cameraRigs.ts"
];

describe("Three genre runtime modules", () => {
  it("splits non-tower-defense genre update logic out of ThreePreview", () => {
    for (const file of genreFiles) expect(existsSync(file), `${file} should exist`).toBe(true);

    const previewSource = readFileSync("src/ui/ThreePreview.tsx", "utf8");
    const dispatcherSource = readFileSync("src/runtime/three/genres/index.ts", "utf8");
    const flightSource = readFileSync("src/runtime/three/genres/flight.ts", "utf8");
    const runnerSource = readFileSync("src/runtime/three/genres/runner.ts", "utf8");

    expect(previewSource).toContain('import { createThreeGenreRuntime } from "../runtime/three/genres"');
    expect(previewSource).not.toContain("function runFlightShooterRuntime");
    expect(previewSource).not.toContain("function runRunnerRuntime");
    expect(previewSource).not.toContain("function runThirdPersonCollectRuntime");
    expect(previewSource).not.toContain("function runExplorationRuntime");
    expect(dispatcherSource).toContain("runFlightShooterRuntime");
    expect(dispatcherSource).toContain("runRunnerRuntime");
    expect(dispatcherSource).toContain("runThirdPersonCollectRuntime");
    expect(dispatcherSource).toContain("runExplorationRuntime");
    expect(flightSource).toContain("createThreeCameraRig");
    expect(runnerSource).toContain("createThreeCameraRig");
  });
});
