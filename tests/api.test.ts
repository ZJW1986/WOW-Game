import { describe, expect, it } from "vitest";
import { createApiRouter } from "../src/services/api";
import { createInMemoryBackend } from "../src/services/backend";

describe("api router boundary", () => {
  it("creates projects, sessions, publish records and feedback through api paths", async () => {
    const api = createApiRouter(createInMemoryBackend());

    const projectResponse = await api.handle("POST", "/api/projects", {
      idea: "做一个飞船躲避陨石的小游戏"
    });
    expect(projectResponse.status).toBe(201);
    expect(projectResponse.body.project.idea).toContain("飞船");

    const sessionResponse = await api.handle("POST", "/api/sessions", {
      idea: "做一个飞船躲避陨石的小游戏"
    });
    expect(sessionResponse.body.session.questions).toHaveLength(4);

    const versionResponse = await api.handle("POST", "/api/projects/project-1/versions", {});
    expect(versionResponse.body.version.artifactFiles).toContain("gdd.json");

    const publishResponse = await api.handle("POST", "/api/publish", {
      versionId: "v1",
      visibility: "public",
      baseUrl: "https://wow-game.example"
    });
    expect(publishResponse.body.publishRecord.publicUrl).toBe(
      "https://wow-game.example/play/project-1/v1"
    );

    const feedbackResponse = await api.handle("POST", "/api/feedback", {
      versionId: "v1",
      rating: 5,
      comment: "分享体验很顺畅",
      playerName: "player-a"
    });
    expect(feedbackResponse.body.feedback.iterationSuggestion).toContain("下一版");
  });
});
