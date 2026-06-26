import { describe, expect, it } from "vitest";
import { createAssetRequirements } from "../src/core/pipeline";
import { createAgnesImageProvider } from "../src/services/agnesImageProvider";

describe("Agnes image provider", () => {
  it("maps project image requirements to Agnes generation requests", async () => {
    const requirement = createAssetRequirements("top_down").find((asset) => asset.assetKey === "player.ship");
    if (!requirement) throw new Error("missing player.ship fixture");

    let requestBody = "";
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://agnes.example",
      model: "agnes-image-test",
      fetcher: async ({ url, init }) => {
        expect(url).toBe("https://agnes.example/v1/images/generations");
        expect(init.headers.Authorization).toBe("Bearer agnes-key");
        requestBody = init.body;
        return JSON.stringify({
          data: [{ b64_json: "iVBORw0KGgo=" }]
        });
      }
    });

    const result = await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement
    });

    const body = JSON.parse(requestBody);
    expect(body.model).toBe("agnes-image-test");
    expect(body.prompt).toContain("player.ship");
    expect(body.size).toBe("1024x1024");
    expect(body.seed).toBeUndefined();
    expect(body.style_strength).toBeUndefined();
    expect(body.transparent_background).toBeUndefined();
    expect(result.source).toBe("generated");
    expect(result.provider).toBe("agnes");
    expect(result.fileUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("defaults to the official Agnes image generation model", async () => {
    const requirement = createAssetRequirements("top_down")[0];
    let requestBody = "";
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      endpoint: "/images/generations",
      fetcher: async ({ init }) => {
        requestBody = init.body;
        return JSON.stringify({ data: [{ url: "https://cdn.agnes.example/cover.png" }] });
      }
    });

    await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement
    });

    expect(JSON.parse(requestBody).model).toBe("agnes-image-2.1-flash");
  });

  it("sends only the final visual prompt and image constraints to Agnes", async () => {
    let sentPrompt = "";
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      fetcher: async ({ init }) => {
        sentPrompt = JSON.parse(init.body).prompt;
        return JSON.stringify({ data: [{ b64_json: "iVBORw0KGgo=" }] });
      }
    });

    await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement: {
        assetKey: "player.ship",
        type: "image",
        purpose: "player sprite",
        style: "developerPrompt polluted style",
        generationMode: "model",
        copyrightStatus: "generated",
        spec: "user idea: move, score, win condition, Phaser hooks",
        status: "missing",
        prompt: "专业游戏主角精灵提示词; assetKey: player.ship; subject: 太空猫飞船主角.",
        acceptedFileTypes: ["image/*"],
        previewUrl: "",
        source: "generated",
        fileUrl: "",
        provider: "pending",
        model: "pending",
        generationParams: {},
        transparentBackgroundRequired: true
      }
    });

    expect(sentPrompt).toContain("专业游戏主角精灵提示词");
    expect(sentPrompt).toContain("solid chroma");
    expect(sentPrompt).not.toContain("developerPrompt");
    expect(sentPrompt).not.toContain("win condition");
    expect(sentPrompt).not.toContain("Phaser");
  });

  it("can use Agnes official chat completions request format", async () => {
    const requirement = createAssetRequirements("top_down").find((asset) => asset.assetKey === "player.ship");
    if (!requirement) throw new Error("missing player.ship fixture");

    let requestBody = "";
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://apihub.agnes-ai.com",
      endpoint: "/v1/chat/completions",
      model: "agnes-2.0-flash",
      fetcher: async ({ url, init }) => {
        expect(url).toBe("https://apihub.agnes-ai.com/v1/chat/completions");
        expect(init.headers.Authorization).toBe("Bearer agnes-key");
        requestBody = init.body;
        return JSON.stringify({
          choices: [{ message: { content: "https://cdn.agnes.example/player.png" } }]
        });
      }
    });

    const result = await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement
    });

    const body = JSON.parse(requestBody);
    expect(body.model).toBe("agnes-2.0-flash");
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("player.ship");
    expect(result.fileUrl).toBe("https://cdn.agnes.example/player.png");
  });

  it("accepts Agnes image urls when the API returns a url instead of base64", async () => {
    const requirement = createAssetRequirements("top_down").find((asset) => asset.assetKey === "world.background");
    if (!requirement) throw new Error("missing world.background fixture");

    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://agnes.example",
      fetcher: async () =>
        JSON.stringify({
          data: [{ url: "https://cdn.agnes.example/background.png" }]
        })
    });

    const result = await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement
    });

    expect(result.fileUrl).toBe("https://cdn.agnes.example/background.png");
    expect(result.generationParams?.transparentBackground).toBe(false);
  });

  it("passes the background as a reference image without unsupported Agnes fields", async () => {
    const background = createAssetRequirements("top_down").find((asset) => asset.assetKey === "world.background");
    const player = createAssetRequirements("top_down").find((asset) => asset.assetKey === "player.ship");
    if (!background || !player) throw new Error("missing Agnes fixtures");

    const requests: Array<Record<string, unknown>> = [];
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://agnes.example",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        requests.push(body);
        return JSON.stringify({
          data: [{ url: requests.length === 1 ? "https://cdn.agnes.example/background.png" : "https://cdn.agnes.example/player.png" }]
        });
      }
    });

    await provider({
      projectId: "project-agnes",
      versionId: "v1-shared-style",
      requirement: background
    });
    const playerResult = await provider({
      projectId: "project-agnes",
      versionId: "v1-shared-style",
      requirement: player
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].seed).toBeUndefined();
    expect(requests[1].seed).toBeUndefined();
    expect(requests[0].style_strength).toBeUndefined();
    expect(requests[1].style_strength).toBeUndefined();
    expect(requests[1].reference_image).toBe("https://cdn.agnes.example/background.png");
    expect(playerResult.generationParams?.referenceImage).toBe("https://cdn.agnes.example/background.png");
  });

  it("omits the reference image when the background has not succeeded", async () => {
    const player = createAssetRequirements("top_down").find((asset) => asset.assetKey === "player.ship");
    if (!player) throw new Error("missing player.ship fixture");

    let requestBody = "";
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://agnes.example",
      fetcher: async ({ init }) => {
        requestBody = init.body;
        return JSON.stringify({ data: [{ url: "https://cdn.agnes.example/player.png" }] });
      }
    });

    await provider({
      projectId: "project-agnes",
      versionId: "v1-no-reference",
      requirement: player
    });

    expect(JSON.parse(requestBody).reference_image).toBeUndefined();
  });

  it("normalizes unsupported target sizes to Agnes-compatible sizes", async () => {
    const requirement = createAssetRequirements("top_down").find((asset) => asset.assetKey === "world.background");
    if (!requirement) throw new Error("missing world.background fixture");
    const sizes: unknown[] = [];
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      baseUrl: "https://agnes.example",
      fetcher: async ({ init }) => {
        sizes.push(JSON.parse(init.body).size);
        return JSON.stringify({ data: [{ url: "https://cdn.agnes.example/background.png" }] });
      }
    });

    await provider({ projectId: "project-agnes", versionId: "v1", requirement });
    await provider({
      projectId: "project-agnes",
      versionId: "v1",
      requirement: { ...requirement, targetSize: "1536x864" }
    });

    expect(sizes).toEqual(["1536x1024", "1536x1024"]);
  });

  it("fails clearly when IMAGE_API_KEY is missing so MediaGateway can fall back", async () => {
    const requirement = createAssetRequirements("top_down")[0];
    const provider = createAgnesImageProvider({ apiKey: "" });

    await expect(
      provider({
        projectId: "project-agnes",
        versionId: "v1",
        requirement
      })
    ).rejects.toThrow("IMAGE_API_KEY");
  });

  it("times out slow Agnes requests so image generation can fall back to the library", async () => {
    const requirement = createAssetRequirements("top_down")[0];
    const provider = createAgnesImageProvider({
      apiKey: "agnes-key",
      timeoutMs: 1,
      fetcher: async () => new Promise<string>(() => {})
    });

    await expect(
      provider({
        projectId: "project-agnes",
        versionId: "v1",
        requirement
      })
    ).rejects.toThrow("Agnes image request timed out");
  });
});
