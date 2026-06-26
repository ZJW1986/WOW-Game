import { createGenerationApiHandler } from "./src/services/generationApi.ts";

const storeIO = {
  writeText: async () => undefined,
  readText: async () => null,
  writeBytes: async () => undefined,
  readBytes: async () => null,
  ensureDir: async () => undefined
};

const confirmedAssets = {
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
      previewUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAYAAAA/xl1SAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAB5ElEQVR4nO2UQQ3AQACDTgLPSZh/gzcZawIPDBTSw/PeaAN+2uAUX/Hx4wYFWIC3AIvgWjfoAQckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQg5gOqgqAIWd2xAAAAAABJRU5ErkJggg==",
      fileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAYAAAA/xl1SAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAB5ElEQVR4nO2UQQ3AQACDTgLPSZh/gzcZawIPDBTSw/PeaAN+2uAUX/Hx4wYFWIC3AIvgWjfoAQckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQgpgAHJCCmAAckIKYAByQg5gOqgqAIWd2xAAAAAABJRU5ErkJggg==",
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
      previewUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
      fileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
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
      previewUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
      fileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
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
      previewUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
      fileUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPklEQVRYhe3WuQ0AIAgAQAahYgD23w53MEYt7hJ6Et4I4GdZPSdCAqEEu1ITljFsi2is4nSMyjnudw8JEBcsSU/LfEihZm0AAAAASUVORK5CYII=",
      source: "generated",
      approvalStatus: "approved"
    }
  ]
};

const handler = createGenerationApiHandler({
  env: { DEEPSEEK_API_KEY: "server-key", PUBLIC_BASE_URL: "https://wow-game.example" },
  storeIO,
  fetcher: async ({ init }) => {
    const body = JSON.parse(init.body);
    const prompt = body.messages.at(-1)?.content ?? "";
    const content = prompt.includes("llm.classification")
      ? {
          templateFamily: "top_down",
          reasons: ["top-down movement and collision are the dominant mechanics"],
          risks: [],
          unsupportedRequests: []
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
    confirmedAssets
  }
});

console.log(JSON.stringify(response, null, 2));
