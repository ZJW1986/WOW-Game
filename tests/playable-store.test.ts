import { describe, expect, it } from "vitest";
import { runMockPipeline, createPublishRecord } from "../src/core/pipeline";
import { createPlayableStore } from "../src/services/playableStore";

describe("playable json store", () => {
  it("saves and reads a playable project version", async () => {
    const writes = new Map<string, string>();
    const store = createPlayableStore({
      dataDir: "data-test",
      writeText: async (path, content) => {
        writes.set(path, content);
      },
      readText: async (path) => writes.get(path) ?? null,
      ensureDir: async () => undefined
    });
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    project.id = "project-store-1";
    const publishRecord = createPublishRecord(project.id, project.version.id, project.title, {
      baseUrl: "https://wow-game.example",
      visibility: "public"
    });

    await store.savePlayable({ project, publishRecord, feedback: [] });
    const loaded = await store.readPlayable(project.id, project.version.id);

    expect(loaded?.project.contentType).toBe("ai_project");
    expect(loaded?.project.editable).toBe(true);
    expect(loaded?.project.shareable).toBe(true);
    expect(loaded?.project.gameConfig.title).toBe(project.gameConfig.title);
    expect(loaded?.publishRecord.publicUrl).toBe("https://wow-game.example/play/project-store-1/v1");
    expect([...writes.keys()][0].replace(/\\/g, "/")).toContain(
      "data-test/projects/project-store-1/versions/v1/project.json"
    );
  });

  it("returns null when a playable version does not exist", async () => {
    const store = createPlayableStore({
      dataDir: "data-test",
      writeText: async () => undefined,
      readText: async () => null,
      ensureDir: async () => undefined
    });

    await expect(store.readPlayable("missing", "v1")).resolves.toBeNull();
  });

  it("appends feedback and keeps old feedback entries", async () => {
    const writes = new Map<string, string>();
    const store = createPlayableStore({
      dataDir: "data-test",
      writeText: async (path, content) => {
        writes.set(path, content);
      },
      readText: async (path) => writes.get(path) ?? null,
      ensureDir: async () => undefined
    });
    const project = runMockPipeline("做一个横版跳跃收集金币的森林游戏");
    project.id = "project-feedback-1";
    const publishRecord = createPublishRecord(project.id, project.version.id, project.title, {
      baseUrl: "https://wow-game.example"
    });
    await store.savePlayable({ project, publishRecord, feedback: [] });

    const feedback = await store.addFeedback(project.id, project.version.id, {
      versionId: project.version.id,
      rating: 5,
      comment: "可以分享给朋友试玩",
      playerName: "tester"
    });
    const loaded = await store.readPlayable(project.id, project.version.id);

    expect(feedback.iterationSuggestion).toContain("下一版");
    expect(loaded?.feedback).toHaveLength(1);
    expect(loaded?.feedback[0].comment).toBe("可以分享给朋友试玩");
  });

  it("stores uploaded packages as read-only playable records", async () => {
    const writes = new Map<string, string>();
    const store = createPlayableStore({
      dataDir: "data-test",
      writeText: async (path, content) => {
        writes.set(path, content);
      },
      readText: async (path) => writes.get(path) ?? null,
      ensureDir: async () => undefined
    });
    const project = runMockPipeline("上传一个现成的小游戏用于商城试玩");
    project.id = "package-store-1";
    project.contentType = "uploaded_package";
    project.editable = false;
    project.shareable = true;
    project.sourceLabel = "ZIP Package";
    const publishRecord = createPublishRecord(project.id, project.version.id, project.title, {
      baseUrl: "https://wow-game.example",
      visibility: "public"
    });

    await store.savePlayable({ project, publishRecord, feedback: [] });
    const loaded = await store.readPlayable(project.id, project.version.id);

    expect(loaded?.project.contentType).toBe("uploaded_package");
    expect(loaded?.project.editable).toBe(false);
    expect(loaded?.project.shareable).toBe(true);
    expect(loaded?.project.sourceLabel).toBe("ZIP Package");
  });
});

