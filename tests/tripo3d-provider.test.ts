import { describe, expect, it } from "vitest";
import {
  createTripoTextToModelTask,
  getTripoBalance,
  pollTripoTask
} from "../src/services/tripo3dProvider";

describe("tripo3d provider", () => {
  it("uses Bearer authorization when checking account balance", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await getTripoBalance(
      { apiKey: "tripo-key", baseUrl: "https://openapi.tripo3d.com" },
      async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ code: 0, data: { balance: 123 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    );

    expect(result).toEqual({ code: 0, data: { balance: 123 } });
    expect(calls[0].url).toBe("https://openapi.tripo3d.com/v3/account/balance");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.headers).toEqual({ Authorization: "Bearer tripo-key" });
  });

  it("creates text-to-model tasks with the configured model", async () => {
    let requestBody = "";
    const taskId = await createTripoTextToModelTask(
      {
        apiKey: "tripo-key",
        baseUrl: "https://openapi.tripo3d.com",
        textModel: "v3.1-20260211"
      },
      "low-poly space cat spaceship",
      async (url, init) => {
        expect(String(url)).toBe("https://openapi.tripo3d.com/v3/generation/text-to-model");
        requestBody = String(init?.body ?? "");
        expect(init?.headers).toEqual({
          Authorization: "Bearer tripo-key",
          "Content-Type": "application/json"
        });
        return new Response(JSON.stringify({ code: 0, data: { task_id: "task-123" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    );

    expect(taskId).toBe("task-123");
    expect(JSON.parse(requestBody)).toEqual({
      prompt: "low-poly space cat spaceship",
      model: "v3.1-20260211"
    });
  });

  it("polls Tripo tasks until model_url is available", async () => {
    let calls = 0;
    const task = await pollTripoTask(
      {
        apiKey: "tripo-key",
        baseUrl: "https://openapi.tripo3d.com",
        pollIntervalMs: 0,
        timeoutMs: 1000
      },
      "task-123",
      async (url, init) => {
        calls += 1;
        expect(String(url)).toBe("https://openapi.tripo3d.com/v3/tasks/task-123");
        expect(init?.headers).toEqual({ Authorization: "Bearer tripo-key" });
        return new Response(
          JSON.stringify(
            calls === 1
              ? { code: 0, data: { status: "running", progress: 30 } }
              : { code: 0, data: { status: "success", progress: 100, output: { model_url: "https://tmp/model.glb" } } }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    );

    expect(calls).toBe(2);
    expect(task.output?.model_url).toBe("https://tmp/model.glb");
  });
});
