import { afterEach, describe, expect, it, vi } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";
import { zipSync, strToU8 } from "fflate";
import sharp from "sharp";

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
    ensureDir: async () => undefined
  };
}

function zipBase64(files: Record<string, string>): string {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)]))
  );
  return Buffer.from(zipped).toString("base64");
}

async function whiteBackgroundSpriteBytes(): Promise<ArrayBuffer> {
  const svg = `
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="white"/>
      <circle cx="48" cy="48" r="24" fill="#ff3355"/>
    </svg>
  `;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return toArrayBuffer(buffer);
}

async function backgroundBytes(): Promise<ArrayBuffer> {
  const svg = `
    <svg width="160" height="90" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="90" fill="#101828"/>
      <circle cx="80" cy="45" r="28" fill="#22d3ee"/>
    </svg>
  `;
  const buffer = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  return toArrayBuffer(buffer);
}

async function edgeTouchingSpriteBytes(): Promise<ArrayBuffer> {
  const svg = `
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="white"/>
      <circle cx="8" cy="48" r="24" fill="#ff7a18"/>
    </svg>
  `;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return toArrayBuffer(buffer);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function confirmedAssetsFixture() {
  return {
    assets: [
      {
        slot: "background",
        assetKey: "world.background",
        type: "image",
        label: "背景",
        prompt: "background prompt",
        style: "arcade",
        purpose: "游戏背景",
        acceptedFileTypes: ["image/*"],
        previewUrl: "data:image/png;base64,bg",
        fileUrl: "data:image/png;base64,bg",
        source: "generated",
        approvalStatus: "approved"
      },
      {
        slot: "player",
        assetKey: "player.ship",
        type: "image",
        label: "主角",
        prompt: "player prompt",
        style: "arcade",
        purpose: "玩家角色",
        acceptedFileTypes: ["image/*"],
        previewUrl: "data:image/png;base64,player",
        fileUrl: "data:image/png;base64,player",
        source: "generated",
        approvalStatus: "approved"
      },
      {
        slot: "hazard",
        assetKey: "hazard.enemy",
        type: "image",
        label: "危险物",
        prompt: "hazard prompt",
        style: "arcade",
        purpose: "危险物",
        acceptedFileTypes: ["image/*"],
        previewUrl: "data:image/png;base64,hazard",
        fileUrl: "data:image/png;base64,hazard",
        source: "generated",
        approvalStatus: "approved"
      },
      {
        slot: "collectible",
        assetKey: "item.collectible",
        type: "image",
        label: "收集物",
        prompt: "collectible prompt",
        style: "arcade",
        purpose: "收集物",
        acceptedFileTypes: ["image/*"],
        previewUrl: "data:image/png;base64,item",
        fileUrl: "data:image/png;base64,item",
        source: "generated",
        approvalStatus: "approved"
      }
    ]
  };
}

describe("generation api handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects playable generation before core assets are confirmed", async () => {
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个太空猫躲避陨石收集鱼干",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-without-confirmed-assets",
        model: "mock-designer"
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Core assets must be confirmed");
  });

  it("generates a playable response through the backend-only DeepSeek boundary", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DEEPSEEK_API_KEY: "server-key",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "top_down",
              reasons: ["top-down movement and collision are the dominant mechanics"],
              risks: [],
              unsupportedRequests: []
            }
          : prompt.includes("llm.gdd")
            ? {
                concept: "星尘航线",
                loop: ["开始", "移动", "躲避", "收集", "胜利"],
                entities: ["飞船", "星星", "陨石"],
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
                numbers: { playerSpeed: 260 },
                implementationRoute: "使用 top_down 模板和配置驱动关卡"
              }
            : {
                templateFamily: "top_down",
                title: "星尘航线",
                pitch: "飞船躲避陨石并收集星星",
                playerGoal: "收集 6 颗星星",
                controls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
                difficulty: "normal",
                referencedAssetKeys: ["cover.main", "player.ship", "world.background"],
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-api-1",
        model: "deepseek-v4-flash",
        confirmedAssets: confirmedAssetsFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.project.gameConfig.title).toBe("星尘航线");
    expect(response.body.project.contentType).toBe("ai_project");
    expect(response.body.project.editable).toBe(true);
    expect(response.body.project.shareable).toBe(true);
    expect(response.body.modelTasks.every((task: { status: string }) => task.status === "success")).toBe(true);
    expect(response.body.fallbacksUsed).toEqual([]);
  });

  it("rejects unsupported methods without running model generation", async () => {
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async () => {
        throw new Error("fetcher should not run");
      }
    });

    const response = await handler({
      method: "GET",
      path: "/api/generate-playable",
      body: {}
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("No route");
  });

  it("persists generated playables and reads them through play api paths", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO
    });

    const generateResponse = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-api-persisted",
        model: "mock-designer",
        confirmedAssets: confirmedAssetsFixture()
      }
    });
    const playResponse = await handler({
      method: "GET",
      path: "/api/play/project-api-persisted/v1",
      body: {}
    });

    expect(generateResponse.status).toBe(200);
    expect(playResponse.status).toBe(200);
    expect(playResponse.body.project.id).toBe("project-api-persisted");
    expect(playResponse.body.project.contentType).toBe("ai_project");
    expect(playResponse.body.project.editable).toBe(true);
    expect(playResponse.body.project.shareable).toBe(true);
    expect(playResponse.body.publishRecord.publicUrl).toBe(
      "https://wow-game.example/play/project-api-persisted/v1"
    );
  });

  it("rejects remote confirmed image assets even when they are downloadable", async () => {
    const remoteConfirmedAssets = confirmedAssetsFixture();
    remoteConfirmedAssets.assets = remoteConfirmedAssets.assets.map((asset) => ({
      ...asset,
      fileUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      previewUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      provider: "agnes",
      model: "agnes-image-2.1-flash"
    }));
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "make a neon spaceship dodge game",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-localized-assets",
        model: "mock-designer",
        confirmedAssets: remoteConfirmedAssets
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Core assets must be localized");
  });

  it("rejects remote confirmed images when they cannot be localized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0)
      }))
    );
    const remoteConfirmedAssets = confirmedAssetsFixture();
    remoteConfirmedAssets.assets = remoteConfirmedAssets.assets.map((asset) => ({
      ...asset,
      fileUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      previewUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      provider: "agnes",
      model: "agnes-image-2.1-flash"
    }));
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "make a neon spaceship dodge game",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-unlocalized-assets",
        model: "mock-designer",
        confirmedAssets: remoteConfirmedAssets
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Core assets must be localized");
  });

  it("rejects remote confirmed image urls before playable generation", async () => {
    const remoteConfirmedAssets = confirmedAssetsFixture();
    remoteConfirmedAssets.assets = remoteConfirmedAssets.assets.map((asset) => ({
      ...asset,
      fileUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      previewUrl: `https://platform-outputs.agnes-ai.space/${asset.assetKey}.png`,
      provider: "agnes",
      model: "agnes-image-2.1-flash"
    }));
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "make a neon spaceship dodge game",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-remote-assets-rejected",
        model: "mock-designer",
        confirmedAssets: remoteConfirmedAssets
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Core assets must be localized");
  });

  it("normalizes drifting confirmed asset keys before saving the final asset-pack", async () => {
    const driftingConfirmedAssets = confirmedAssetsFixture();
    driftingConfirmedAssets.assets = driftingConfirmedAssets.assets.map((asset) =>
      asset.slot === "hazard"
        ? { ...asset, assetKey: "hazard.asteroid" }
        : asset.slot === "player"
          ? { ...asset, assetKey: "players.ship" }
          : asset.slot === "background"
            ? { ...asset, assetKey: "background.world.background" }
            : asset
    );
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "make a neon spaceship dodge game",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-invalid-final-assets",
        model: "mock-designer",
        confirmedAssets: driftingConfirmedAssets
      }
    });

    expect(response.status).toBe(200);
    const hazard = response.body.project.assetPack.assets.find(
      (asset: { assetKey: string }) => asset.assetKey === "hazard.enemy"
    );
    const player = response.body.project.assetPack.assets.find(
      (asset: { assetKey: string }) => asset.assetKey === "player.ship"
    );
    const background = response.body.project.assetPack.assets.find(
      (asset: { assetKey: string }) => asset.assetKey === "world.background"
    );
    expect(response.body.runtimeAssetReport.ready).toBe(true);
    expect(background.fileUrl).toBe("data:image/png;base64,bg");
    expect(player.fileUrl).toBe("data:image/png;base64,player");
    expect(hazard.fileUrl).toBe("data:image/png;base64,hazard");
    expect(hazard.generationParams.candidateLabel).toBeTruthy();
  });

  it("localizes Agnes sprite candidates as processed transparent PNGs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const isBackground = url.includes("background");
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": isBackground ? "image/jpeg" : "image/png" }),
          arrayBuffer: async () => (isBackground ? backgroundBytes() : whiteBackgroundSpriteBytes())
        };
      })
    );
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "image-key",
        IMAGE_BASE_URL: "https://agnes.test",
        IMAGE_ENDPOINT: "/v1/images/generations"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { prompt?: string };
        const prompt = body.prompt ?? "";
        if (!prompt.includes("world.background")) {
          expect(prompt).toContain("solid chroma");
          expect(prompt).toContain("no shadow");
          expect(prompt).toContain("no border");
        }
        const fileName = prompt.includes("world.background")
          ? "background.jpg"
          : prompt.includes("hazard.enemy")
            ? "hazard.png"
            : prompt.includes("item.collectible")
              ? "collectible.png"
              : "player.png";
        return JSON.stringify({ data: [{ url: `https://assets.test/${fileName}` }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/asset-candidates",
      body: {
        idea: "make a neon spaceship dodge game",
        templateFamily: "top_down",
        model: "mock-designer"
      }
    });

    expect(response.status).toBe(200);
    const player = response.body.assetCandidates.candidates.find(
      (candidate: { slot: string }) => candidate.slot === "player"
    );
    expect(player.fileUrl).toContain(".cutout.png");
    expect(player.previewUrl).toBe(player.fileUrl);
    expect(player.validationStatus).toBe("passed");
    expect(player.generationParams.cutoutApplied).toBe(true);
    expect(player.generationParams.originalLibraryUrl).toContain("/original/");
    expect(player.generationParams.processedLibraryUrl).toContain("/processed/");
    expect(response.body.confirmedAssets.assets.some((asset: { fileUrl: string }) => asset.fileUrl === player.fileUrl)).toBe(true);
  });

  it("keeps edge-residue cutout sprites usable as warnings instead of blocking generation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const isBackground = url.includes("background");
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": isBackground ? "image/jpeg" : "image/png" }),
          arrayBuffer: async () => (isBackground ? backgroundBytes() : edgeTouchingSpriteBytes())
        };
      })
    );
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "image-key",
        IMAGE_BASE_URL: "https://agnes.test",
        IMAGE_ENDPOINT: "/v1/images/generations"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { prompt?: string };
        const prompt = body.prompt ?? "";
        const fileName = prompt.includes("world.background")
          ? "background.jpg"
          : prompt.includes("hazard.enemy")
            ? "hazard.png"
            : prompt.includes("item.collectible")
              ? "collectible.png"
              : "player.png";
        return JSON.stringify({ data: [{ url: `https://assets.test/${fileName}` }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/asset-candidates",
      body: {
        idea: "make a neon spaceship dodge game",
        templateFamily: "top_down",
        model: "mock-designer"
      }
    });

    expect(response.status).toBe(200);
    const hazard = response.body.assetCandidates.candidates.find(
      (candidate: { slot: string }) => candidate.slot === "hazard"
    );
    expect(hazard.fileUrl).toContain(".cutout.png");
    expect(hazard.validationStatus).not.toBe("failed");
    expect(hazard.error).toBeUndefined();
    expect(response.body.confirmedAssets.assets.some((asset: { slot: string }) => asset.slot === "hazard")).toBe(true);
  });

  it("regenerates only one asset candidate slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => whiteBackgroundSpriteBytes()
      }))
    );
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "image-key",
        IMAGE_BASE_URL: "https://agnes.test",
        IMAGE_ENDPOINT: "/v1/images/generations"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { prompt?: string };
        expect(body.prompt).toContain("player only prompt");
        return JSON.stringify({ data: [{ url: "https://assets.test/player-only.png" }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/regenerate-asset-candidate",
      body: {
        idea: "make a neon spaceship dodge game",
        templateFamily: "top_down",
        candidate: {
          slot: "player",
          assetKey: "player.ship",
          type: "image",
          label: "Player",
          prompt: "player only prompt",
          style: "arcade",
          purpose: "player sprite",
          acceptedFileTypes: ["image/*"],
          previewUrl: "",
          fileUrl: "",
          source: "generated"
        }
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.assetCandidate.slot).toBe("player");
    expect(response.body.assetCandidate.fileUrl).toContain("player.ship.cutout.png");
    expect(response.body.assetCandidate.validationStatus).toBe("passed");
  });

  it("returns final slot-specific prompts that match the Agnes prompt context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": url.includes("background") ? "image/jpeg" : "image/png" }),
        arrayBuffer: async () => (url.includes("background") ? backgroundBytes() : whiteBackgroundSpriteBytes())
      }))
    );
    const agnesPrompts: string[] = [];
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "image-key",
        IMAGE_BASE_URL: "https://agnes.test",
        IMAGE_ENDPOINT: "/v1/images/generations"
      },
      storeIO: memoryStore(),
      fetcher: async ({ url, init }) => {
        if (String(url).includes("agnes.test")) {
          const body = JSON.parse(init.body) as { prompt?: string };
          const prompt = body.prompt ?? "";
          agnesPrompts.push(prompt);
          const fileName = prompt.includes("world.background")
            ? "background.jpg"
            : prompt.includes("hazard.enemy")
              ? "hazard.png"
              : prompt.includes("item.collectible")
                ? "collectible.png"
                : "player.png";
          return JSON.stringify({ data: [{ url: `https://assets.test/${fileName}` }] });
        }
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: ["background", "player", "hazard", "collectible"].map((slot) => ({
                    slot,
                    assetKey:
                      slot === "background"
                        ? "world.background"
                        : slot === "player"
                          ? "player.ship"
                          : slot === "hazard"
                            ? "hazard.enemy"
                            : "item.collectible",
                    type: "image",
                    label: `${slot} test`,
                    prompt: "开发一个基于网格的翻转格子谜题游戏。初始网格为5x5，所有格子状态为暗色。",
                    style: "test",
                    purpose: "test",
                    acceptedFileTypes: ["image/*"]
                  }))
                })
              }
            }
          ]
        });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/asset-candidates",
      body: {
        idea: "太空猫驾驶飞船躲避陨石并收集鱼干",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        answers: [
          { questionId: "role", value: "主角是太空猫飞船，危险物是陨石，收集物是鱼干。" }
        ]
      }
    });

    expect(response.status).toBe(200);
    const prompts = response.body.assetCandidates.candidates.map((candidate: { prompt: string }) => candidate.prompt);
    expect(new Set(prompts).size).toBe(4);
    expect(prompts.every((prompt: string) => prompt.includes("太空猫驾驶飞船躲避陨石并收集鱼干"))).toBe(true);
    for (const candidate of response.body.assetCandidates.candidates as Array<{ prompt: string; generationParams: Record<string, string> }>) {
      expect(candidate.generationParams.finalPrompt).toBe(candidate.prompt);
      expect(candidate.generationParams.modelPrompt).toContain("翻转格子");
      expect(agnesPrompts.some((prompt) => prompt.includes(candidate.prompt))).toBe(true);
    }
  });

  it("uses unique asset candidate URLs for separate generation batches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": url.includes("background") ? "image/jpeg" : "image/png" }),
        arrayBuffer: async () => (url.includes("background") ? backgroundBytes() : whiteBackgroundSpriteBytes())
      }))
    );
    let requestCount = 0;
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "image-key",
        IMAGE_BASE_URL: "https://agnes.test",
        IMAGE_ENDPOINT: "/v1/images/generations"
      },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        requestCount += 1;
        const body = JSON.parse(init.body) as { prompt?: string };
        const prompt = body.prompt ?? "";
        const fileName = prompt.includes("world.background")
          ? "background.jpg"
          : prompt.includes("hazard.enemy")
            ? "hazard.png"
            : prompt.includes("item.collectible")
              ? "collectible.png"
              : "player.png";
        return JSON.stringify({ data: [{ url: `https://assets.test/${requestCount}-${fileName}` }] });
      }
    });

    const body = {
      idea: "太空猫驾驶飞船躲避陨石并收集鱼干",
      templateFamily: "top_down",
      model: "mock-designer"
    };
    const first = await handler({ method: "POST", path: "/api/asset-candidates", body });
    const second = await handler({ method: "POST", path: "/api/asset-candidates", body });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstUrls = first.body.assetCandidates.candidates.map((candidate: { fileUrl: string }) => candidate.fileUrl);
    const secondUrls = second.body.assetCandidates.candidates.map((candidate: { fileUrl: string }) => candidate.fileUrl);
    expect(firstUrls).not.toEqual(secondUrls);
    expect(firstUrls.every((url: string) => url.includes("/asset-candidates/assets-"))).toBe(true);
    expect(secondUrls.every((url: string) => url.includes("/asset-candidates/assets-"))).toBe(true);
  });

  it("processes uploaded replacement images through the cutout pipeline", async () => {
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });
    const bytes = Buffer.from(await whiteBackgroundSpriteBytes()).toString("base64");

    const response = await handler({
      method: "POST",
      path: "/api/process-uploaded-material",
      body: {
        idea: "make a neon spaceship dodge game",
        templateFamily: "top_down",
        slot: "hazard",
        assetKey: "hazard.enemy",
        fileName: "asteroid.png",
        fileBase64: bytes,
        contentType: "image/png",
        label: "Uploaded asteroid",
        prompt: "uploaded asteroid",
        style: "neon"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.assetCandidate.slot).toBe("hazard");
    expect(response.body.assetCandidate.source).toBe("uploaded");
    expect(response.body.assetCandidate.fileUrl).toContain(".cutout.png");
    expect(response.body.assetCandidate.previewUrl).toBe(response.body.assetCandidate.fileUrl);
    expect(response.body.assetCandidate.validationStatus).toBe("passed");
    expect(response.body.assetCandidate.generationParams.cutoutApplied).toBe(true);
  });

  it("normalizes uploaded replacement keys to the runtime slot contract", async () => {
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO: memoryStore()
    });
    const bytes = Buffer.from(await whiteBackgroundSpriteBytes()).toString("base64");

    const response = await handler({
      method: "POST",
      path: "/api/process-uploaded-material",
      body: {
        idea: "make a neon spaceship dodge game",
        templateFamily: "top_down",
        slot: "player",
        assetKey: "players.ship",
        fileName: "ship.png",
        fileBase64: bytes,
        contentType: "image/png",
        label: "Uploaded ship",
        prompt: "uploaded ship",
        style: "neon"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.assetCandidate.assetKey).toBe("player.ship");
    expect(response.body.assetCandidate.fileUrl).toContain("player.ship.cutout.png");
  });

  it("returns delivery reports and a playable director for generated games", async () => {
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test", PUBLIC_BASE_URL: "https://wow-game.example" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-delivery-report",
        baseUrl: "https://wow-game.example",
        model: "mock-designer",
        confirmedAssets: confirmedAssetsFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.deliveryReady).toBe(true);
    expect(response.body.runtimeAssetReport.ready).toBe(true);
    expect(response.body.verificationReport.passed).toBe(true);
    expect(response.body.project.artifacts.map((artifact: { fileName: string }) => artifact.fileName)).toEqual(
      expect.arrayContaining([
        "playable-director.json",
        "runtime-asset-report.json",
        "browser-verification-report.json"
      ])
    );
  });

  it("returns DeepSeek guided questions through the api with fallback metadata", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DEEPSEEK_API_KEY: "server-key"
      },
      storeIO: memoryStore(),
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      id: "controls",
                      label: "操作方式",
                      prompt: "玩家用键盘还是鼠标控制？",
                      inputType: "single_choice",
                      options: ["键盘", "鼠标"],
                      defaultAnswer: "键盘",
                      required: true
                    },
                    {
                      id: "goal",
                      label: "胜利目标",
                      prompt: "玩家怎样算赢？",
                      inputType: "short_text",
                      defaultAnswer: "收集星星",
                      required: true
                    },
                    {
                      id: "failure",
                      label: "失败条件",
                      prompt: "玩家怎样失败？",
                      inputType: "short_text",
                      defaultAnswer: "碰到敌人",
                      required: true
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const response = await handler({
      method: "POST",
      path: "/api/guided-questions",
      body: {
        idea: "做一个飞船躲避陨石并收集星星的小游戏",
        templateFamily: "top_down",
        model: "deepseek-v4-flash"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.fallbackUsed).toBe(false);
    expect(response.body.modelTask.taskType).toBe("llm.guided_questions");
    expect(response.body.questions).toHaveLength(3);
  });

  it("saves player feedback for a persisted playable", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO
    });

    await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个横版跳跃收集金币的森林游戏",
        answers: [],
        templateFamily: "platformer",
        projectId: "project-api-feedback",
        model: "mock-designer",
        confirmedAssets: confirmedAssetsFixture()
      }
    });
    const feedbackResponse = await handler({
      method: "POST",
      path: "/api/play/project-api-feedback/v1/feedback",
      body: {
        rating: 5,
        comment: "跳跃手感可以更轻快",
        playerName: "player-a"
      }
    });
    const playResponse = await handler({
      method: "GET",
      path: "/api/play/project-api-feedback/v1",
      body: {}
    });

    expect(feedbackResponse.status).toBe(201);
    expect(feedbackResponse.body.feedback.iterationSuggestion).toContain("下一版");
    expect(playResponse.body.feedback).toHaveLength(1);
  });

  it("parses uploaded zip packages into editable package artifacts", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO
    });

    const uploadResponse = await handler({
      method: "POST",
      path: "/api/upload-package",
      body: {
        packageName: "Neon Drift",
        packageFileName: "neon-drift.zip",
        packageBase64: zipBase64({
          "index.html": '<script src="game.js"></script><img src="assets/player.png"><audio src="audio/bgm.mp3"></audio>',
          "game.js": "console.log('play')",
          "assets/player.png": "png",
          "audio/bgm.mp3": "mp3"
        }),
        description: "上传一个只读小游戏用于商城试玩"
      }
    });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.project.contentType).toBe("uploaded_package");
    expect(uploadResponse.body.project.editable).toBe(true);
    expect(uploadResponse.body.project.shareable).toBe(true);
    expect(uploadResponse.body.project.sourceLabel).toBe("ZIP Package");
    expect(uploadResponse.body.packageManifest.entry).toBe("index.html");
    expect(uploadResponse.body.assetIndex.images[0].path).toBe("assets/player.png");
    expect(uploadResponse.body.runtimeEntry.entryUrl).toContain("/uploads/");
    expect(uploadResponse.body.healthReport.status).toBe("pass");

    const playResponse = await handler({
      method: "GET",
      path: `/api/play/${uploadResponse.body.project.id}/v1`,
      body: {}
    });

    expect(playResponse.status).toBe(200);
    expect(playResponse.body.uploadedPackage.packageManifest.fileCount).toBe(4);
  });

  it("uses an uploaded package as reference context while generating a new ai project", async () => {
    const storeIO = memoryStore();
    const prompts: string[] = [];
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO,
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "top_down",
              reasons: ["reference package suggests top-down dodge and collect pacing"],
              risks: [],
              unsupportedRequests: []
            }
          : prompt.includes("llm.gdd")
            ? {
                concept: "参考节奏的新飞船游戏",
                loop: ["移动", "躲避", "收集", "胜利"],
                entities: ["玩家", "收集物", "危险物"],
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
                numbers: { playerSpeed: 260 },
                implementationRoute: "使用 top_down 模板生成新游戏，不修改上传 ZIP"
              }
            : {
                templateFamily: "top_down",
                title: "参考星航",
                pitch: "参考上传包节奏生成的新游戏",
                playerGoal: "收集 6 个能量并避开敌人",
                controls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
                difficulty: "normal",
                referencedAssetKeys: ["cover.main", "player.ship", "world.background"],
                gameplay: {
                  primaryAction: "dodge_collect",
                  enemyBehavior: "patrol",
                  objectiveMode: "collect_score",
                  playerAbility: "dash",
                  spawnPattern: "lanes"
                },
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const uploadResponse = await handler({
      method: "POST",
      path: "/api/upload-package",
      body: {
        packageName: "Plane Reference",
        packageFileName: "plane-reference.zip",
        packageBase64: zipBase64({
          "plane/index.html": '<script src="js/main.js"></script><img src="image/player.png"><audio src="audio/bgm.mp3"></audio>',
          "plane/js/main.js": "console.log('reference')",
          "plane/image/player.png": "png",
          "plane/audio/bgm.mp3": "mp3"
        })
      }
    });
    const generateResponse = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "参考飞机大战做一个太空猫躲避陨石收集鱼干",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-reference-generated",
        model: "deepseek-v4-flash",
        referencePackageId: uploadResponse.body.project.id,
        referenceVersionId: "v1",
        confirmedAssets: confirmedAssetsFixture()
      }
    });

    const artifactNames = generateResponse.body.project.artifacts.map((artifact: { fileName: string }) => artifact.fileName);
    const referenceArtifact = generateResponse.body.project.artifacts.find(
      (artifact: { fileName: string }) => artifact.fileName === "reference-package.json"
    );

    expect(generateResponse.status).toBe(200);
    expect(generateResponse.body.project.contentType).toBe("ai_project");
    expect(artifactNames).toContain("reference-package.json");
    expect(referenceArtifact.content.packageName).toBe("Plane Reference");
    expect(referenceArtifact.content.images[0].path).toBe("image/player.png");
    expect(prompts.join("\n")).toContain("referencePackageSummary");
    expect(prompts.join("\n")).toContain("Plane Reference");
  });

  it("marks a fallback when requested reference package cannot be read", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        PUBLIC_BASE_URL: "https://wow-game.example"
      },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "参考一个不存在的包生成新的飞行躲避游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-missing-reference",
        model: "mock-designer",
        referencePackageId: "missing-package",
        referenceVersionId: "v1",
        confirmedAssets: confirmedAssetsFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.project.contentType).toBe("ai_project");
    expect(response.body.fallbacksUsed).toContain("reference_package_missing");
  });

  it("returns a fallback AI edit plan for persisted uploaded packages", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO
    });

    const uploadResponse = await handler({
      method: "POST",
      path: "/api/upload-package",
      body: {
        packageName: "Neon Drift",
        packageFileName: "neon-drift.zip",
        packageBase64: zipBase64({
          "index.html": '<script src="game.js"></script><img src="assets/player.png">',
          "game.js": "console.log('play')",
          "assets/player.png": "png"
        })
      }
    });
    const editPlanResponse = await handler({
      method: "POST",
      path: "/api/package-edit-plan",
      body: {
        projectId: uploadResponse.body.project.id,
        versionId: "v1",
        userGoal: "把主角换成机器人"
      }
    });

    expect(editPlanResponse.status).toBe(200);
    expect(editPlanResponse.body.fallbackUsed).toBe(true);
    expect(editPlanResponse.body.aiEditPlan.summary).toContain("把主角换成机器人");
    expect(editPlanResponse.body.aiEditPlan.editableAssets[0].path).toBe("assets/player.png");
  });

  it("replaces a safe uploaded package asset and keeps the play record readable", async () => {
    const storeIO = memoryStore();
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test" },
      storeIO
    });

    const uploadResponse = await handler({
      method: "POST",
      path: "/api/upload-package",
      body: {
        packageName: "Neon Drift",
        packageFileName: "neon-drift.zip",
        packageBase64: zipBase64({
          "index.html": '<script src="game.js"></script><img src="assets/player.png">',
          "game.js": "console.log('play')",
          "assets/player.png": "old-png"
        })
      }
    });
    const replaceResponse = await handler({
      method: "POST",
      path: "/api/replace-package-asset",
      body: {
        projectId: uploadResponse.body.project.id,
        versionId: "v1",
        assetPath: "assets/player.png",
        fileBase64: Buffer.from("new-png").toString("base64"),
        fileName: "robot.png"
      }
    });
    const fileResponse = await handler({
      method: "GET",
      path: `/api/uploads/${uploadResponse.body.project.id}/v1/files/assets/player.png`,
      body: {}
    });
    const playResponse = await handler({
      method: "GET",
      path: `/api/play/${uploadResponse.body.project.id}/v1`,
      body: {}
    });

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body.replacedAsset.path).toBe("assets/player.png");
    expect(fileResponse.body.fileBase64).toBe(Buffer.from("new-png").toString("base64"));
    expect(playResponse.body.uploadedPackage.healthReport.status).toBe("pass");
  });
});
