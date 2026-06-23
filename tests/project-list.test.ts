import { describe, expect, it } from "vitest";
import { createPublishRecord, runMockPipeline } from "../src/core/pipeline";
import { upsertGeneratedProjectRecord, type ProjectRecord } from "../src/ui/App";

describe("generated project list records", () => {
  it("adds generated playable projects to My Projects with the generated title", () => {
    const project = runMockPipeline("太空猫躲避陨石收集鱼干");
    const publishRecord = createPublishRecord(project.id, project.version.id, "太空猫鱼干航线");
    project.coverPosterUrl = "/projects/project-cover/v1/assets/cover-poster.webp";
    project.coverThumbnailUrl = "/projects/project-cover/v1/assets/cover-poster-thumb.webp";
    const records = upsertGeneratedProjectRecord([], project, publishRecord);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: project.id,
      title: project.title,
      idea: project.gameConfig.pitch,
      contentType: "ai_project",
      status: "published",
      visibility: "public",
      templateFamily: project.classification.templateFamily,
      coverPosterUrl: "/projects/project-cover/v1/assets/cover-poster.webp",
      coverThumbnailUrl: "/projects/project-cover/v1/assets/cover-poster-thumb.webp",
      project
    });
  });

  it("updates the existing generated project instead of adding duplicates", () => {
    const oldProject = runMockPipeline("旧飞船游戏");
    const newProject = {
      ...runMockPipeline("太空猫躲避陨石收集鱼干"),
      id: oldProject.id
    };
    const existing: ProjectRecord = {
      id: oldProject.id,
      title: "旧标题",
      idea: "旧飞船游戏",
      contentType: "ai_project",
      editable: true,
      shareable: true,
      sourceLabel: "AI Generated",
      status: "draft",
      visibility: "private",
      updatedAt: "2026-06-17",
      plays: 12,
      likes: 3,
      templateFamily: oldProject.classification.templateFamily,
      engineType: "phaser2d",
      project: oldProject
    };

    const records = upsertGeneratedProjectRecord(
      [existing],
      newProject,
      createPublishRecord(newProject.id, newProject.version.id, newProject.title)
    );

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(oldProject.id);
    expect(records[0].title).toBe(newProject.title);
    expect(records[0].project).toBe(newProject);
    expect(records[0].status).toBe("published");
    expect(records[0].visibility).toBe("public");
  });
});
