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
      readySuffix: "可试玩方案",
      intro:
        "我会先按 Physics-First 规则拆解创意，形成标准 GDD、资源协议和模板配置。确认方案后，再进入图片、音效、BGM 与特效资源生成。",
      actionHazards: "风险与边界识别",
      actionCheckpoints: "标准产物链路",
      actionPickupCue: "资源生成准备",
      closedLoop: "第一阶段闭环产物",
      gdd: "标准 GDD",
      classified: "模板分类",
      generatedAssets: "资源包条目",
      runtime: "运行验证",
      suggestionLabel: "迭代建议",
      suggestion: "发布试玩后，根据玩家反馈生成下一版修改建议，并保留版本记录。",
      continue: "继续"
    },
    thinking: {
      eyebrow: "模型深度思考中",
      title: "从创意推导可执行生产方案",
      steps: {
        idea: "理解创意目标",
        physics: "Physics-First 分类",
        gdd: "生成技术 GDD",
        assets: "拆解资源协议",
        config: "规划玩法配置",
        ready: "准备确认方案"
      },
      details: {
        idea: "提取核心体验、玩家目标与限制条件",
        gdd: "概念、循环、实体、关卡、数值、实现路线",
        config: "锁定 Phaser 模板、配置字段与可扩展 Hook",
        ready: "等待用户同意或补充需求"
      },
      template: "模板",
      goal: "胜利目标",
      controls: "操作方式",
      assets: "资源需求",
      addRequirement: "补充需求",
      approve: "同意方案，下一步生成",
      revisionTitle: "补充你的需求",
      revisionPlaceholder: "例如：敌人节奏更快、画面偏银白色、失败后给玩家一次护盾机会...",
      clear: "清空",
      resimulate: "重新推演",
      generatingTitle: "正在调用资源与代码生成任务",
      generatingDetail: "生成图片、音效、BGM、特效占位与可试玩构建",
      completeTitle: "资源与试玩版本已生成",
      completeDetail: "右侧可预览游戏，也可以进入资源库检查素材。"
    },
    prompt: {
      defaultIdea: "做一个霓虹飞船躲避陨石并收集星星的小游戏。",
      aria: "给 WOW Game 智能体补充需求",
      placeholder: "告诉 WOW Game 你想做什么游戏...",
      followupPlaceholder: "补充需求或修改意见，发送后模型会重新推演方案...",
      sendFollowup: "发送补充",
      generateNext: "下一步生成"
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
      copyright: "版权状态",
      folder: "assets",
      upload: "上传",
      create: "生成",
      regenerate: "重新生成",
      regenerateMissing: "补齐缺失",
      search: "搜索资源",
      ready: "就绪",
      details: "详情"
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
      thinking: "Reasoning through the plan...",
      readySuffix: "playable plan",
      intro:
        "I first convert the idea into a physics-first plan, standard GDD, asset protocol, and template config. After approval, I start image, audio, BGM, VFX, and playable generation.",
      actionHazards: "Risk and boundary scan",
      actionCheckpoints: "Standard artifact chain",
      actionPickupCue: "Resource generation prep",
      closedLoop: "Stage-one closed loop",
      gdd: "Standard GDD",
      classified: "Template family",
      generatedAssets: "Asset pack items",
      runtime: "Runtime verification",
      suggestionLabel: "Iteration advice",
      suggestion: "After publishing, use player feedback to produce the next-version plan while preserving version history.",
      continue: "Continue"
    },
    thinking: {
      eyebrow: "Model deep thinking",
      title: "Deriving an executable production plan",
      steps: {
        idea: "Understand intent",
        physics: "Physics-first classification",
        gdd: "Technical GDD",
        assets: "Asset protocol",
        config: "Gameplay config",
        ready: "Proposal ready"
      },
      details: {
        idea: "Extract core experience, player goal, and constraints",
        gdd: "Concept, loop, entities, levels, numbers, route",
        config: "Lock Phaser template, config fields, and hooks",
        ready: "Waiting for approval or extra requirements"
      },
      template: "Template",
      goal: "Goal",
      controls: "Controls",
      assets: "Assets",
      addRequirement: "Add requirement",
      approve: "Approve and generate",
      revisionTitle: "Add your requirement",
      revisionPlaceholder: "Example: faster enemies, silver-white art direction, one shield after failure...",
      clear: "Clear",
      resimulate: "Rerun reasoning",
      generatingTitle: "Calling resource and code generation",
      generatingDetail: "Producing image, SFX, BGM, VFX placeholders, and a playable build",
      completeTitle: "Resources and playable version generated",
      completeDetail: "Preview the game on the right or inspect assets in the asset hub."
    },
    prompt: {
      defaultIdea:
        "Create a neon spaceship dodge game where the player avoids asteroids and collects stars.",
      aria: "Add requirements for WOW Game Agent",
      placeholder: "Tell WOW Game what game you want to make...",
      followupPlaceholder: "Add requirements or edits. The model will rerun the plan...",
      sendFollowup: "Send",
      generateNext: "Generate next"
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
      copyright: "Copyright",
      folder: "assets",
      upload: "Upload",
      create: "Create",
      regenerate: "Regenerate",
      regenerateMissing: "Regenerate missing",
      search: "Search assets",
      ready: "ready",
      details: "Details"
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
