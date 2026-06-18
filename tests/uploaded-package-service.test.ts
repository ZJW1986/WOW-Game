import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseUploadedPackage } from "../src/services/uploadedPackageService";

function zipBase64(files: Record<string, string>): string {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)]))
  );
  return Buffer.from(zipped).toString("base64");
}

describe("uploaded package parser", () => {
  it("builds standard package artifacts for a playable HTML5 zip", async () => {
    const result = await parseUploadedPackage({
      packageName: "Neon Drift",
      packageFileName: "neon-drift.zip",
      packageBase64: zipBase64({
        "index.html": '<html><head><script src="main.js"></script><link href="style.css" rel="stylesheet"></head><body><img src="assets/player.png"><audio src="audio/bgm.mp3"></audio></body></html>',
        "main.js": "console.log('game')",
        "style.css": "body { margin: 0 }",
        "assets/player.png": "png",
        "audio/bgm.mp3": "mp3",
        "data/level.json": "{}"
      }),
      projectId: "package-test-1",
      versionId: "v1"
    });

    expect(result.packageManifest.entry).toBe("index.html");
    expect(result.packageManifest.fileCount).toBe(6);
    expect(result.packageManifest.playable).toBe(true);
    expect(result.assetIndex.images.map((asset) => asset.path)).toContain("assets/player.png");
    expect(result.assetIndex.audio.map((asset) => asset.path)).toContain("audio/bgm.mp3");
    expect(result.assetIndex.scripts.map((asset) => asset.path)).toContain("main.js");
    expect(result.assetIndex.data.map((asset) => asset.path)).toContain("data/level.json");
    expect(result.runtimeEntry.scripts).toEqual(["main.js"]);
    expect(result.runtimeEntry.entryUrl).toBe("/uploads/package-test-1/v1/files/index.html");
    expect(result.healthReport.status).toBe("pass");
    expect(result.aiEditPlan.editableAssets.map((asset) => asset.path)).toContain("assets/player.png");
  });

  it("accepts HTML5 zips wrapped in one top-level folder", async () => {
    const result = await parseUploadedPackage({
      packageName: "Wrapped Plane",
      packageFileName: "wrapped-plane.zip",
      packageBase64: zipBase64({
        "wrapped-plane/index.html": '<html><head><script src="js/main.js"></script></head><body><img src="image/player.png"></body></html>',
        "wrapped-plane/js/main.js": "console.log('game')",
        "wrapped-plane/image/player.png": "png"
      }),
      projectId: "package-wrapped",
      versionId: "v1"
    });

    expect(result.packageManifest.entry).toBe("index.html");
    expect(result.packageManifest.fileCount).toBe(3);
    expect(result.assetIndex.images.map((asset) => asset.path)).toContain("image/player.png");
    expect(result.runtimeEntry.scripts).toEqual(["js/main.js"]);
    expect(result.runtimeEntry.entryUrl).toBe("/uploads/package-wrapped/v1/files/index.html");
    expect(result.extractedFiles.map((file) => file.path)).toContain("index.html");
  });

  it("rejects packages without index.html", async () => {
    await expect(
      parseUploadedPackage({
        packageName: "Broken",
        packageFileName: "broken.zip",
        packageBase64: zipBase64({ "game.html": "<html></html>" }),
        projectId: "package-broken",
        versionId: "v1"
      })
    ).rejects.toThrow("index.html");
  });

  it("rejects zip entries with dangerous paths", async () => {
    await expect(
      parseUploadedPackage({
        packageName: "Danger",
        packageFileName: "danger.zip",
        packageBase64: zipBase64({ "index.html": "<html></html>", "../escape.js": "bad" }),
        projectId: "package-danger",
        versionId: "v1"
      })
    ).rejects.toThrow("Unsafe package path");
  });
});
