import { describe, expect, it } from "vitest";
import { createInMemoryBackend } from "../src/services/backend";

describe("MVP backend service boundary", () => {
  it("creates a project version through project, pipeline, asset, verification and publish services", () => {
    const backend = createInMemoryBackend();

    const project = backend.projects.createProject("做一个太空船躲避陨石并收集星星的小游戏");
    const version = backend.pipeline.generateVersion(project.id);
    const assets = backend.assets.listAssets(version.id);
    const report = backend.verification.verifyVersion(version.id);
    const publishRecord = backend.play.publish(version.id);

    expect(project.idea).toContain("太空船");
    expect(version.artifactFiles).toContain("game-config.json");
    expect(assets.some((asset) => asset.assetKey === "bgm.loop")).toBe(true);
    expect(report.scores.buildHealth).toBeGreaterThanOrEqual(80);
    expect(publishRecord.playUrl).toBe(`/play/${project.id}/${version.id}`);
  });

  it("routes model tasks to the mock provider by default", async () => {
    const backend = createInMemoryBackend();

    const task = await backend.models.runTask({
      taskType: "llm.gdd",
      prompt: "生成一个跳跃游戏 GDD",
      provider: "mock",
      model: "mock-game-designer"
    });

    expect(task.provider).toBe("mock");
    expect(task.output.summary).toContain("standard artifact");
  });

  it("routes DeepSeek tasks to v4 flash and reports missing api key clearly", async () => {
    const backend = createInMemoryBackend();

    const task = await backend.models.runTask({
      taskType: "llm.gdd",
      prompt: "生成一个躲避陨石游戏 GDD",
      provider: "deepseek",
      model: "deepseek-v4-flash"
    });

    expect(task.provider).toBe("deepseek");
    expect(task.model).toBe("deepseek-v4-flash");
    expect(task.output.summary).toContain("DEEPSEEK_API_KEY");
  });

  it("builds an OpenAI-compatible DeepSeek chat request", () => {
    const backend = createInMemoryBackend({
      deepseekApiKey: "test-key"
    });

    const request = backend.models.createDeepSeekChatRequest({
      taskType: "llm.classification",
      prompt: "帮我判断这个游戏属于什么模板",
      provider: "deepseek",
      model: "deepseek-v4-flash"
    });

    expect(request.url).toBe("https://api.deepseek.com/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-key");
    expect(request.body.model).toBe("deepseek-v4-flash");
    expect(request.body.messages[0].role).toBe("system");
    expect(request.body.messages[1].content).toContain("帮我判断");
  });
});
