import { describe, expect, it } from "vitest";
import { createDemoServerConfig } from "../src/services/demoServerConfig";

describe("vite demo host configuration", () => {
  it("allows public tunnel hosts for external demos", () => {
    expect(createDemoServerConfig().allowedHosts).toBe(true);
  });
});
