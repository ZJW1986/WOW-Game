import { describe, expect, it } from "vitest";
import {
  canPublishProjectAsTemplate,
  getOfficialTemplates,
  startDraftFromTemplate,
  type TemplateRecord
} from "../src/core/templateCatalog";
import { runMockPipeline } from "../src/core/pipeline";

describe("template catalog", () => {
  it("exposes official playable templates as product-level examples", () => {
    const templates = getOfficialTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(4);
    expect(templates.map((template) => template.source).every((source) => source === "official")).toBe(true);
    expect(templates.map((template) => template.templateFamily)).toEqual(
      expect.arrayContaining(["top_down", "platformer", "grid_logic", "tower_defense"])
    );
    expect(templates.every((template) => template.playableUrl.startsWith("/play/"))).toBe(true);
    expect(templates.every((template) => template.description.length > 0)).toBe(true);
  });

  it("creates a new draft from a selected template without mutating the template", () => {
    const template = getOfficialTemplates()[1];
    const draft = startDraftFromTemplate(template, "做一个太空猫收集鱼干的小游戏");

    expect(draft.idea).toContain("太空猫");
    expect(draft.idea).toContain(template.title);
    expect(draft.templateFamily).toBe(template.templateFamily);
    expect(template.status).toBe("published");
  });

  it("only allows verified playable projects to be published as templates", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");

    expect(canPublishProjectAsTemplate(project)).toBe(true);

    const broken = {
      ...project,
      assetPack: {
        ...project.assetPack,
        assets: project.assetPack.assets.map((asset, index) =>
          index === 0 ? { ...asset, status: "missing" as const } : asset
        )
      }
    };

    expect(canPublishProjectAsTemplate(broken)).toBe(false);
  });

  it("keeps user and community template records separate from official templates", () => {
    const userTemplate: TemplateRecord = {
      templateId: "user-template-1",
      title: "我的飞船模板",
      source: "user_project",
      templateFamily: "top_down",
      previewProjectId: "project-1",
      coverAssetKey: "cover.main",
      description: "从我的项目发布的本地模板",
      playableUrl: "/play/project-1/v1",
      tags: ["我的模板"],
      status: "verified"
    };

    expect(getOfficialTemplates().some((template) => template.templateId === userTemplate.templateId)).toBe(false);
  });
});
