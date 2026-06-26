import { describe, expect, it } from "vitest";
import type { PhaserTemplate } from "../src/runtime/phaser/PhaserTemplate";
import { getOfficialTemplates } from "../src/core/templateCatalog";
import { createPhaserTemplateRegistry, getRegisteredPhaserTemplates } from "../src/runtime/phaser/registry";

describe("Phaser template registry", () => {
  it("registers and finds a template by family id", () => {
    const registry = createPhaserTemplateRegistry();
    const template = createStubTemplate("grid_logic");

    registry.registerTemplate(template);

    expect(registry.getTemplate("grid_logic")).toBe(template);
    expect(registry.listTemplates().map((item) => item.id)).toEqual(["grid_logic"]);
  });

  it("rejects duplicate template ids", () => {
    const registry = createPhaserTemplateRegistry();
    registry.registerTemplate(createStubTemplate("top_down"));

    expect(() => registry.registerTemplate(createStubTemplate("top_down"))).toThrow(/already registered/);
  });

  it("exposes adapters for the currently playable Phaser templates", () => {
    expect(getRegisteredPhaserTemplates().map((template) => template.id)).toEqual(
      expect.arrayContaining(["top_down", "platformer", "tower_defense", "grid_logic"])
    );
  });

  it("has runtime adapters for every published official Phaser template", () => {
    const registeredIds = new Set(getRegisteredPhaserTemplates().map((template) => template.id));
    const publishedOfficialTemplateFamilies = getOfficialTemplates()
      .filter((template) => template.status === "published")
      .map((template) => template.templateFamily);

    expect(publishedOfficialTemplateFamilies.every((family) => registeredIds.has(family))).toBe(true);
  });
});

function createStubTemplate(id: PhaserTemplate["id"]): PhaserTemplate {
  return {
    id,
    preload: () => undefined,
    create: () => ({ templateId: id }),
    update: () => ({ phase: "idle" }),
    teardown: () => undefined,
    validateHooks: () => ({ ok: true, errors: [] })
  };
}
