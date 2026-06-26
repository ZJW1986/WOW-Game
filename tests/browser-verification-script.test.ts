import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("browser verification script", () => {
  it("falls back to system Edge or Chrome and starts from the create page", () => {
    const script = readFileSync("scripts/verify-browser.mjs", "utf8");

    expect(script).toContain('channel: "msedge"');
    expect(script).toContain('channel: "chrome"');
    expect(script).toContain("手机竖屏太空飞船躲避陨石收集能量");
    expect(script).toContain('getByTestId("start-engine-threejs3d")');
    expect(script).toContain('getByTestId("start-create")');
    expect(script).toContain("answerGuidedQuestions");
    expect(script).toContain('getByTestId("idea-pick-for-me")');
    expect(script).toContain('getByTestId("idea-primary-action")');
    expect(script).toContain("ensureActiveButton");
    expect(script).toContain('className.includes("active")');
    expect(script).toContain("assertPreviewAspectRatio");
    expect(script).toContain('getByTestId("viewport-web-16-9")');
    expect(script).toContain("web_16_9");
    expect(script).toContain("canvasSizeMatchesShell");
    expect(script).toContain("writePerfBaseline");
    expect(script).toContain("data/perf-baseline.json");
  });

  it("supports browser verification genre matrix arguments", () => {
    const script = readFileSync("scripts/verify-browser.mjs", "utf8");

    expect(script).toContain("readGenreArg(process.argv.slice(2))");
    expect(script).toContain('arg.startsWith("--genre=")');
    expect(script).toContain("3D flight shooter: dodge asteroids");
    expect(script).toContain("3D runner: three-lane futuristic track");
    expect(script).toContain("3D futuristic tower defense");
    expect(script).toContain("2D ninja platformer");
    expect(script).toContain("verificationProfile.keys");
    expect(script).toContain("Unsupported --genre=");
    expect(packageJson.scripts["verify:browser:matrix"]).toContain("--genre=flight");
    expect(packageJson.scripts["verify:browser:matrix"]).toContain("--genre=runner");
    expect(packageJson.scripts["verify:browser:matrix"]).toContain("--genre=td");
  });
});
