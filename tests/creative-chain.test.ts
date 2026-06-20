import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";
import { vi } from "vitest";
import { createPromptForTask } from "../src/services/promptPack";

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

function designBriefFixture() {
  return {
    coreGameplay: "俯视角躲避和收集，主角需要在移动压力中完成目标。",
    playerGoal: "收集鱼干能量并避开陨石。",
    referenceTakeaways: ["参考包提供了持续移动压力和飞行射击节奏。"],
    risks: ["第一版不复制原 ZIP 源码，只借鉴节奏和素材风格。"],
    questionFocus: ["玩法目标", "角色和障碍", "视觉风格", "音效氛围", "关卡节奏"],
    developerPrompt: "生成 top_down 模板小游戏：太空猫躲避陨石，收集鱼干，使用配置和素材协议实现。"
  };
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

describe("AI creative chain", () => {
  it("creates a DeepSeek design brief before guided questions", async () => {
    const prompts: string[] = [];
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(designBriefFixture()) } }] });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/design-brief",
      body: {
        idea: "参考飞机大战做一个太空猫躲避陨石收集鱼干",
        templateFamily: "top_down",
        model: "deepseek-v4-flash"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.designBrief.developerPrompt).toContain("top_down");
    expect(response.body.fallbackUsed).toBe(false);
    expect(response.body.modelTask.taskType).toBe("llm.design_brief");
    expect(prompts.join("\n")).toContain("Task: llm.design_brief");
  });

  it("uses design brief context when generating guided questions", async () => {
    const prompts: string[] = [];
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        prompts.push(prompt);
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      id: "gameplay_goal",
                      label: "玩法目标",
                      prompt: "玩家完成什么目标后算胜利？",
                      inputType: "short_text",
                      defaultAnswer: "收集 6 个鱼干能量",
                      required: true
                    },
                    {
                      id: "character_enemy",
                      label: "角色和障碍",
                      prompt: "主角、敌人和收集物分别是什么？",
                      inputType: "short_text",
                      defaultAnswer: "太空猫、陨石、鱼干",
                      required: true
                    },
                    {
                      id: "visual_style",
                      label: "视觉风格",
                      prompt: "画面希望更可爱还是更科幻？",
                      inputType: "single_choice",
                      options: ["可爱科幻", "硬核太空", "霓虹街机"],
                      defaultAnswer: "可爱科幻",
                      required: true
                    },
                    {
                      id: "audio_mood",
                      label: "音效氛围",
                      prompt: "音效和 BGM 应该是什么情绪？",
                      inputType: "short_text",
                      defaultAnswer: "轻快紧张",
                      required: true
                    },
                    {
                      id: "level_pacing",
                      label: "关卡节奏",
                      prompt: "第一关希望多快进入危险和奖励循环？",
                      inputType: "short_text",
                      defaultAnswer: "10 秒内出现收集和躲避",
                      required: true
                    }
                  ]
                })
              }
            }
          ]
        });
      }
    });

    const response = await handler({
      method: "POST",
      path: "/api/guided-questions",
      body: {
        idea: "做一个太空猫躲避游戏",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.questions.map((question: { label: string }) => question.label)).toEqual([
      "玩法目标",
      "角色和障碍",
      "视觉风格",
      "音效氛围",
      "关卡节奏"
    ]);
    expect(prompts.join("\n")).toContain("designBrief");
    expect(prompts.join("\n")).toContain("developerPrompt");
  });

  it("generates confirmable asset candidates with preview payloads", async () => {
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      slot: "background",
                      assetKey: "world.background",
                      type: "image",
                      label: "星空背景",
                      prompt: "可爱科幻星空背景，蓝紫色星云，适合 2D 俯视角游戏",
                      style: "可爱科幻",
                      purpose: "第一关背景",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "player",
                      assetKey: "player.ship",
                      type: "image",
                      label: "太空猫飞船",
                      prompt: "透明背景太空猫飞船角色精灵",
                      style: "可爱科幻",
                      purpose: "玩家角色",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "hazard",
                      assetKey: "hazard.asteroid",
                      type: "image",
                      label: "陨石障碍",
                      prompt: "红色边缘陨石障碍物",
                      style: "街机",
                      purpose: "失败危险物",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "collectible",
                      assetKey: "item.collectible",
                      type: "image",
                      label: "鱼干能量",
                      prompt: "发光鱼干收集物",
                      style: "可爱",
                      purpose: "得分道具",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "bgm",
                      assetKey: "bgm.loop",
                      type: "bgm",
                      label: "太空循环 BGM",
                      prompt: "轻快紧张的太空街机循环音乐",
                      style: "synth",
                      purpose: "背景音乐",
                      acceptedFileTypes: ["audio/*"]
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
      path: "/api/asset-candidates",
      body: {
        idea: "做一个太空猫躲避游戏",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.assetCandidates.candidates).toHaveLength(4);
    expect(response.body.assetCandidates.candidates.map((candidate: { slot: string }) => candidate.slot)).toEqual([
      "background",
      "player",
      "hazard",
      "collectible"
    ]);
    expect(response.body.assetCandidates.candidates.map((candidate: { assetKey: string }) => candidate.assetKey)).toEqual([
      "world.background",
      "player.ship",
      "hazard.enemy",
      "item.collectible"
    ]);
    expect(response.body.assetCandidates.candidates.every((candidate: { type: string }) => candidate.type === "image")).toBe(true);
    expect(response.body.assetCandidates.candidates[0].previewUrl).toContain("/projects/asset-candidates/assets-");
    expect(response.body.confirmedAssets.assets.every((asset: { approvalStatus: string }) => asset.approvalStatus === "approved")).toBe(true);
  });

  it("uses DeepSeek image prompts to generate image candidate previews through Agnes", async () => {
    const requests: Array<{ prompt?: string; size?: string }> = [];
    const storeIO = memoryStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer
      }))
    );
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "agnes-key",
        IMAGE_BASE_URL: "https://agnes.example"
      },
      storeIO,
      fetcher: async ({ url, init }) => {
        const body = JSON.parse(init.body);
        if (String(url).includes("agnes.example")) {
          requests.push(body);
          return JSON.stringify({ data: [{ url: `https://cdn.example/${requests.length}.png` }] });
        }
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      slot: "background",
                      assetKey: "world.background",
                      type: "image",
                      label: "星空背景",
                      prompt: "专业游戏背景图提示词：蓝紫色星云、清晰层次、2D 俯视角",
                      style: "科幻",
                      purpose: "游戏背景",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "player",
                      assetKey: "player.ship",
                      type: "image",
                      label: "太空猫飞船",
                      prompt: "专业角色素材提示词：透明背景太空猫飞船精灵",
                      style: "可爱科幻",
                      purpose: "玩家角色",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "hazard",
                      assetKey: "hazard.enemy",
                      type: "image",
                      label: "陨石障碍",
                      prompt: "专业障碍物提示词：红色边缘陨石",
                      style: "街机",
                      purpose: "危险物",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "collectible",
                      assetKey: "item.collectible",
                      type: "image",
                      label: "鱼干能量",
                      prompt: "专业收集物提示词：发光鱼干图标",
                      style: "可爱",
                      purpose: "得分道具",
                      acceptedFileTypes: ["image/*"]
                    }
                  ]
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
        idea: "做一个太空猫躲避游戏",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(4);
    expect(requests[0].prompt).toContain("专业游戏背景图提示词");
    expect(response.body.assetCandidates.candidates[0].previewUrl).toContain(
      "/projects/asset-candidates/assets-"
    );
    expect(response.body.assetCandidates.candidates[0].previewUrl).toContain(
      "/assets/generated/original/world.background.png"
    );
    expect(response.body.assetCandidates.candidates[0].generationParams.originalRemoteUrl).toBe("https://cdn.example/1.png");
    expect(response.body.assetCandidates.candidates[1].provider).toBe("agnes");
    const saved = await storeIO.readBytes(
      response.body.assetCandidates.candidates[0].previewUrl.replace(
        "/projects/asset-candidates/",
        "data-api-test/projects/asset-candidates/versions/"
      ).replace("/assets/", "/assets/")
    );
    expect(saved).toBeTruthy();
  });

  it("rewrites generic English asset fallback into idea-specific Chinese core image candidates", async () => {
    const requests: Array<{ prompt?: string }> = [];
    const handler = createGenerationApiHandler({
      env: {
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "agnes-key",
        IMAGE_BASE_URL: "https://agnes.example"
      },
      storeIO: memoryStore(),
      fetcher: async ({ url, init }) => {
        if (String(url).includes("agnes.example")) {
          requests.push(JSON.parse(init.body));
          return JSON.stringify({ data: [{ url: `https://cdn.example/${requests.length}.png` }] });
        }
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      slot: "background",
                      assetKey: "world.background",
                      type: "image",
                      label: "Sky Background",
                      prompt: "A simple sky background for a platformer game",
                      style: "test",
                      purpose: "background",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "player",
                      assetKey: "player.ship",
                      type: "image",
                      label: "Player Character",
                      prompt: "A small blue square character",
                      style: "test",
                      purpose: "player",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "hazard",
                      assetKey: "hazard.enemy",
                      type: "image",
                      label: "Spike Hazard",
                      prompt: "A triangular spike shape",
                      style: "test",
                      purpose: "hazard",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "collectible",
                      assetKey: "item.collectible",
                      type: "image",
                      label: "Coin Collectible",
                      prompt: "A small coin",
                      style: "test",
                      purpose: "collectible",
                      acceptedFileTypes: ["image/*"]
                    }
                  ]
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
        idea: "太空猫驾驶飞船躲避陨石，收集鱼干",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.assetCandidates.candidates.map((candidate: { label: string }) => candidate.label)).toEqual([
      "太空背景",
      "太空猫飞船",
      "陨石危险物",
      "鱼干收集物"
    ]);
    expect(response.body.assetCandidates.candidates.map((candidate: { prompt: string }) => candidate.prompt).join("\n")).toContain(
      "太空猫驾驶飞船躲避陨石，收集鱼干"
    );
    expect(requests.map((request) => request.prompt).join("\n")).toContain("slot: player");
    expect(new Set(requests.map((request) => request.prompt)).size).toBe(4);
  });

  it("marks asset candidates as failed when Agnes remote images cannot be localized", async () => {
    const handler = createGenerationApiHandler({
      env: {
        DATA_DIR: "data-api-test",
        DEEPSEEK_API_KEY: "server-key",
        IMAGE_PROVIDER: "agnes",
        IMAGE_API_KEY: "agnes-key",
        IMAGE_BASE_URL: "https://agnes.example"
      },
      storeIO: memoryStore(),
      fetcher: async ({ url }) => {
        if (String(url).includes("agnes.example")) {
          return JSON.stringify({ data: [{ url: "https://cdn.example/unreachable.png" }] });
        }
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  candidates: [
                    {
                      slot: "background",
                      assetKey: "world.background",
                      type: "image",
                      label: "星空背景",
                      prompt: "专业游戏背景图提示词：蓝紫色星云",
                      style: "科幻",
                      purpose: "游戏背景",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "player",
                      assetKey: "player.ship",
                      type: "image",
                      label: "太空猫飞船",
                      prompt: "专业角色素材提示词：透明背景飞船",
                      style: "可爱科幻",
                      purpose: "玩家角色",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "hazard",
                      assetKey: "hazard.enemy",
                      type: "image",
                      label: "陨石障碍",
                      prompt: "专业障碍物提示词：红色边缘陨石",
                      style: "街机",
                      purpose: "危险物",
                      acceptedFileTypes: ["image/*"]
                    },
                    {
                      slot: "collectible",
                      assetKey: "item.collectible",
                      type: "image",
                      label: "鱼干能量",
                      prompt: "专业收集物提示词：发光鱼干图标",
                      style: "可爱",
                      purpose: "得分道具",
                      acceptedFileTypes: ["image/*"]
                    }
                  ]
                })
              }
            }
          ]
        });
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0)
      }))
    );

    const response = await handler({
      method: "POST",
      path: "/api/asset-candidates",
      body: {
        idea: "做一个太空猫躲避游戏",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    const background = response.body.assetCandidates.candidates[0];
    expect(background.fileUrl).toBe("");
    expect(background.source).toBe("generated");
    expect(background.error).toContain("Remote image could not be localized");
    expect(response.body.confirmedAssets.assets).toHaveLength(0);
  });

  it("records revision analysis instead of silently appending follow-up text", async () => {
    const handler = createGenerationApiHandler({
      env: { DEEPSEEK_API_KEY: "server-key" },
      storeIO: memoryStore(),
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  understoodChange: "玩家希望失败后立刻重开，并强化陨石危险反馈。",
                  updatedDeveloperPrompt: "在 top_down 模板中增加失败重开提示和陨石碰撞反馈。",
                  confirmationQuestions: [
                    {
                      id: "restart_feedback",
                      label: "失败反馈",
                      prompt: "失败后是自动重开还是显示重开按钮？",
                      inputType: "single_choice",
                      options: ["显示重开按钮", "自动重开"],
                      defaultAnswer: "显示重开按钮",
                      required: true
                    }
                  ],
                  affectedAssets: ["hazard.asteroid", "sfx.hit"],
                  risks: []
                })
              }
            }
          ]
        })
    });

    const response = await handler({
      method: "POST",
      path: "/api/revision-analysis",
      body: {
        idea: "做一个太空猫躲避游戏",
        followup: "失败后要马上能重开，陨石碰撞要更明显",
        templateFamily: "top_down",
        model: "deepseek-v4-flash",
        designBrief: designBriefFixture()
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.revisionAnalysis.updatedDeveloperPrompt).toContain("失败重开");
    expect(response.body.revisionAnalysis.confirmationQuestions[0].label).toBe("失败反馈");
    expect(response.body.fallbackUsed).toBe(false);
  });

  it("persists design brief and confirmed assets in generated playable artifacts", async () => {
    const handler = createGenerationApiHandler({
      env: { DATA_DIR: "data-api-test", PUBLIC_BASE_URL: "https://wow-game.example" },
      storeIO: memoryStore()
    });

    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "做一个太空猫躲避游戏",
        answers: [],
        templateFamily: "top_down",
        projectId: "project-creative-chain",
        model: "mock-designer",
        designBrief: designBriefFixture(),
        confirmedAssets: confirmedAssetsFixture(),
        revisionHistory: [
          {
            understoodChange: "加强碰撞反馈",
            updatedDeveloperPrompt: "强化 sfx.hit 和 hazard.asteroid",
            confirmationQuestions: [],
            affectedAssets: ["sfx.hit"],
            risks: []
          }
        ]
      }
    });

    const artifactNames = response.body.project.artifacts.map((artifact: { fileName: string }) => artifact.fileName);

    expect(response.status).toBe(200);
    expect(artifactNames).toContain("design-brief.json");
    expect(artifactNames).toContain("developer-prompt.md");
    expect(artifactNames).toContain("confirmed-assets.json");
    expect(artifactNames).toContain("revision-analysis.json");
    expect(response.body.project.assetPack.assets.find((asset: { assetKey: string }) => asset.assetKey === "player.ship").source).toBe(
      "generated"
    );
  });

  it("defines strict JSON prompts for design brief, asset prompts, and revision analysis", () => {
    expect(createPromptForTask("llm.design_brief", { idea: "space cat" })).toContain("Task: llm.design_brief");
    expect(createPromptForTask("llm.asset_prompts", { idea: "space cat" })).toContain("asset candidates");
    expect(createPromptForTask("llm.revision_analysis", { followup: "make it harder" })).toContain(
      "Task: llm.revision_analysis"
    );
  });
});

