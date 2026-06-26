import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createDemoServerConfig } from "../src/services/demoServerConfig";
import { isWowGameApiPath } from "../src/services/apiRoutes";
import { createManualChunks } from "../src/services/buildChunks";

describe("vite demo host configuration", () => {
  it("allows public tunnel hosts for external demos", () => {
    expect(createDemoServerConfig().allowedHosts).toBe(true);
  });

  it("routes all creative-chain api endpoints through the local middleware", () => {
    expect(isWowGameApiPath("/design-brief")).toBe(true);
    expect(isWowGameApiPath("/asset-candidates")).toBe(true);
    expect(isWowGameApiPath("/generate-production-brief")).toBe(true);
    expect(isWowGameApiPath("/generate-game-dev-prompt-bundle")).toBe(true);
    expect(isWowGameApiPath("/generate-ui-asset-kit")).toBe(true);
    expect(isWowGameApiPath("/generate-audio-prompt-pack")).toBe(true);
    expect(isWowGameApiPath("/generate-model-prompt-pack")).toBe(true);
    expect(isWowGameApiPath("/cellcog/generate-asset")).toBe(true);
    expect(isWowGameApiPath("/replace-asset-candidate")).toBe(true);
    expect(isWowGameApiPath("/regenerate-asset-candidate")).toBe(true);
    expect(isWowGameApiPath("/regenerate-three-asset-candidate")).toBe(true);
    expect(isWowGameApiPath("/revision-analysis")).toBe(true);
    expect(isWowGameApiPath("/guided-questions")).toBe(true);
    expect(isWowGameApiPath("/generate-playable")).toBe(true);
  });

  it("splits large game engines into separate build chunks", () => {
    expect(createManualChunks("D:/repo/node_modules/phaser/dist/phaser.js")).toBe("phaser");
    expect(createManualChunks("D:/repo/node_modules/three/build/three.module.js")).toBe("three");
    expect(createManualChunks("D:/repo/node_modules/react/index.js")).toBe("react-vendor");
    expect(createManualChunks("D:/repo/src/ui/App.tsx")).toBeUndefined();
  });

  it("uses a custom logger so noisy dev logs can be throttled", () => {
    const source = readFileSync("vite.config.ts", "utf8");

    expect(source).toContain("customLogger: createThrottledViteLogger()");
    expect(source).toContain("server restarted");
    expect(source).toContain("hmr update");
  });
});
