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
      assets: "资源库",
      code: "配置"
    },
    toolbar: {
      refresh: "刷新",
      console: "运行面板",
      fullscreen: "全屏"
    },
    start: {
      create: "创建",
      play: "PLAY",
      title: "从创意开始生成游戏",
      subtitlePrefix: "描述你的游戏，或",
      subtitleAction: "选择一个模板",
      dialogAria: "创建新游戏",
      modeAria: "创建或试玩",
      engine: "引擎",
      upload: "上传文件",
      uploadOptionsAria: "上传素材或游戏包",
      uploadMaterials: "上传素材",
      uploadMaterialsHint: "图片 / 音效 / BGM",
      uploadPackage: "上传 ZIP 游戏包",
      uploadPackageHint: "index.html 入口，只读上架",
      myProjects: "我的项目"
    },
    play: {
      search: "搜索",
      featured: "精选游戏",
      popular: "热门游戏",
      casual: "休闲游戏",
      advanced: "进阶游戏",
      uploaded: "上传试玩",
      viewMore: "查看更多",
      plays: "游玩",
      likes: "喜欢"
    },
    projects: {
      title: "我的项目",
      subtitle: "管理 AI 生成项目和上传试玩包，随时进入体验或继续迭代。",
      welcomeLabel: "欢迎语",
      shareProfile: "分享主页",
      tipsTitle: "开启 Tips",
      tipsDescription: "允许喜欢你游戏的玩家支持你，当前为站内 MVP 模拟。",
      enableTips: "开启 Tips",
      filter: "筛选",
      sort: "排序",
      all: "全部",
      published: "已发布",
      draft: "草稿",
      private: "私密",
      public: "公开",
      unlisted: "未列出",
      lastModified: "最近修改",
      mostPlayed: "最多游玩",
      nameSort: "名称",
      perPage: "每页",
      page: "第",
      countSuffix: "个项目",
      edit: "编辑",
      duplicate: "复制副本",
      run: "运行",
      delete: "删除",
      readOnly: "只读",
      experience: "体验"
    },
    agent: {
      pipelineLabel: "AI 对话",
      thinking: "AI 正在确认玩法方向",
      readySuffix: "首版方案",
      intro: "我会先和你确认玩法、目标、操作方式和失败条件。信息足够后，生成游戏按钮会亮起。",
      actionHazards: "识别玩法边界",
      actionCheckpoints: "生成方案摘要",
      actionPickupCue: "准备资源任务",
      closedLoop: "第一阶段闭环",
      gdd: "方案推演",
      classified: "模板分类",
      generatedAssets: "资源条目",
      runtime: "运行验证",
      suggestionLabel: "迭代建议",
      suggestion: "发布试玩后，可根据玩家反馈生成下一版优化建议。",
      continue: "继续"
    },
    chat: {
      readyMeta: "可以生成",
      userIdeaMeta: "创意需求",
      answerMeta: "你的回答",
      followupMeta: "补充需求"
    },
    thinking: {
      eyebrow: "对话确认",
      title: "确认首版游戏方向",
      steps: {
        idea: "理解创意",
        physics: "玩法分类",
        gdd: "方案摘要",
        assets: "资源准备",
        config: "玩法配置",
        ready: "等待确认"
      },
      details: {
        idea: "提取核心体验、目标和约束",
        gdd: "整理玩法循环、角色、关卡和数值方向",
        assets: "资源细节将进入右侧资源库",
        ready: "同意方案或补充需求"
      },
      template: "模板",
      goal: "目标",
      controls: "操作",
      assets: "资源",
      addRequirement: "补充需求",
      approve: "生成游戏",
      revisionTitle: "补充你的需求",
      revisionPlaceholder: "例如：敌人节奏更快、画面偏银白色、失败后给玩家一次护盾机会...",
      clear: "清空",
      resimulate: "重新推演",
      generatingTitle: "正在生成游戏",
      generatingDetail: "生成完成后会在右侧出现可操作的首版游戏。",
      completeTitle: "首版游戏已生成",
      completeDetail: "请在右侧预览试玩，也可以继续补充需求迭代。",
      statusThinking: "确认中",
      statusProposal: "可生成",
      statusGenerating: "生成中",
      statusComplete: "可试玩",
      statusRevision: "补充中"
    },
    prompt: {
      defaultIdea: "做一个霓虹飞船躲避陨石并收集星星的小游戏。",
      aria: "给 WOW Game 智能体补充需求",
      placeholder: "告诉 WOW Game 你想做什么游戏...",
      followupPlaceholder: "输入回答或补充新需求...",
      sendFollowup: "提交",
      generateNext: "生成游戏",
      localEngine: "本地体验引擎"
    },
    preview: {
      generated: "可试玩体验 v1",
      verification: "体验状态",
      build: "构建",
      visual: "视觉",
      intent: "意图",
      cookingEyebrow: "生成中",
      cookingTitle: "正在生成你的游戏",
      cookingSubtitle: "We're cooking...",
      cookingDetail: "正在生成玩法配置、资源清单和可试玩预览。"
    },
    assets: {
      generatedAsset: "生成资源",
      prompt: "提示词",
      description: "描述",
      mode: "生成方式",
      copyright: "版权状态",
      folder: "资源库",
      upload: "上传",
      create: "生成",
      regenerate: "重新生成",
      regenerateMissing: "补齐缺失",
      search: "搜索资源",
      ready: "就绪",
      details: "详情",
      back: "返回",
      provider: "Provider",
      model: "Model",
      audio: "Audio"
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
      assets: "Asset Hub",
      code: "Config"
    },
    toolbar: {
      refresh: "Refresh",
      console: "Runtime panel",
      fullscreen: "Fullscreen"
    },
    start: {
      create: "Create",
      play: "PLAY",
      title: "Create from Scratch",
      subtitlePrefix: "Describe your game below, or",
      subtitleAction: "pick a template",
      dialogAria: "Create new game",
      modeAria: "Create or play",
      engine: "Engine",
      upload: "Upload file",
      uploadOptionsAria: "Upload materials or game package",
      uploadMaterials: "Upload assets",
      uploadMaterialsHint: "Images / SFX / BGM",
      uploadPackage: "Upload ZIP game",
      uploadPackageHint: "index.html entry, read-only",
      myProjects: "My Projects"
    },
    play: {
      search: "Search",
      featured: "Featured games",
      popular: "Popular games",
      casual: "Casual Games",
      advanced: "Advanced Games",
      uploaded: "Uploaded playables",
      viewMore: "View more",
      plays: "plays",
      likes: "likes"
    },
    projects: {
      title: "My Projects",
      subtitle: "Manage AI-generated projects and uploaded playable packs in one place.",
      welcomeLabel: "Welcome message",
      shareProfile: "Share profile",
      tipsTitle: "Enable Tips",
      tipsDescription: "Let players support games they enjoy; shown as a local MVP simulation.",
      enableTips: "Enable Tips",
      filter: "Filter",
      sort: "Sort",
      all: "All",
      published: "Published",
      draft: "Draft",
      private: "Private",
      public: "Public",
      unlisted: "Unlisted",
      lastModified: "Last modified",
      mostPlayed: "Most played",
      nameSort: "Name",
      perPage: "Per page",
      page: "Page",
      countSuffix: "projects",
      edit: "Edit",
      duplicate: "Duplicate",
      run: "Run",
      delete: "Delete",
      readOnly: "Read only",
      experience: "Play"
    },
    agent: {
      pipelineLabel: "AI chat",
      thinking: "AI is confirming gameplay direction",
      readySuffix: "first playable plan",
      intro: "I will confirm gameplay, goals, controls, and failure rules with you first. When enough details are ready, the generate button lights up.",
      actionHazards: "Map gameplay boundaries",
      actionCheckpoints: "Create plan summary",
      actionPickupCue: "Prepare resource tasks",
      closedLoop: "Stage-one loop",
      gdd: "Plan reasoning",
      classified: "Template family",
      generatedAssets: "Asset items",
      runtime: "Runtime validation",
      suggestionLabel: "Iteration advice",
      suggestion: "After publishing, use player feedback to produce the next optimization pass.",
      continue: "Continue"
    },
    chat: {
      readyMeta: "Ready",
      userIdeaMeta: "Game brief",
      answerMeta: "Your answer",
      followupMeta: "Follow-up"
    },
    thinking: {
      eyebrow: "Conversation",
      title: "Confirm first playable direction",
      steps: {
        idea: "Understand intent",
        physics: "Classify play",
        gdd: "Plan summary",
        assets: "Prepare assets",
        config: "Gameplay config",
        ready: "Await approval"
      },
      details: {
        idea: "Extract core experience, goals, and constraints",
        gdd: "Shape loop, entities, level, and numbers",
        assets: "Resource details stay in the Asset Hub",
        ready: "Approve or add requirements"
      },
      template: "Template",
      goal: "Goal",
      controls: "Controls",
      assets: "Assets",
      addRequirement: "Add requirement",
      approve: "Generate game",
      revisionTitle: "Add your requirement",
      revisionPlaceholder: "Example: faster enemies, silver-white art direction, one shield after failure...",
      clear: "Clear",
      resimulate: "Rerun reasoning",
      generatingTitle: "Generating game",
      generatingDetail: "A playable first version will appear on the right when ready.",
      completeTitle: "First playable generated",
      completeDetail: "Play the preview on the right or add more requirements to iterate.",
      statusThinking: "Chatting",
      statusProposal: "Ready",
      statusGenerating: "Cooking",
      statusComplete: "Playable",
      statusRevision: "Revising"
    },
    prompt: {
      defaultIdea: "Create a neon spaceship dodge game where the player avoids asteroids and collects stars.",
      aria: "Add requirements for WOW Game Agent",
      placeholder: "Tell WOW Game what game you want to make...",
      followupPlaceholder: "Type an answer or add a new requirement...",
      sendFollowup: "Submit",
      generateNext: "Generate game",
      localEngine: "Local Experience Engine"
    },
    preview: {
      generated: "Playable experience v1",
      verification: "Experience status",
      build: "Build",
      visual: "Visual",
      intent: "Intent",
      cookingEyebrow: "Generating",
      cookingTitle: "Generating your game",
      cookingSubtitle: "We're cooking...",
      cookingDetail: "Creating gameplay config, asset manifest, and playable preview."
    },
    assets: {
      generatedAsset: "Generated asset",
      prompt: "Prompt",
      description: "Description",
      mode: "Mode",
      copyright: "Copyright",
      folder: "Asset Hub",
      upload: "Upload",
      create: "Create",
      regenerate: "Regenerate",
      regenerateMissing: "Regenerate missing",
      search: "Search assets",
      ready: "ready",
      details: "Details",
      back: "Back",
      provider: "Provider",
      model: "Model",
      audio: "Audio"
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
