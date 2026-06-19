import { describe, expect, it } from "vitest";
import { createDemoServerConfig } from "../src/services/demoServerConfig";
import { isWowGameApiPath } from "../src/services/apiRoutes";

describe("vite demo host configuration", () => {
  it("allows public tunnel hosts for external demos", () => {
    expect(createDemoServerConfig().allowedHosts).toBe(true);
  });

  it("routes all creative-chain api endpoints through the local middleware", () => {
    expect(isWowGameApiPath("/design-brief")).toBe(true);
    expect(isWowGameApiPath("/asset-candidates")).toBe(true);
    expect(isWowGameApiPath("/revision-analysis")).toBe(true);
    expect(isWowGameApiPath("/guided-questions")).toBe(true);
    expect(isWowGameApiPath("/generate-playable")).toBe(true);
  });
});
