import { describe, expect, it } from "vitest";
import { createPlayableStore } from "../src/services/playableStore";
import { createPublishRecord, runMockPipeline } from "../src/core/pipeline";

describe("uploaded package constraints", () => {
  it("keeps uploaded packages read-only after persistence", async () => {
    const writes = new Map<string, string>();
    const store = createPlayableStore({
      dataDir: "data-test",
      writeText: async (path, content) => {
        writes.set(path, content);
      },
      readText: async (path) => writes.get(path) ?? null,
      ensureDir: async () => undefined
    });

    const project = runMockPipeline("上传一个小游戏用于商城展示");
    project.id = "uploaded-constraints-1";
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
  });
});
