import { describe, expect, it } from "vitest";
import {
  requestPlayableGeneration,
  requestPlayableProject,
  requestPackageEditPlan,
  replacePackageAsset,
  submitPlayableFeedback,
  uploadPlayablePackage
} from "../src/services/generationClient";

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

  it("times out generation requests so the UI can fall back locally", async () => {
    await expect(
      requestPlayableGeneration(
        {
          idea: "做一个飞船躲避陨石的小游戏",
          answers: [],
          templateFamily: "top_down",
          projectId: "project-client-timeout",
          baseUrl: "http://localhost:5173",
          model: "deepseek-v4-flash"
        },
        () => new Promise<Response>(() => {}),
        { timeoutMs: 1 }
      )
    ).rejects.toThrow("Generation request timed out");
  });

  it("loads persisted playable projects by project and version id", async () => {
    const result = await requestPlayableProject("project-client-play", "v1", async (url) => {
      expect(url).toBe("/api/play/project-client-play/v1");
      return new Response(
        JSON.stringify({
          project: {
            id: "project-client-play",
            contentType: "ai_project",
            editable: true,
            shareable: true
          }
        }),
        { status: 200 }
      );
    });

    expect(result.project.id).toBe("project-client-play");
    expect(result.project.contentType).toBe("ai_project");
  });

  it("submits playable feedback", async () => {
    const result = await submitPlayableFeedback(
      "project-client-play",
      "v1",
      { rating: 5, comment: "好玩", playerName: "tester" },
      async (url, init) => {
        expect(url).toBe("/api/play/project-client-play/v1/feedback");
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ feedback: { comment: "好玩" } }), { status: 201 });
      }
    );

    expect(result.feedback.comment).toBe("好玩");
  });

  it("uploads a zip package body for editable play and share", async () => {
    let requestBody = "";
    const result = await uploadPlayablePackage(
      {
        packageName: "Neon Drift",
        packageFileName: "neon-drift.zip",
        packageBase64: "UEsDBAoAAAAAA",
        description: "上传一个只读小游戏用于商城试玩"
      },
      async (url, init) => {
        expect(url).toBe("/api/upload-package");
        expect(init?.method).toBe("POST");
        requestBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            project: {
              id: "package-client-1",
              contentType: "uploaded_package",
              editable: true,
              shareable: true,
              sourceLabel: "ZIP Package"
            }
          }),
          { status: 201 }
        );
      }
    );

    expect(requestBody).toContain("neon-drift.zip");
    expect(requestBody).toContain("packageBase64");
    expect(result.project.contentType).toBe("uploaded_package");
    expect(result.project.editable).toBe(true);
    expect(result.project.shareable).toBe(true);
  });

  it("requests an AI edit plan for an uploaded package", async () => {
    let requestBody = "";
    const result = await requestPackageEditPlan(
      {
        projectId: "package-client-1",
        versionId: "v1",
        userGoal: "替换主角和背景"
      },
      async (url, init) => {
        expect(url).toBe("/api/package-edit-plan");
        expect(init?.method).toBe("POST");
        requestBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ fallbackUsed: true, aiEditPlan: { summary: "ok" } }), { status: 200 });
      }
    );

    expect(requestBody).toContain("替换主角和背景");
    expect(result.fallbackUsed).toBe(true);
  });

  it("posts a safe package asset replacement", async () => {
    let requestBody = "";
    const result = await replacePackageAsset(
      {
        projectId: "package-client-1",
        versionId: "v1",
        assetPath: "assets/player.png",
        fileBase64: "bmV3LXBuZw==",
        fileName: "robot.png"
      },
      async (url, init) => {
        expect(url).toBe("/api/replace-package-asset");
        expect(init?.method).toBe("POST");
        requestBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ replacedAsset: { path: "assets/player.png" } }), { status: 200 });
      }
    );

    expect(requestBody).toContain("assets/player.png");
    expect(result.replacedAsset.path).toBe("assets/player.png");
  });
});
