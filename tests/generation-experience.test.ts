import { describe, expect, it } from "vitest";
import { createConversationSession } from "../src/core/conversation";
import { runMockPipeline } from "../src/core/pipeline";
import { createStartGameDraft } from "../src/core/start";
import { createDeepSeekExecutor } from "../src/services/deepSeekExecutor";
import { createGenerationService } from "../src/services/generationService";
import { containsMojibake } from "./mojibake";

describe("fast playable generation experience", () => {
  it("starts a guided session from the create draft without skipping questions", () => {
    const draft = createStartGameDraft({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      model: "deepseek-v4-flash",
      templateFamily: "top_down"
    });
    const session = createConversationSession(draft.idea, {
      projectId: "project-fast-1",
      preferredTemplate: draft.templateFamily
    });

    expect(session.projectId).toBe("project-fast-1");
    expect(session.stage).toBe("guided_questions");
    expect(session.questions).toHaveLength(4);
    expect(session.turns.map((turn) => turn.content).join(" ")).toContain("关键问题");
  });

  it("executes DeepSeek-compatible json requests and validates output", async () => {
    const executor = createDeepSeekExecutor({
      apiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  templateFamily: "top_down",
                  reasons: ["飞船躲避陨石是俯视角移动与碰撞玩法"],
                  risks: [],
                  unsupportedRequests: []
                })
              }
            }
          ]
        })
    });

    const result = await executor.runJsonTask({
      taskType: "llm.classification",
      prompt: "判断模板",
      model: "deepseek-v4-flash"
    });

    expect(result.status).toBe("success");
    expect(result.rawJson).toContain("top_down");
  });

  it("uses DeepSeek model tasks for classification, GDD, and game config when configured", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        let content: unknown;
        if (prompt.includes("llm.classification")) {
          content = {
            templateFamily: "platformer",
            reasons: ["横版跳跃和重力节奏是核心机制"],
            risks: ["第一版只支持配置驱动关卡"],
            unsupportedRequests: []
          };
        } else if (prompt.includes("llm.gdd")) {
          content = {
            concept: "跃动森林",
            loop: ["开始", "移动", "跳跃", "收集", "抵达终点"],
            entities: ["玩家", "金币", "尖刺", "终点旗"],
            level: { width: 960, height: 540, collectibles: 6, hazards: 3, winScore: 6 },
            numbers: { playerSpeed: 230, jumpVelocity: 430 },
            implementationRoute: "使用 platformer Phaser 模板，只生成配置和资源引用。"
          };
        } else {
          content = {
            templateFamily: "platformer",
            title: "跃动森林",
            pitch: "横版跳跃收集金币",
            playerGoal: "收集 6 枚金币并抵达终点",
            controls: ["ArrowLeft", "ArrowRight", "Space"],
            difficulty: "normal",
            referencedAssetKeys: ["cover.main", "ui.button", "player.hero", "world.tiles"],
            level: { width: 960, height: 540, collectibles: 6, hazards: 3, winScore: 6 }
          };
        }
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "做一个横版跳跃收集金币的森林游戏",
      answers: [{ questionId: "goal", value: "收集金币并到达终点", answeredAt: "2026-06-17T00:00:00.000Z" }],
      templateFamily: "platformer",
      projectId: "project-deepseek-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.classification.templateFamily).toBe("platformer");
    expect(result.project.gameConfig.title).toBe("跃动森林");
    expect(result.modelTasks.map((task) => task.taskType)).toEqual([
      "llm.classification",
      "llm.gdd",
      "llm.game_config"
    ]);
    expect(result.modelTasks.every((task) => task.status === "success")).toBe(true);
    expect(result.fallbacksUsed).toEqual([]);
  });

  it("uses DeepSeek to generate guided questions when the model returns a valid artifact", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      id: "control_mode",
                      label: "操作方式",
                      prompt: "玩家主要如何操作角色？",
                      inputType: "single_choice",
                      options: ["方向键移动", "WASD 移动", "鼠标点击"],
                      defaultAnswer: "方向键移动",
                      required: true
                    },
                    {
                      id: "win_goal",
                      label: "胜利目标",
                      prompt: "玩家完成什么目标后胜利？",
                      inputType: "short_text",
                      defaultAnswer: "收集 6 颗星星并到达出口",
                      required: true
                    },
                    {
                      id: "fail_state",
                      label: "失败条件",
                      prompt: "玩家遇到什么情况会失败？",
                      inputType: "short_text",
                      defaultAnswer: "碰到陨石或生命值耗尽",
                      required: true
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const result = await service.generateGuidedQuestions({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      templateFamily: "top_down",
      projectId: "project-guided-1",
      model: "deepseek-v4-flash"
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.modelTask.taskType).toBe("llm.guided_questions");
    expect(result.questions.map((question) => question.prompt)).toContain("玩家主要如何操作角色？");
  });

  it("keeps guided questions in Chinese when the model returns English copy for a Chinese idea", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      id: "controls",
                      label: "Controls",
                      prompt: "How will the player move the spaceship?",
                      inputType: "single_choice",
                      options: ["Arrow keys", "Mouse click/touch", "Tilt (mobile)"],
                      defaultAnswer: "Arrow keys",
                      required: true
                    },
                    {
                      id: "goal",
                      label: "Goal",
                      prompt: "What should the player collect?",
                      inputType: "short_text",
                      defaultAnswer: "Collect six stars",
                      required: true
                    },
                    {
                      id: "failure",
                      label: "Failure",
                      prompt: "What makes the player lose?",
                      inputType: "short_text",
                      defaultAnswer: "Hit asteroids",
                      required: true
                    }
                  ]
                })
              }
            }
          ]
        })
    });

    const result = await service.generateGuidedQuestions({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      templateFamily: "top_down",
      model: "deepseek-v4-flash"
    });

    const visibleText = result.questions
      .flatMap((question) => [question.label, question.prompt, question.defaultAnswer, ...(question.options ?? [])])
      .join(" ");

    expect(visibleText).toContain("玩家怎样算赢？");
    expect(visibleText).not.toContain("How will the player move");
    expect(visibleText).not.toContain("Arrow keys");
  });

  it("falls back to fixed guided questions when model question output is invalid", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ questions: [{ prompt: "" }] }) } }]
        })
    });

    const result = await service.generateGuidedQuestions({
      idea: "做一个横版跳跃收集金币的森林游戏",
      templateFamily: "platformer",
      model: "deepseek-v4-flash"
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.questions).toHaveLength(4);
    expect(result.questions[0].prompt).toBe("玩家怎样算赢？");
    expect(result.questions[0].defaultAnswer).toContain("金币");
  });

  it("falls back to mock artifacts when DeepSeek key is missing", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-fallback-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.gameConfig.templateFamily).toBe("top_down");
    expect(result.modelTasks).toHaveLength(3);
    expect(result.fallbacksUsed).toEqual([
      "llm.classification",
      "llm.gdd",
      "llm.game_config"
    ]);
  });

  it("repairs common DeepSeek near-miss JSON shapes before schema validation", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "俯视角",
              reasons: "飞船躲避陨石是自由移动碰撞玩法",
              risks: "第一版只支持配置驱动",
              unsupportedRequests: ""
            }
          : prompt.includes("llm.gdd")
            ? {
                concept: "星尘航线",
                loop: "开始, 移动, 躲避, 收集, 胜利",
                entities: [{ name: "飞船" }, { name: "星星" }, { name: "陨石" }],
                level: "960x540, 6 collectibles, 4 hazards",
                numbers: { speed: 260 },
                implementationRoute: "使用 top_down 模板和配置驱动关卡。"
              }
            : {
                templateFamily: "top_down",
                title: "星尘航线",
                pitch: "飞船躲避陨石并收集星星",
                playerGoal: "收集 6 颗星星",
                controls: "ArrowUp, ArrowDown, ArrowLeft, ArrowRight",
                difficulty: "中等",
                referencedAssetKeys: "cover.main, player.ship, world.background",
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "做一个飞船躲避陨石并收集星星的小游戏",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-repair-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.fallbacksUsed).toEqual([]);
    expect(result.project.classification.templateFamily).toBe("top_down");
    expect(result.project.gameConfig.controls).toEqual([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight"
    ]);
    expect(result.project.gameConfig.difficulty).toBe("normal");
  });

  it("generates a playable version with publish share metadata and a QR payload", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "做一个横版跳跃收集金币的森林游戏",
      answers: [
        { questionId: "goal", value: "收集金币并到达终点", answeredAt: "2026-06-17T00:00:00.000Z" }
      ],
      templateFamily: "platformer",
      projectId: "project-share-1",
      baseUrl: "https://wow-game.example"
    });

    expect(result.version.status).toBe("published");
    expect(result.project.gameConfig.templateFamily).toBe("platformer");
    expect(result.publishRecord.publicUrl).toBe("https://wow-game.example/play/project-share-1/v1");
    expect(result.share.qrPayload).toContain(result.publishRecord.publicUrl);
    expect(result.share.webShareData.title).toContain("WOW Game");
  });

  it("keeps generated UI-facing strings free from mojibake", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const visibleText = [
      project.title,
      project.feedback.comment,
      project.feedback.iterationSuggestion,
      ...project.artifacts.map((artifact) => String(artifact.content))
    ].join(" ");

    expect(containsMojibake(visibleText)).toBe(false);
  });
});
