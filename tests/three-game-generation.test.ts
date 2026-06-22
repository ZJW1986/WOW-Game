import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";
import { requestThreeGameGeneration } from "../src/services/generationClient";
import { generateThreeGameMvp } from "../src/services/threeGameService";

function memoryStore() {
  const writes = new Map<string, string>();
  const binaryWrites = new Map<string, Uint8Array>();
  return {
    writeText: async (path: string, content: string) => {
      writes.set(path, content);
    },
    readText: async (path: string) => writes.get(path) ?? null,
    writeBytes: async (path: string, content: Uint8Array) => {
      binaryWrites.set(path, content);
    },
    readBytes: async (path: string) => binaryWrites.get(path) ?? null,
    ensureDir: async () => undefined,
    writes
  };
}

describe("threejs 3D generation", () => {
  it("creates an independent Three.js MVP project with 3D artifacts", () => {
    const result = generateThreeGameMvp({
      idea: "手机竖屏太空飞船躲避陨石收集能量",
      projectId: "three-project-test",
      baseUrl: "https://wow.example",
      viewportMode: "app_9_16",
      gameType3d: "flight_shooter"
    });

    expect(result.project.engineType).toBe("threejs3d");
    expect(result.project.sourceLabel).toBe("Three.js 3D");
    expect(result.project.threeSceneDirector?.controls).toContain("touch_drag");
    expect(result.project.threeAssetPlan?.requiredApiKeys).toEqual([
      "TRIPO_API_KEY",
      "GEMINI_API_KEY",
      "ELEVENLABS_API_KEY"
    ]);
    expect(result.project.artifacts.map((artifact) => artifact.fileName)).toEqual([
      "three-design-brief.json",
      "three-scene-director.json",
      "three-asset-plan.json",
      "three-asset-pack.json",
      "three-verification-report.json"
    ]);
    expect(result.threeAssetPack.assets.some((asset) => asset.type === "model")).toBe(true);
    expect(result.threeVerificationReport.viewports.some((viewport) => viewport.name === "mobile_portrait")).toBe(true);
    expect(result.threeVerificationReport).toMatchObject({
      canvasNonEmpty: true,
      inputMoved: true,
      mobileViewportChecked: true,
      consoleErrorCount: 0,
      screenshotCaptured: false
    });
    expect(result.deliveryReady).toBe(true);
  });

  it("serves /api/generate-three-game and saves the generated project", async () => {
    const store = memoryStore();
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-three-test", PUBLIC_BASE_URL: "https://wow.example" },
      storeIO: store
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-three-game",
      body: {
        idea: "手机竖屏太空飞船躲避陨石收集能量",
        projectId: "three-project-api",
        baseUrl: "https://wow.example",
        viewportMode: "app_9_16",
        gameType3d: "flight_shooter"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.project.engineType).toBe("threejs3d");
    expect(response.body.project.threeAssetPack.assets[0].provider).toBe("procedural-three");
    expect(response.body.project.playUrl).toBe("/play/three-project-api/v1");
    expect(Array.from(store.writes.keys()).some((path) => path.includes("three-project-api"))).toBe(true);
  });

  it("posts 3D generation requests through the browser client", async () => {
    const result = await requestThreeGameGeneration(
      {
        idea: "3D 跑酷收集金币",
        projectId: "three-client",
        baseUrl: "https://wow.example",
        viewportMode: "app_9_16",
        gameType3d: "runner"
      },
      async (url, init) => {
        expect(url).toBe("/api/generate-three-game");
        expect(JSON.parse(String(init?.body)).idea).toContain("跑酷");
        return new Response(
          JSON.stringify({
            project: { engineType: "threejs3d" },
            deliveryReady: true
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    );

    expect(result.project.engineType).toBe("threejs3d");
    expect(result.deliveryReady).toBe(true);
  });
});
