import { describe, expect, it } from "vitest";
import { requestPlayableGeneration } from "../src/services/generationClient";

describe("browser generation client", () => {
  it("posts generation input without exposing the DeepSeek api key", async () => {
    let requestBody = "";
    const result = await requestPlayableGeneration(
      {
        idea: "做一个飞船躲避陨石的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-client-1",
        baseUrl: "http://localhost:5173",
        model: "deepseek-v4-flash"
      },
      async (_url, init) => {
        requestBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    );

    expect(result).toEqual({ ok: true });
    expect(requestBody).toContain("deepseek-v4-flash");
    expect(requestBody).not.toContain("DEEPSEEK_API_KEY");
    expect(requestBody).not.toContain("server-key");
  });

  it("throws a readable error when generation endpoint fails", async () => {
    await expect(
      requestPlayableGeneration(
        {
          idea: "做一个飞船躲避陨石的小游戏",
          answers: [],
          templateFamily: "top_down",
          projectId: "project-client-2",
          baseUrl: "http://localhost:5173",
          model: "deepseek-v4-flash"
        },
        async () => new Response(JSON.stringify({ error: "missing idea" }), { status: 400 })
      )
    ).rejects.toThrow("Generation request failed: missing idea");
  });
});
