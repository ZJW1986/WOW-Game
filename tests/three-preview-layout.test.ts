import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("three preview layout", () => {
  it("keeps renderer, camera, and DOM aspect ratios synchronized", () => {
    const source = readFileSync("src/ui/ThreePreview.tsx", "utf8");
    const baseStyles = readFileSync("src/ui/styles.css", "utf8");
    const layoutStyles = readFileSync("src/ui/preview-layout.css", "utf8");

    expect(source).toContain("ResizeObserver");
    expect(source).toContain("camera.aspect = width / height");
    expect(source).toContain("camera.updateProjectionMatrix()");
    expect(source).toContain("renderer.setSize(width, height, false)");
    expect(source).toContain("}, [director, viewportMode]);");

    expect(baseStyles).toContain(".three-preview-shell.web_16_9");
    expect(baseStyles).toContain("aspect-ratio: 16 / 9");
    expect(baseStyles).toContain(".three-preview-shell.app_9_16");
    expect(baseStyles).toContain("aspect-ratio: 9 / 16");
    expect(layoutStyles).not.toContain("max-height: min(44vh, 405px)");
    expect(layoutStyles).not.toContain("max-height: min(50vh, 440px)");
  });
});
