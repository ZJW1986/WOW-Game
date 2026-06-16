export const supportedLocales = ["zh-CN", "en-US"] as const;

export type Locale = (typeof supportedLocales)[number];

export const messages = {
  "zh-CN": {
    brand: {
      agent: "WOW Game 智能体",
      projectTitle: "当前项目",
      upgrade: "升级",
      share: "分享"
    },
    tabs: {
      preview: "预览",
      assets: "资源",
      code: "代码"
    },
    toolbar: {
      refresh: "刷新",
      console: "运行控制台",
      fullscreen: "全屏"
    },
    agent: {
      pipelineLabel: "模板流水线",
      thinking: "正在推演方案...",
      readySuffix: "已生成可试玩版本",
      intro:
        "我已完成 Physics-First 分类，生成标准产物，绑定资源包，并组装出 Phaser 可试玩构建。",
      actionHazards: "强化危险物表现",
      actionCheckpoints: "增加关卡检查点",
      actionPickupCue: "让收集反馈更醒目",
      closedLoop: "已完成第一阶段闭环...",
      gdd: "生成标准 GDD",
      classified: "完成模板分类",
      generatedAssets: "生成资源",
      runtime: "运行检查完成",
      suggestionLabel: "建议下一步提示词：",
      suggestion: "增加第二个关卡，强化科幻反馈，并加入一个新的奖励机制",
      continue: "继续下一步"
    },
    prompt: {
      defaultIdea: "做一个霓虹飞船躲避陨石并收集星星的小游戏。",
      aria: "询问 WOW Game 智能体",
      placeholder: "询问 WOW Game，或拖拽、粘贴图片作为参考"
    },
    preview: {
      generated: "已生成可试玩 v1",
      verification: "验证报告",
      build: "构建",
      visual: "视觉",
      intent: "意图"
    },
    assets: {
      generatedAsset: "生成资源",
      prompt: "提示词",
      description: "描述",
      mode: "生成方式",
      copyright: "版权状态"
    },
    code: {
      artifacts: "标准产物",
      gameConfig: "游戏配置"
    }
  },
  "en-US": {
    brand: {
      agent: "WOW Game Agent",
      projectTitle: "Current project",
      upgrade: "Upgrade",
      share: "Share"
    },
    tabs: {
      preview: "Preview",
      assets: "Assets",
      code: "Code"
    },
    toolbar: {
      refresh: "Refresh",
      console: "Runtime console",
      fullscreen: "Fullscreen"
    },
    agent: {
      pipelineLabel: "template pipeline",
      thinking: "Mulling it over...",
      readySuffix: "is ready to play",
      intro:
        "I classified the idea with a physics-first pass, generated standard artifacts, attached a mock asset pack, and assembled a Phaser playable build.",
      actionHazards: "Make hazards more dramatic",
      actionCheckpoints: "Add checkpoints between sections",
      actionPickupCue: "Give every pickup a brighter cue",
      closedLoop: "Created the first closed loop...",
      gdd: "Generated standard GDD",
      classified: "Classified template",
      generatedAssets: "Generated assets",
      runtime: "Runtime check completed",
      suggestionLabel: "Suggested next step prompt:",
      suggestion: "Add a second level with stronger sci-fi feedback and one new reward mechanic",
      continue: "Continue with next step"
    },
    prompt: {
      defaultIdea:
        "Create a neon spaceship dodge game where the player avoids asteroids and collects stars.",
      aria: "Ask WOW Game Agent",
      placeholder: "Ask WOW Game, or drag, drop, or paste an image"
    },
    preview: {
      generated: "Generated playable v1",
      verification: "Verification",
      build: "Build",
      visual: "Visual",
      intent: "Intent"
    },
    assets: {
      generatedAsset: "Generated asset",
      prompt: "Prompt",
      description: "Description",
      mode: "Mode",
      copyright: "Copyright"
    },
    code: {
      artifacts: "Standard Artifacts",
      gameConfig: "Game Config"
    }
  }
} as const;

export type Messages = (typeof messages)[Locale];

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
