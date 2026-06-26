import { describe, expect, it } from "vitest";
import { createCoreSchemaSnapshot } from "../src/core/schemas";

describe("core schema snapshots", () => {
  it("tracks contract changes for generated game artifacts", () => {
    expect(createCoreSchemaSnapshot()).toMatchSnapshot();
  });
});
