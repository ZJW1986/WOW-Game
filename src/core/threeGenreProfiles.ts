import type { DesignQuestion, ThreeGameGenre, ThreeSceneDirector } from "./types";

export interface ThreeGenreProfile {
  id: ThreeGameGenre;
  label: string;
  genreIntent: string;
  modelDirection: {
    player: string;
    hazard: string;
    collectible: string;
  };
  runtimeDifferentiators: string[];
  questions: DesignQuestion[];
  brief: {
    cameraIntent: string;
    movementIntent: string;
    spaceLayout: string;
    coreLoop: string[];
    assetNeeds: string[];
  };
  director: Omit<ThreeSceneDirector, "title">;
}

export const THREE_GENRE_PROFILES: Record<ThreeGameGenre, ThreeGenreProfile> = {
  flight_shooter: {
    id: "flight_shooter",
    label: "飞行射击",
    genreIntent: "追尾飞行视角下躲避前方障碍，收集能量并承受逐步增强的飞行压力。",
    modelDirection: {
      player: "low-poly spaceship or aircraft hero, directional nose, readable wings, mobile game silhouette",
      hazard: "low-poly asteroid field or hostile drone obstacle, rough silhouette, clear collision threat",
      collectible: "glowing energy core collectible, bright sci-fi pickup, readable from a chase camera"
    },
    runtimeDifferentiators: ["follow_chase camera", "forward flight corridor", "asteroid and drone waves"],
    questions: [
      {
        id: "three_camera",
        label: "3D视角与镜头",
        prompt: "手机 3D 飞行游戏里镜头如何表现速度、前方障碍和能量目标？",
        inputType: "single_choice",
        options: ["追尾飞行镜头，前方陨石和能量清晰可见", "轻俯视飞行镜头，左右躲避更准确", "固定航线镜头，突出高速冲刺"],
        defaultAnswer: "追尾飞行镜头，前方陨石和能量清晰可见",
        required: true
      },
      {
        id: "three_controls",
        label: "飞行操作",
        prompt: "飞船或飞机应该怎样移动，才能让玩家快速理解躲避和收集？",
        inputType: "single_choice",
        options: ["自动向前飞行，玩家控制上下左右微调", "左右拖动躲避，速度自动提升", "方向键自由飞行，空格短冲刺"],
        defaultAnswer: "自动向前飞行，玩家控制上下左右微调",
        required: true
      },
      {
        id: "three_space_route",
        label: "航线节奏",
        prompt: "前 30 秒的飞行航线如何安排陨石、无人机和能量奖励？",
        inputType: "single_choice",
        options: ["5秒学习飞行，15秒陨石密度增加，最后10秒无人机夹击", "能量排成弧线，危险物从远处预警进入", "窄航道高速穿越，奖励放在高风险区域"],
        defaultAnswer: "5秒学习飞行，15秒陨石密度增加，最后10秒无人机夹击",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "飞行反馈",
        prompt: "撞到陨石、擦边躲避、收集能量时需要什么反馈？",
        inputType: "single_choice",
        options: ["碰撞震屏和闪烁无敌，收集能量发光脉冲", "危险物进入前有预警光圈，擦边给连击奖励", "爆炸粒子明显但不遮挡前方航线"],
        defaultAnswer: "碰撞震屏和闪烁无敌，收集能量发光脉冲",
        required: true
      },
      {
        id: "three_asset_style",
        label: "飞行模型风格",
        prompt: "飞船、陨石和能量核心应使用哪种 3D 模型风格？",
        inputType: "single_choice",
        options: ["低多边形科幻飞船、陨石、发光能量核心", "卡通太空飞机、圆润陨石、星星能量", "硬表面战机、无人机障碍、蓝色能量块"],
        defaultAnswer: "低多边形科幻飞船、陨石、发光能量核心",
        required: true
      }
    ],
    brief: {
      cameraIntent: "追尾飞行镜头，强调速度感、前方障碍预读和能量收集路线。",
      movementIntent: "玩家控制飞船横向和纵向微调，整体沿航线自动前进。",
      spaceLayout: "纵深飞行走廊，陨石和无人机从远处进入，奖励沿安全路线形成引导。",
      coreLoop: ["驾驶飞船", "预判前方陨石", "收集能量核心", "穿越压力波次", "达成目标或爆炸重开"],
      assetNeeds: ["飞船或战机低模", "陨石或无人机危险物", "发光能量核心", "深色太空天空盒", "爆炸和收集测试音效"]
    },
    director: {
      version: "1",
      genre: "flight_shooter",
      camera: "follow_chase",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "forward_flight",
      layoutMode: "flight_corridor",
      spawnPattern: "forward_waves",
      stages: [
        { id: "launch", label: "起飞校准", startsAtMs: 0, durationMs: 5000, objective: "learn_controls" },
        { id: "energy", label: "能量航线", startsAtMs: 5000, durationMs: 12000, objective: "collect" },
        { id: "asteroids", label: "陨石压力", startsAtMs: 17000, durationMs: 12000, objective: "survive" },
        { id: "breakthrough", label: "高速突围", startsAtMs: 29000, durationMs: 16000, objective: "finale" }
      ],
      player: { speed: 8, radius: 0.55, start: { x: 0, y: 0.6, z: 9 } },
      world: { width: 12, depth: 36, skyColor: "#030712", groundColor: "#111827" },
      objectives: { collectTarget: 8, avoidDamage: true, timeLimitMs: 90000 },
      enemies: [
        { id: "asteroid-wave", type: "asteroid", behavior: "falling", count: 8, speed: 4.4 },
        { id: "drone-crossfire", type: "drone", behavior: "patrol", count: 3, speed: 3.2 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true }
    }
  },
  runner: {
    id: "runner",
    label: "3D 跑酷",
    genreIntent: "自动前进的赛道跑酷，通过换道和跳跃避开路障并收集金币。",
    modelDirection: {
      player: "low-poly runner character or hoverboard racer, upright silhouette, forward facing",
      hazard: "low-poly lane barrier, gate, jump block, or obstacle arch for a runner track",
      collectible: "gold coin or badge pickup for a runner game, bright circular reward"
    },
    runtimeDifferentiators: ["auto-forward movement", "lane track", "barrier gates and coin lines"],
    questions: [
      {
        id: "three_camera",
        label: "跑酷镜头",
        prompt: "跑酷游戏镜头要如何表现赛道、换道空间和前方路障？",
        inputType: "single_choice",
        options: ["追尾赛道镜头，三路障碍和金币线清晰可见", "轻俯视赛道镜头，强调换道判断", "低机位速度镜头，突出冲刺感"],
        defaultAnswer: "追尾赛道镜头，三路障碍和金币线清晰可见",
        required: true
      },
      {
        id: "three_controls",
        label: "跑酷操作",
        prompt: "角色自动前进时，玩家主要控制哪些动作？",
        inputType: "single_choice",
        options: ["自动前进，左右换道，遇到闸门跳跃", "自动前进，拖动横移，短按冲刺", "三条赛道按钮换道，危险前给预警"],
        defaultAnswer: "自动前进，左右换道，遇到闸门跳跃",
        required: true
      },
      {
        id: "three_space_route",
        label: "赛道节奏",
        prompt: "前 30 秒赛道如何安排金币线、跳台、闸门和速度递增？",
        inputType: "single_choice",
        options: ["5秒换道教学，15秒金币路线，最后10秒连续闸门", "金币引导安全路线，跳台后出现高价值奖励", "赛道逐步变窄，速度阶段性提升"],
        defaultAnswer: "5秒换道教学，15秒金币路线，最后10秒连续闸门",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "路障反馈",
        prompt: "撞到路障、擦边通过、收集金币时反馈怎样设计？",
        inputType: "single_choice",
        options: ["撞路障减速震屏，金币连线发光", "闸门前预警，擦边通过给速度奖励", "跳跃落地有冲击波，失败可立即重开"],
        defaultAnswer: "撞路障减速震屏，金币连线发光",
        required: true
      },
      {
        id: "three_asset_style",
        label: "跑酷模型风格",
        prompt: "跑酷角色、赛道路障和金币应使用哪种 3D 模型风格？",
        inputType: "single_choice",
        options: ["低多边形跑酷角色、赛道路障、金币徽章", "霓虹悬浮板、发光闸门、能量币", "卡通运动员、彩色跳台、星星奖励"],
        defaultAnswer: "低多边形跑酷角色、赛道路障、金币徽章",
        required: true
      }
    ],
    brief: {
      cameraIntent: "追尾赛道镜头，突出三路换道、前方路障和金币线。",
      movementIntent: "角色自动前进，玩家控制左右换道和关键时机跳跃或冲刺。",
      spaceLayout: "纵深赛道，金币线引导安全路径，闸门和跳台逐步提高反应压力。",
      coreLoop: ["自动奔跑", "左右换道", "避开路障闸门", "收集金币", "冲过终点或重开"],
      assetNeeds: ["跑酷角色或载具低模", "赛道路障或闸门", "金币或徽章收集物", "霓虹赛道背景", "金币和撞击测试音效"]
    },
    director: {
      version: "1",
      genre: "runner",
      camera: "follow_chase",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "auto_runner",
      layoutMode: "lane_track",
      spawnPattern: "lane_gates",
      stages: [
        { id: "lane-learn", label: "换道教学", startsAtMs: 0, durationMs: 5000, objective: "learn_controls" },
        { id: "coin-line", label: "金币路线", startsAtMs: 5000, durationMs: 12000, objective: "collect" },
        { id: "gate-rush", label: "闸门加速", startsAtMs: 17000, durationMs: 12000, objective: "survive" },
        { id: "finish-sprint", label: "终点冲刺", startsAtMs: 29000, durationMs: 16000, objective: "finale" }
      ],
      player: { speed: 7, radius: 0.5, start: { x: 0, y: 0.55, z: -8 } },
      world: { width: 9, depth: 48, skyColor: "#111827", groundColor: "#1e3a8a" },
      objectives: { collectTarget: 10, avoidDamage: true, timeLimitMs: 85000 },
      enemies: [
        { id: "lane-gates", type: "gate", behavior: "falling", count: 7, speed: 4 },
        { id: "moving-barriers", type: "gate", behavior: "patrol", count: 4, speed: 3 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true }
    }
  },
  third_person_collect: {
    id: "third_person_collect",
    label: "第三人称收集",
    genreIntent: "第三人称自由移动，在小型场景中绕开巡逻敌人并收集任务物。",
    modelDirection: {
      player: "low-poly third-person adventurer character, readable from behind, game ready",
      hazard: "low-poly patrol guard or chaser enemy, clear hostile silhouette",
      collectible: "treasure shard, quest token, or glowing item for a third-person collect game"
    },
    runtimeDifferentiators: ["free movement arena", "patrol and chase enemies", "landmark collection route"],
    questions: [
      {
        id: "three_camera",
        label: "第三人称镜头",
        prompt: "第三人称收集游戏的镜头应怎样跟随角色并看清巡逻敌人？",
        inputType: "single_choice",
        options: ["背后跟随镜头，角色和目标清晰", "轻俯视自由镜头，看清巡逻路线", "固定小场景镜头，强调收集路线"],
        defaultAnswer: "背后跟随镜头，角色和目标清晰",
        required: true
      },
      {
        id: "three_controls",
        label: "自由移动",
        prompt: "玩家在小场景中怎样移动和躲避巡逻敌人？",
        inputType: "single_choice",
        options: ["WASD/拖动自由移动，靠近收集物自动拾取", "自由移动加短冲刺，绕开守卫", "慢速探索移动，强调安全路线"],
        defaultAnswer: "WASD/拖动自由移动，靠近收集物自动拾取",
        required: true
      },
      {
        id: "three_space_route",
        label: "收集场景",
        prompt: "小型 3D 场景中收集物、地标和巡逻路线如何摆放？",
        inputType: "single_choice",
        options: ["收集物围绕地标分布，巡逻敌人在中线移动", "奖励散落在角落，高价值目标靠近守卫", "路径分成安全区和高风险区"],
        defaultAnswer: "收集物围绕地标分布，巡逻敌人在中线移动",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "巡逻反馈",
        prompt: "被守卫碰到、成功绕开、收集任务物时需要什么反馈？",
        inputType: "single_choice",
        options: ["守卫碰撞震屏，收集物发光消失", "巡逻敌人带预警范围，绕开给连击", "失败后回到入口，保留已收集提示"],
        defaultAnswer: "守卫碰撞震屏，收集物发光消失",
        required: true
      },
      {
        id: "three_asset_style",
        label: "冒险模型风格",
        prompt: "角色、巡逻敌人和任务物应使用哪种模型风格？",
        inputType: "single_choice",
        options: ["低多边形冒险者、巡逻守卫、发光碎片", "卡通角色、小怪物、宝石任务物", "轻写实探索者、机械守卫、遗迹符文"],
        defaultAnswer: "低多边形冒险者、巡逻守卫、发光碎片",
        required: true
      }
    ],
    brief: {
      cameraIntent: "第三人称跟随镜头，保证玩家、巡逻敌人和收集路线同时可读。",
      movementIntent: "玩家在小型 3D 场景中自由移动，绕开巡逻或追踪敌人并收集任务物。",
      spaceLayout: "开放小场景，收集物围绕地标和角落分布，敌人在路径中巡逻。",
      coreLoop: ["自由移动", "观察巡逻路线", "绕开敌人", "收集任务物", "完成目标或重开"],
      assetNeeds: ["第三人称角色低模", "巡逻敌人或守卫", "宝物或任务物", "小型场景地面和地标", "收集/受击测试音效"]
    },
    director: {
      version: "1",
      genre: "third_person_collect",
      camera: "follow_chase",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "free_move",
      layoutMode: "small_arena",
      spawnPattern: "landmark_clusters",
      stages: [
        { id: "move-learn", label: "熟悉场地", startsAtMs: 0, durationMs: 5000, objective: "learn_controls" },
        { id: "route", label: "地标收集", startsAtMs: 5000, durationMs: 12000, objective: "collect" },
        { id: "guards", label: "巡逻压力", startsAtMs: 17000, durationMs: 12000, objective: "survive" },
        { id: "last-token", label: "最后任务物", startsAtMs: 29000, durationMs: 16000, objective: "finale" }
      ],
      player: { speed: 5.5, radius: 0.55, start: { x: 0, y: 0.55, z: 6 } },
      world: { width: 18, depth: 22, skyColor: "#0f172a", groundColor: "#166534" },
      objectives: { collectTarget: 7, avoidDamage: true, timeLimitMs: 100000 },
      enemies: [
        { id: "patrol-guards", type: "drone", behavior: "patrol", count: 4, speed: 2.3 },
        { id: "alert-chaser", type: "drone", behavior: "chase", count: 1, speed: 2.1 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true }
    }
  },
  exploration: {
    id: "exploration",
    label: "探索展示",
    genreIntent: "低压力探索场景，通过发现地标或扫描目标完成体验。",
    modelDirection: {
      player: "low-poly explorer, camera drone, or small rover for an exploration scene",
      hazard: "light environmental obstacle, floating marker, or slow moving scanner hazard",
      collectible: "discovery crystal, landmark token, or specimen item for exploration progress"
    },
    runtimeDifferentiators: ["orbit_showcase camera", "discovery waypoints", "low pressure hazards"],
    questions: [
      {
        id: "three_camera",
        label: "探索镜头",
        prompt: "探索游戏镜头应如何展示地标、发现点和玩家位置？",
        inputType: "single_choice",
        options: ["轨道展示镜头，地标和发现点都清晰", "第三人称慢速跟随镜头，适合漫游", "轻俯视探索镜头，方便寻找水晶"],
        defaultAnswer: "轨道展示镜头，地标和发现点都清晰",
        required: true
      },
      {
        id: "three_controls",
        label: "探索操作",
        prompt: "玩家探索时主要进行移动、观察还是扫描发现点？",
        inputType: "single_choice",
        options: ["自由移动靠近地标自动扫描", "慢速移动并收集发现水晶", "围绕中心地标观察并点亮目标"],
        defaultAnswer: "自由移动靠近地标自动扫描",
        required: true
      },
      {
        id: "three_space_route",
        label: "探索路线",
        prompt: "发现点、地标和奖励如何摆放，才能形成清晰探索路线？",
        inputType: "single_choice",
        options: ["三个地标形成环线，水晶引导玩家逐步发现", "发现点分布在场景边缘，中心地标作为参照", "低压力路线，少量障碍只用于提示方向"],
        defaultAnswer: "三个地标形成环线，水晶引导玩家逐步发现",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "发现反馈",
        prompt: "扫描地标、发现水晶、碰到轻量障碍时怎样反馈？",
        inputType: "single_choice",
        options: ["发现点点亮，水晶发光，轻微碰撞不立即失败", "扫描完成出现光环，收集后显示进度", "障碍只扣生命不秒杀，鼓励继续探索"],
        defaultAnswer: "发现点点亮，水晶发光，轻微碰撞不立即失败",
        required: true
      },
      {
        id: "three_asset_style",
        label: "探索模型风格",
        prompt: "探索者、地标和发现水晶应使用哪种 3D 模型风格？",
        inputType: "single_choice",
        options: ["低多边形探索者、遗迹地标、发光水晶", "小型探测器、科幻扫描点、蓝色标本", "卡通漫游角色、奇幻地标、彩色发现物"],
        defaultAnswer: "低多边形探索者、遗迹地标、发光水晶",
        required: true
      }
    ],
    brief: {
      cameraIntent: "轨道或第三人称展示镜头，突出地标、发现点和空间方向。",
      movementIntent: "玩家自由移动到发现点，靠近后扫描或收集目标，整体压力较低。",
      spaceLayout: "开放探索场景，地标形成环线，水晶和发现点引导玩家移动。",
      coreLoop: ["观察地标", "移动到发现点", "扫描或收集水晶", "点亮进度", "完成探索"],
      assetNeeds: ["探索者或探测器低模", "轻量环境障碍", "发现水晶或标本", "探索场景天空盒", "发现/扫描测试音效"]
    },
    director: {
      version: "1",
      genre: "exploration",
      camera: "orbit_showcase",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "explore_scan",
      layoutMode: "open_landmarks",
      spawnPattern: "discovery_ring",
      stages: [
        { id: "look-around", label: "观察地标", startsAtMs: 0, durationMs: 6000, objective: "learn_controls" },
        { id: "discover", label: "发现水晶", startsAtMs: 6000, durationMs: 14000, objective: "collect" },
        { id: "scan", label: "扫描路线", startsAtMs: 20000, durationMs: 12000, objective: "survive" },
        { id: "complete-map", label: "完成探索", startsAtMs: 32000, durationMs: 18000, objective: "finale" }
      ],
      player: { speed: 4.2, radius: 0.55, start: { x: 0, y: 0.55, z: 4 } },
      world: { width: 22, depth: 22, skyColor: "#082f49", groundColor: "#365314" },
      objectives: { collectTarget: 5, avoidDamage: false, timeLimitMs: 120000 },
      enemies: [
        { id: "slow-scanners", type: "drone", behavior: "orbit", count: 2, speed: 1.2 },
        { id: "soft-markers", type: "gate", behavior: "patrol", count: 2, speed: 1 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true }
    }
  },
  dodge_collect: {
    id: "dodge_collect",
    label: "躲避收集",
    genreIntent: "竞技场内躲避追踪和环绕危险物，抓住奖励波次完成收集目标。",
    modelDirection: {
      player: "low-poly arena hero orb or agile character for dodge collect gameplay",
      hazard: "low-poly chasing orb, orbiting mine, or rotating danger marker",
      collectible: "timed reward orb, gem, or energy pickup for an arena collect game"
    },
    runtimeDifferentiators: ["arena movement", "orbit and chase hazards", "timed reward bursts"],
    questions: [
      {
        id: "three_camera",
        label: "竞技场镜头",
        prompt: "躲避收集游戏镜头应怎样看清玩家、追踪体和奖励波次？",
        inputType: "single_choice",
        options: ["俯视竞技场镜头，看清追踪危险和奖励", "轻追尾镜头，突出移动方向", "固定小场景镜头，强调反应判断"],
        defaultAnswer: "俯视竞技场镜头，看清追踪危险和奖励",
        required: true
      },
      {
        id: "three_controls",
        label: "躲避操作",
        prompt: "玩家如何在竞技场中移动、躲避和抓取奖励？",
        inputType: "single_choice",
        options: ["自由移动，短冲刺躲开追踪体", "拖动控制角色，奖励出现时快速靠近", "四方向移动，危险物环绕压缩空间"],
        defaultAnswer: "自由移动，短冲刺躲开追踪体",
        required: true
      },
      {
        id: "three_space_route",
        label: "奖励波次",
        prompt: "前 30 秒怎样安排奖励波次和危险物压迫？",
        inputType: "single_choice",
        options: ["先安全收集，再出现追踪体，最后奖励集中刷新", "奖励围绕中心刷新，危险物从边缘逼近", "高价值奖励短暂出现，逼迫玩家冒险"],
        defaultAnswer: "先安全收集，再出现追踪体，最后奖励集中刷新",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "碰撞反馈",
        prompt: "追踪体命中、环绕压迫、奖励连击时需要什么反馈？",
        inputType: "single_choice",
        options: ["命中震屏和短暂无敌，奖励连击发光", "危险物有红色预警轨迹，连击提高分数", "失败慢动作，重开立即恢复第一波"],
        defaultAnswer: "命中震屏和短暂无敌，奖励连击发光",
        required: true
      },
      {
        id: "three_asset_style",
        label: "竞技场模型风格",
        prompt: "玩家、追踪体和奖励球应使用哪种模型风格？",
        inputType: "single_choice",
        options: ["低多边形竞技场角色、追踪球、能量奖励", "霓虹飞行球、环绕地雷、发光宝石", "卡通角色、旋转危险标记、星星奖励"],
        defaultAnswer: "低多边形竞技场角色、追踪球、能量奖励",
        required: true
      }
    ],
    brief: {
      cameraIntent: "俯视或轻追尾竞技场镜头，保证追踪危险和奖励刷新可读。",
      movementIntent: "玩家在竞技场内自由移动，躲避追踪和环绕危险物，抓住奖励刷新时机。",
      spaceLayout: "单屏竞技场，奖励按波次刷新，危险物从边缘或环绕路线施压。",
      coreLoop: ["移动躲避", "观察危险轨迹", "抓取限时奖励", "承受压力波", "达成分数或重开"],
      assetNeeds: ["竞技场玩家低模", "追踪体或环绕地雷", "奖励球或宝石", "竞技场地面", "连击/命中测试音效"]
    },
    director: {
      version: "1",
      genre: "dodge_collect",
      camera: "top_down",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "arena_dodge",
      layoutMode: "single_arena",
      spawnPattern: "timed_bursts",
      stages: [
        { id: "safe-start", label: "安全收集", startsAtMs: 0, durationMs: 5000, objective: "learn_controls" },
        { id: "reward-burst", label: "奖励波次", startsAtMs: 5000, durationMs: 12000, objective: "collect" },
        { id: "chase-pressure", label: "追踪压迫", startsAtMs: 17000, durationMs: 12000, objective: "survive" },
        { id: "combo-finale", label: "连击高潮", startsAtMs: 29000, durationMs: 16000, objective: "finale" }
      ],
      player: { speed: 6.2, radius: 0.55, start: { x: 0, y: 0.55, z: 0 } },
      world: { width: 16, depth: 16, skyColor: "#111827", groundColor: "#312e81" },
      objectives: { collectTarget: 8, avoidDamage: true, timeLimitMs: 90000 },
      enemies: [
        { id: "chasing-orbs", type: "drone", behavior: "chase", count: 3, speed: 2.7 },
        { id: "orbit-mines", type: "asteroid", behavior: "orbit", count: 4, speed: 2.2 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true }
    }
  },
  futuristic_tower_defense: {
    id: "futuristic_tower_defense",
    label: "未来科幻塔防",
    genreIntent: "玩家在科幻防线地图上建造和升级炮塔，阻止敌人沿路径突破基地核心。",
    modelDirection: {
      player: "low-poly futuristic base core with shield ring and readable defense objective",
      hazard: "low-poly enemy drones, armored robots, and fast runners for tower defense waves",
      collectible: "glowing energy cell used as tower defense build currency"
    },
    runtimeDifferentiators: ["tower placement", "path-following waves", "automatic turret projectiles", "base health"],
    questions: [
      {
        id: "three_camera",
        label: "塔防镜头",
        prompt: "3D 塔防镜头要如何看清敌人路径、基地核心和炮塔建造位？",
        inputType: "single_choice",
        options: ["轻俯视防线镜头，路径和建造位清晰", "追随基地核心的斜俯视镜头", "更高的战术俯视镜头，强调整条路径"],
        defaultAnswer: "轻俯视防线镜头，路径和建造位清晰",
        required: true
      },
      {
        id: "three_controls",
        label: "建造操作",
        prompt: "玩家如何放置炮塔并理解当前资源是否足够？",
        inputType: "single_choice",
        options: ["点击建造位放置已选炮塔，资源不足时提示", "拖动炮塔到建造位", "自动推荐建造位，玩家点击确认"],
        defaultAnswer: "点击建造位放置已选炮塔，资源不足时提示",
        required: true
      },
      {
        id: "three_space_route",
        label: "敌人波次",
        prompt: "前 60 秒塔防波次如何安排无人机、装甲敌人和快速敌人？",
        inputType: "single_choice",
        options: ["教学波、混合波、压力波、精英波逐步增强", "快速敌人先出现，装甲敌人后出现", "每波都加入不同路径压力"],
        defaultAnswer: "教学波、混合波、压力波、精英波逐步增强",
        required: true
      },
      {
        id: "three_hazard_feedback",
        label: "防守反馈",
        prompt: "炮塔攻击、敌人被击毁、基地受击时需要什么反馈？",
        inputType: "single_choice",
        options: ["激光束、导弹爆炸、减速圈、基地护盾闪烁", "敌人血条、资源弹出、炮塔冷却提示", "波次警报、基地受击震屏、胜利烟花"],
        defaultAnswer: "激光束、导弹爆炸、减速圈、基地护盾闪烁",
        required: true
      },
      {
        id: "three_asset_style",
        label: "塔防模型风格",
        prompt: "基地、炮塔、敌人和能量资源应使用哪种 3D 风格？",
        inputType: "single_choice",
        options: ["低模科幻金属、霓虹能量核心、无人机敌人", "晶体科技防线、悬浮炮塔、机械虫群", "太空基地风格、导弹塔、装甲机器人"],
        defaultAnswer: "低模科幻金属、霓虹能量核心、无人机敌人",
        required: true
      }
    ],
    brief: {
      cameraIntent: "轻俯视 3D 战术镜头，保证敌人路径、炮塔建造位和基地核心都清晰可读。",
      movementIntent: "玩家不直接控制角色移动，而是通过点击建造位放置炮塔并管理资源。",
      spaceLayout: "S 型防守路径连接入口和基地核心，路径两侧布置清晰的炮塔建造位。",
      coreLoop: ["观察敌人路径", "选择炮塔", "点击建造位放置炮塔", "炮塔自动攻击敌人", "击杀获得资源并守住基地"],
      assetNeeds: ["基地核心低模", "激光/导弹/减速炮塔", "无人机/装甲/快速敌人", "能量资源", "科幻防线路径"]
    },
    director: {
      version: "1",
      genre: "futuristic_tower_defense",
      camera: "top_down",
      controls: ["keyboard", "touch_drag", "touch_buttons"],
      movementMode: "tower_defense",
      layoutMode: "defense_path",
      spawnPattern: "tower_waves",
      stages: [
        { id: "build-tutorial", label: "建造教学", startsAtMs: 0, durationMs: 8000, objective: "learn_controls" },
        { id: "first-wave", label: "无人机波次", startsAtMs: 8000, durationMs: 14000, objective: "survive" },
        { id: "mixed-wave", label: "混合压力", startsAtMs: 22000, durationMs: 16000, objective: "survive" },
        { id: "elite-wave", label: "精英突破", startsAtMs: 38000, durationMs: 22000, objective: "finale" }
      ],
      player: { speed: 4, radius: 0.8, start: { x: 6, y: 0.6, z: 5 } },
      world: { width: 18, depth: 24, skyColor: "#020617", groundColor: "#0f172a" },
      objectives: { collectTarget: 4, avoidDamage: true, timeLimitMs: 120000 },
      enemies: [
        { id: "drone-wave", type: "drone", behavior: "falling", count: 8, speed: 1.4 },
        { id: "armored-wave", type: "gate", behavior: "falling", count: 5, speed: 0.85 },
        { id: "runner-wave", type: "drone", behavior: "chase", count: 6, speed: 2.1 }
      ],
      feedback: { collectPulse: true, hitShake: true, proceduralAudio: true },
      towerDefense: {
        pathNodes: [
          { x: -7, z: -9 },
          { x: -3, z: -5 },
          { x: 4, z: -5 },
          { x: 4, z: 1 },
          { x: -2, z: 1 },
          { x: 6, z: 7 }
        ],
        towers: [
          { id: "laser-tower", kind: "laser", cost: 40, range: 4.5, fireRateMs: 520, damage: 18 },
          { id: "missile-tower", kind: "missile", cost: 70, range: 5.8, fireRateMs: 1100, damage: 36, effect: "splash" },
          { id: "slow-tower", kind: "slow", cost: 55, range: 4.2, fireRateMs: 850, damage: 8, effect: "slow" }
        ],
        waves: [
          { id: "tutorial-drones", startsAtMs: 1200, enemyType: "drone", count: 5, intervalMs: 900, health: 36, speed: 1.25, reward: 12 },
          { id: "mixed-drones", startsAtMs: 9000, enemyType: "drone", count: 8, intervalMs: 650, health: 42, speed: 1.45, reward: 13 },
          { id: "armored-push", startsAtMs: 19000, enemyType: "armored", count: 5, intervalMs: 1100, health: 95, speed: 0.85, reward: 24 },
          { id: "runner-breach", startsAtMs: 32000, enemyType: "runner", count: 9, intervalMs: 520, health: 30, speed: 2.2, reward: 16 }
        ],
        economyRules: { startingEnergy: 120, killReward: 12 },
        baseRules: { baseHealth: 10, leakDamage: 1 },
        buildRules: { buildRadius: 1.4, maxTowers: 8 }
      }
    }
  }
};

export function getThreeGenreProfile(genre: ThreeGameGenre): ThreeGenreProfile {
  return THREE_GENRE_PROFILES[genre] ?? THREE_GENRE_PROFILES.dodge_collect;
}
