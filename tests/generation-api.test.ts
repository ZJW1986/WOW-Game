import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";
import { zipSync, strToU8 } from "fflate";

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

describe("generation api handler", () => {
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
        model: "deepseek-v4-flash"
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
        model: "mock-designer"
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
        model: "mock-designer"
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
