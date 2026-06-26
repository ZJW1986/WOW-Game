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
    expect(session.questions).toHaveLength(5);
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
                  reasons: ["top-down dodge and collect movement"],
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
      prompt: "鍒ゆ柇妯℃澘",
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
            reasons: ["platform jump and gravity rhythm are core mechanics"],
            risks: ["first version stays config driven"],
            unsupportedRequests: []
          };
        } else if (prompt.includes("llm.gdd")) {
          content = {
            concept: "Forest Jump",
            loop: ["start", "move", "jump", "collect", "reach finish"],
            entities: ["player", "coin", "spike", "finish flag"],
            level: { width: 960, height: 540, collectibles: 6, hazards: 3, winScore: 6 },
            numbers: { playerSpeed: 230, jumpVelocity: 430 },
            implementationRoute: "Use platformer Phaser template with config and asset references."
          };
        } else if (prompt.includes("llm.mature_game_brief")) {
          content = {
            referencePatternId: "pattern-platformer-first-run",
            coreLoop: ["safe start", "jump collect", "avoid spikes", "reach finish"],
            firstThirtySeconds: ["see coin route", "complete first jump", "meet spike", "approach finish"],
            visualTheme: "forest platformer with parallax background",
            feedbackChecklist: ["collect particles", "hit flash", "victory celebration"],
            difficultyCurve: ["teach", "add danger", "final gate"],
            gameFeelMoments: ["coin route", "landing feedback", "finish celebration"]
          };
        } else if (prompt.includes("llm.gameplay_dsl")) {
          content = {
            version: "1",
            rules: [
              { id: "score-wave", when: "score >= 2", do: "spawn_wave", enemyType: "charger", count: 2, message: "Charger enters" },
              { id: "time-reward", when: "timeMs >= 6000", do: "reward_burst", count: 2, message: "Reward route opened" }
            ]
          };
        } else if (prompt.includes("llm.game_hooks")) {
          content = {
            enemyRules: { movement: "patrol", speed: 140, waveIntervalMs: 0 },
            collectibleRules: { placement: "arc", value: 1, respawn: false },
            winCondition: { mode: "collect_score", target: 6 },
            failCondition: { mode: "hit_hazard", lives: 1 },
            numberTuning: { playerSpeed: 230, jumpVelocity: 430, hazardSpeed: 140 },
            levelLayout: {
              platforms: [
                { x: 480, y: 510, width: 920, height: 28 },
                { x: 360, y: 390, width: 180, height: 20 }
              ],
              lanes: [],
              grid: { columns: 0, rows: 0 }
            }
          };
        } else {
          content = {
            templateFamily: "platformer",
            title: "Forest Jump",
            pitch: "Platform jumping coin collection",
            playerGoal: "Collect 6 coins and reach the finish",
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
      idea: "Forest platformer collect coins",
      answers: [{ questionId: "goal", value: "Collect coins and reach finish", answeredAt: "2026-06-17T00:00:00.000Z" }],
      templateFamily: "platformer",
      projectId: "project-deepseek-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.classification.templateFamily).toBe("platformer");
    expect(result.project.gameConfig.title).toBe("Forest Jump");
    expect(result.modelTasks.map((task) => task.taskType)).toEqual([
      "llm.classification",
      "llm.mature_game_brief",
      "llm.gdd",
      "llm.game_config",
      "llm.game_hooks",
      "llm.gameplay_dsl"
    ]);
    expect(result.project.artifacts.map((artifact) => artifact.fileName)).toEqual(
      expect.arrayContaining(["game-hooks.json", "gameplay-dsl.json"])
    );
    expect(result.project.gameHooks.enemyRules.movement).toBe("patrol");
    expect(result.project.gameHooks.enemyArchetypes?.map((enemy) => enemy.type)).toContain("charger");
    expect(result.project.gameHooks.encounterTimeline?.map((event) => event.event)).toContain("reward_burst");
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
                      label: "Control Mode",
                      prompt: "How should the player control the hero?",
                      inputType: "single_choice",
                      options: ["Arrow keys", "WASD", "Mouse click"],
                      defaultAnswer: "Arrow keys",
                      required: true
                    },
                    {
                      id: "win_goal",
                      label: "Win Goal",
                      prompt: "What goal completes the level?",
                      inputType: "short_text",
                      defaultAnswer: "Collect six stars and reach the exit",
                      required: true
                    },
                    {
                      id: "fail_state",
                      label: "Fail State",
                      prompt: "What makes the player lose?",
                      inputType: "short_text",
                      defaultAnswer: "Hit an asteroid or lose all lives",
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
      idea: "spaceship dodge asteroids and collect stars",
      templateFamily: "top_down",
      projectId: "project-guided-1",
      model: "deepseek-v4-flash"
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.modelTask.taskType).toBe("llm.guided_questions");
    expect(result.questions.map((question) => question.prompt)).toContain("How should the player control the hero?");
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
      idea: "鍋氫竴涓鑸硅翰閬块櫒鐭冲苟鏀堕泦鏄熸槦鐨勫皬娓告垙",
      templateFamily: "top_down",
      model: "deepseek-v4-flash"
    });

    const visibleText = result.questions
      .flatMap((question) => [question.label, question.prompt, question.defaultAnswer, ...(question.options ?? [])])
      .join(" ");

    expect(visibleText).toMatch(/武器|敌机编队|弹幕|护盾|Boss/);
    expect(visibleText).not.toContain("请生成一款 2D Phaser 游戏");
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
      idea: "鍋氫竴涓í鐗堣烦璺冩敹闆嗛噾甯佺殑妫灄娓告垙",
      templateFamily: "platformer",
      model: "deepseek-v4-flash"
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0].prompt).toMatch(/跳跃|平台|检查点/);
    expect(result.questions.map((question) => question.prompt).join(" ")).toMatch(/隐藏奖励|移动平台|机关/);
  });

  it("falls back to mock artifacts when DeepSeek key is missing", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "鍋氫竴涓鑸硅翰閬块櫒鐭冲苟鏀堕泦鏄熸槦鐨勫皬娓告垙",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-fallback-1",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.gameConfig.templateFamily).toBe("top_down");
    expect(result.modelTasks).toHaveLength(6);
    expect(result.fallbacksUsed).toEqual([
      "llm.classification",
      "llm.mature_game_brief",
      "llm.gdd",
      "llm.game_config",
      "llm.game_hooks",
      "llm.gameplay_dsl"
    ]);
    expect(result.project.artifacts.map((artifact) => artifact.fileName)).toContain("gameplay-dsl.json");
    expect(result.project.gameHooks.encounterTimeline?.length).toBeGreaterThan(0);
  });

  it("repairs common DeepSeek near-miss JSON shapes before schema validation", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "top-down",
              reasons: "spaceship dodge is free movement collision gameplay",
              risks: "first version stays config driven",
              unsupportedRequests: ""
            }
          : prompt.includes("llm.gameplay_dsl")
            ? {
                version: "2",
                zones: [{ id: "asteroid-lane", x: 620, y: 120, width: 180, height: 280 }],
                rules: [
                  {
                    id: "score-pressure",
                    when: { type: "score", op: ">=", value: 2 },
                    do: [{ type: "spawn_zone", zoneId: "asteroid-lane", enemyType: "chaser", count: 2 }]
                  }
                ]
              }
          : prompt.includes("llm.gdd")
            ? {
                concept: "Star Route",
                loop: "start, move, dodge, collect, win",
                entities: [{ name: "ship" }, { name: "star" }, { name: "asteroid" }],
                level: "960x540, 6 collectibles, 4 hazards",
                numbers: { speed: 260 },
                implementationRoute: "Use top_down template and config hooks."
              }
            : {
                templateFamily: "top_down",
                title: "Star Route",
                pitch: "Spaceship dodges asteroids and collects stars",
                playerGoal: "Collect 6 stars",
                controls: "ArrowUp, ArrowDown, ArrowLeft, ArrowRight",
                difficulty: "medium",
                referencedAssetKeys: "cover.main, player.ship, world.background",
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "spaceship dodge asteroids and collect stars",
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
      "ArrowRight",
      "Space"
    ]);
    expect(result.project.gameConfig.difficulty).toBe("normal");
  });

  it("locks spaceship dodge collection ideas to top_down even if the model drifts to platformer", async () => {
    const service = createGenerationService({
      deepseekApiKey: "test-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        const content = prompt.includes("llm.classification")
          ? {
              templateFamily: "platformer",
              reasons: ["model drift"],
              risks: [],
              unsupportedRequests: []
            }
          : prompt.includes("llm.game_hooks")
            ? {
                enemyRules: { movement: "chase", speed: 140, waveIntervalMs: 1200 },
                collectibleRules: { placement: "line", value: 1, respawn: false },
                winCondition: { mode: "collect_score", target: 6 },
                failCondition: { mode: "hit_hazard", lives: 1 },
                numberTuning: { playerSpeed: 260, jumpVelocity: 0, hazardSpeed: 160 },
                levelLayout: { platforms: [], lanes: [{ y: 180, speed: 130, count: 2 }], grid: { columns: 0, rows: 0 } }
              }
            : {
                templateFamily: "platformer",
                title: "Space Dodge",
                pitch: "Spaceship dodges asteroids and collects stars",
                playerGoal: "Collect 6 stars",
                controls: ["ArrowLeft", "ArrowRight", "Space"],
                difficulty: "normal",
                referencedAssetKeys: ["player.ship", "world.background", "hazard.enemy", "item.collectible"],
                gameplay: {
                  primaryAction: "jump_reach_goal",
                  enemyBehavior: "patrol",
                  objectiveMode: "reach_exit",
                  playerAbility: "jump",
                  spawnPattern: "fixed"
                },
                level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
              };
        return JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "spaceship dodge asteroids and collect stars",
      answers: [],
      templateFamily: "top_down",
      projectId: "project-template-lock",
      baseUrl: "https://wow-game.example",
      model: "deepseek-v4-flash"
    });

    expect(result.project.classification.templateFamily).toBe("top_down");
    expect(result.project.gameConfig.templateFamily).toBe("top_down");
    expect(result.fallbacksUsed).toContain("template_drift_blocked");
  });

  it("generates a playable version with publish share metadata and a QR payload", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "Forest platformer collect coins",
      answers: [
        { questionId: "goal", value: "Collect coins and reach finish", answeredAt: "2026-06-17T00:00:00.000Z" }
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
