import type { EngineType, TemplateFamily, ThreeGameGenre } from "../core/types";
import type { DesignQuestion } from "../core/types";

export type GameDevPromptProfileId =
  | "side_scroll_action_adventure"
  | "two_d_fighting"
  | "steampunk_action_adventure"
  | "vertical_flight_shooter"
  | "strategy_tower_defense"
  | "logic_puzzle"
  | "point_click_adventure"
  | "board_strategy"
  | "shooting_tower_defense"
  | "simulation_management"
  | "farm_life"
  | "pet_care"
  | "romance_visual_novel"
  | "match_three"
  | "platform_jumper"
  | "sports_competition"
  | "card_battle"
  | "racing"
  | "light_rpg"
  | "three_d_space_shooter";

export interface GameDevPromptProfile {
  id: GameDevPromptProfileId;
  label: string;
  sourcePromptPattern: string;
  templateFamily: TemplateFamily;
  threeGenre: ThreeGameGenre;
  productionBeats: string[];
  pressureTypes: string[];
  rewardPath: string[];
  visualSlots: string[];
  audioCues: string[];
  validationChecklist: string[];
}

export interface GameDevPromptBundle {
  profileId: GameDevPromptProfileId;
  engineType: EngineType;
  templateFamily: TemplateFamily;
  threeGenre: ThreeGameGenre;
  productionBriefPrompt: string;
  directorPrompt: string;
  visualPromptRules: string;
  uiAudioPromptRules: string;
  modelPromptRules: string;
  validationChecklist: string[];
}

export type GuidedQuestionDecisionSlot =
  | "route_layout"
  | "player_ability"
  | "hazard_pressure"
  | "progression_reward"
  | "feedback_outcome";

export interface ProfileGuidedQuestion extends DesignQuestion {
  profileId: GameDevPromptProfileId;
  decisionSlot: GuidedQuestionDecisionSlot;
  affectsDirector: string[];
}

export interface GuidedQuestionPromptBundle {
  profileId: GameDevPromptProfileId;
  engineType: EngineType;
  questions: ProfileGuidedQuestion[];
  modelInstruction: string;
}

export interface ProfileGameplayPlan {
  profileId: GameDevPromptProfileId;
  genreMechanics: string[];
  specialActions: string[];
  spawnTimeline: string[];
  progressionRules: string[];
}

const commonValidation = ["60fps", "mobile_input", "win_loss_restart", "hud_readability", "audio_cues"];
const matureGameplayGates = [
  "three_stage_pacing",
  "two_pressure_types",
  "reward_path",
  "failure_feedback",
  "restart_motivation"
];

export const gameDevPromptProfiles: GameDevPromptProfile[] = [
  profile("side_scroll_action_adventure", "横版动作冒险", "ninja side-scroller with patrol enemies, projectiles, platforms, parallax", "platformer", "third_person_collect", ["teach run and jump", "add patrol enemy", "introduce ranged throw", "reward risky route", "finish with miniboss gate"], ["spatial pressure", "timing pressure"], ["coins", "hidden scroll", "skill unlock"]),
  profile("two_d_fighting", "2D 格斗", "fighter with light/heavy attack, block, dodge, combo, hit stun", "top_down", "dodge_collect", ["teach movement", "teach light attack", "add block/dodge", "chain combo", "finish with rival duel"], ["reaction pressure", "spacing pressure"], ["combo meter", "round win", "new move"]),
  profile("steampunk_action_adventure", "蒸汽朋克动作冒险", "steampunk mount, inertia, mechanical switches, fog map, scrap collection", "platformer", "third_person_collect", ["mount movement", "first switch", "fog reveal", "scrap route", "machine gate finale"], ["momentum pressure", "puzzle pressure"], ["scrap parts", "map reveal", "upgrade cog"]),
  profile("vertical_flight_shooter", "纵向飞行射击", "vertical shooter with enemy formations, boss bullets, weapon upgrade branches", "top_down", "flight_shooter", ["safe flight", "first enemy formation", "weapon upgrade", "dense wave", "boss phase"], ["bullet pressure", "formation pressure"], ["power-up", "score multiplier", "shield charge"]),
  profile("strategy_tower_defense", "策略塔防", "tower defense with path, turret placement, waves, gold, upgrades, base health", "tower_defense", "futuristic_tower_defense", ["build first tower", "first wave", "upgrade choice", "mixed enemy wave", "base defense finale"], ["route pressure", "economy pressure"], ["gold", "tower upgrade", "perfect wave bonus"]),
  profile("logic_puzzle", "益智解谜", "drag blocks, connect paths, move limit, timer, reset, hint", "grid_logic", "exploration", ["show rule", "first move", "blocked route", "limited move challenge", "solution reveal"], ["logic pressure", "move budget pressure"], ["stars", "hint token", "level unlock"]),
  profile("point_click_adventure", "点击冒险解谜", "inventory, clue combination, room unlock, branching endings", "ui_heavy", "exploration", ["inspect room", "collect clue", "combine item", "unlock area", "ending choice"], ["information pressure", "sequence pressure"], ["clue", "key item", "ending branch"]),
  profile("board_strategy", "棋盘策略", "board pieces, turn timer, skill range, AI decision, legal move hints", "grid_logic", "dodge_collect", ["teach piece move", "show legal hints", "enemy response", "skill tradeoff", "checkmate objective"], ["turn pressure", "position pressure"], ["captured piece", "skill charge", "territory"]),
  profile("shooting_tower_defense", "射击塔防混合", "manual aim plus auto turrets, base health, enemy lanes, fire coverage", "tower_defense", "futuristic_tower_defense", ["aim tutorial", "place turret", "lane pressure", "manual save moment", "base rush finale"], ["aim pressure", "lane pressure"], ["ammo pack", "turret upgrade", "base repair"]),
  profile("simulation_management", "模拟经营", "orders, customer mood, income, upgrades, time acceleration", "ui_heavy", "exploration", ["first order", "customer mood", "upgrade counter", "rush hour", "daily summary"], ["time pressure", "resource pressure"], ["income", "rating", "shop upgrade"]),
  profile("farm_life", "农场养成", "planting, weather, market price, tasks, inventory", "top_down", "exploration", ["plant crop", "water and weather", "harvest", "market sale", "task completion"], ["planning pressure", "weather pressure"], ["crop", "coins", "tool upgrade"]),
  profile("pet_care", "宠物养成", "feeding, training, evolution, collection book, stat panel", "ui_heavy", "third_person_collect", ["feed pet", "train stat", "mini challenge", "evolution preview", "collection unlock"], ["care pressure", "timing pressure"], ["affection", "new form", "badge"]),
  profile("romance_visual_novel", "恋爱文字冒险", "branch dialogue, affection, events, multiple endings, save slots", "ui_heavy", "exploration", ["first choice", "affection feedback", "event trigger", "conflict branch", "ending reveal"], ["choice pressure", "relationship pressure"], ["affection", "memory item", "ending route"]),
  profile("match_three", "三消休闲", "match grid, chain reactions, special items, step or time limit", "grid_logic", "dodge_collect", ["first match", "chain reaction", "special tile", "limited steps", "target clear"], ["move pressure", "pattern pressure"], ["combo", "booster", "level stars"]),
  profile("platform_jumper", "平台跳跃", "run jump, double jump, dash, checkpoint, hidden area", "platformer", "runner", ["single jump", "moving platform", "double jump", "dash gap", "checkpoint finale"], ["precision pressure", "speed pressure"], ["checkpoint", "hidden gem", "dash refill"]),
  profile("sports_competition", "体育竞技", "movement, shooting, passing, steal, timer, attribute training", "top_down", "runner", ["basic move", "first shot", "defender pressure", "team action", "timer clutch"], ["timer pressure", "opponent pressure"], ["score", "stamina", "attribute upgrade"]),
  profile("card_battle", "卡牌对战", "draw cards, mana, play resolution, turn flow, deck building", "ui_heavy", "dodge_collect", ["draw hand", "spend mana", "enemy turn", "combo play", "lethal setup"], ["resource pressure", "turn pressure"], ["new card", "mana curve", "deck upgrade"]),
  profile("racing", "竞速赛车", "steering, drift, collision, lap time, vehicle upgrades", "top_down", "runner", ["steer tutorial", "first drift", "traffic obstacle", "boost pickup", "final lap"], ["speed pressure", "collision pressure"], ["boost", "lap time medal", "car upgrade"]),
  profile("light_rpg", "轻 RPG", "skills, monsters, quests, inventory, experience, map teleport", "top_down", "third_person_collect", ["first quest", "monster fight", "skill use", "loot choice", "boss gate"], ["combat pressure", "resource pressure"], ["xp", "loot", "skill unlock"]),
  profile("three_d_space_shooter", "3D 太空射击", "3D spaceship control, enemy ships, weapon upgrades, shields, boss phases", "top_down", "flight_shooter", ["teach 3D movement", "enemy squadron", "weapon upgrade", "shield pressure", "boss phase"], ["depth pressure", "projectile pressure"], ["energy core", "weapon level", "shield recharge"])
];

export function mapGameDevPromptProfile(profileId: GameDevPromptProfileId): {
  templateFamily: TemplateFamily;
  threeGenre: ThreeGameGenre;
} {
  const profile = findProfile(profileId);
  return {
    templateFamily: profile.templateFamily,
    threeGenre: profile.threeGenre
  };
}

export function buildGameDevPromptBundle(input: {
  idea: string;
  profileId: GameDevPromptProfileId;
  engineType: EngineType;
}): GameDevPromptBundle {
  const profile = findProfile(input.profileId);
  const pacing = profile.productionBeats.join(" -> ");
  return {
    profileId: profile.id,
    engineType: input.engineType,
    templateFamily: profile.templateFamily,
    threeGenre: profile.threeGenre,
    productionBriefPrompt: [
      `Create a production brief for: ${input.idea}`,
      `genre profile: ${profile.label}`,
      "include player fantasy, core loop, first minute, difficulty curve, reward feedback, failure feedback, restart motivation.",
      `production beats: ${pacing}`
    ].join("\n"),
    directorPrompt: [
      "Generate JSON only for a controlled game director.",
      `Use three-stage pacing: ${pacing}`,
      `Pressure types: ${profile.pressureTypes.join(", ")}`,
      `Reward path: ${profile.rewardPath.join(", ")}`,
      "Include enemies or obstacles, collectible or economy target, failure condition, victory condition, feedback events, and mobile input mode."
    ].join("\n"),
    visualPromptRules: [
      "Create provider-safe visual prompts for background, player, hazard, collectible, cover poster.",
      `Visual slots: ${profile.visualSlots.join(", ")}`,
      "Keep background, sprite subjects, UI, and poster prompts separate.",
      "Do not include runtime, controls, code, lifecycle, scoring rules, or developer text in image prompts."
    ].join("\n"),
    uiAudioPromptRules: [
      "UI Prompt Pack must use Context / Subject / Items / Style / Technical.",
      `Audio cues: ${profile.audioCues.join(", ")}`,
      "Audio prompts must describe mood, duration, cue purpose, and mix clarity only.",
      "Do not include runtime, controls, code, lifecycle, scoring rules, or developer text in UI/audio prompts."
    ].join("\n"),
    modelPromptRules: [
      `3D genre target: ${profile.threeGenre}`,
      "Model prompts must be low-poly GLB, centered origin, readable silhouette, model budget under 3k triangles where possible.",
      "Separate player, hazard, collectible, and environment blockout model prompts.",
      "Do not include runtime, controls, code, lifecycle, scoring rules, or developer text in model prompts."
    ].join("\n"),
    validationChecklist: [...matureGameplayGates, ...profile.validationChecklist]
  };
}

export function selectGameDevPromptProfile(input: {
  idea: string;
  templateFamily?: TemplateFamily;
  threeGenre?: ThreeGameGenre;
}): GameDevPromptProfileId {
  const text = input.idea.toLowerCase();
  if (matchesAny(text, ["塔防", "防守", "炮塔", "基地", "tower defense", "turret"])) return "strategy_tower_defense";
  if (matchesAny(text, ["飞行射击", "纵向射击", "飞机", "飞船", "敌机", "弹幕", "boss", "shooter"])) return "vertical_flight_shooter";
  if (matchesAny(text, ["平台跳跃", "横版", "忍者", "跳跃", "检查点", "platformer"])) return "platform_jumper";
  if (matchesAny(text, ["三消", "消除", "match three", "match-3"])) return "match_three";
  if (matchesAny(text, ["rpg", "打怪", "升级", "任务", "背包", "怪物"])) return "light_rpg";
  if (matchesAny(text, ["格斗", "连招", "格挡", "fighting"])) return "two_d_fighting";
  if (matchesAny(text, ["经营", "订单", "顾客", "management"])) return "simulation_management";
  if (matchesAny(text, ["卡牌", "抽牌", "mana", "card"])) return "card_battle";
  if (matchesAny(text, ["赛车", "竞速", "漂移", "racing"])) return "racing";
  if (input.templateFamily === "tower_defense" || input.threeGenre === "futuristic_tower_defense") return "strategy_tower_defense";
  if (input.templateFamily === "platformer" || input.threeGenre === "runner") return "platform_jumper";
  if (input.templateFamily === "grid_logic") return "match_three";
  if (input.templateFamily === "ui_heavy") return "simulation_management";
  if (input.threeGenre === "flight_shooter") return "three_d_space_shooter";
  return "vertical_flight_shooter";
}

export function buildProfileGuidedQuestions(
  profileId: GameDevPromptProfileId,
  idea: string
): ProfileGuidedQuestion[] {
  const templates = profileQuestionTemplates[profileId] ?? defaultQuestionTemplates;
  return templates.map((template, index) => ({
    id: template.id,
    label: template.label,
    prompt: `${template.prompt}（围绕：${idea}）`,
    inputType: template.options.length > 0 ? "single_choice" : "short_text",
    options: template.options,
    defaultAnswer: template.defaultAnswer,
    required: true,
    profileId,
    decisionSlot: decisionSlots[index],
    affectsDirector: template.affectsDirector
  }));
}

export function buildGuidedQuestionPromptBundle(input: {
  idea: string;
  profileId: GameDevPromptProfileId;
  engineType: EngineType;
}): GuidedQuestionPromptBundle {
  const questions = buildProfileGuidedQuestions(input.profileId, input.idea);
  return {
    profileId: input.profileId,
    engineType: input.engineType,
    questions,
    modelInstruction: [
      "Generate only player-facing guided questions for this profile.",
      "Do not show internal developer prompts, engine setup text, or lifecycle/code instructions.",
      "Keep exactly the provided decision slots and make every question affect the gameplay director.",
      `Profile: ${input.profileId}`
    ].join("\n")
  };
}

export function buildProfileGameplayPlan(profileId: GameDevPromptProfileId): ProfileGameplayPlan {
  return profileGameplayPlans[profileId] ?? profileGameplayPlans.vertical_flight_shooter;
}

function profile(
  id: GameDevPromptProfileId,
  label: string,
  sourcePromptPattern: string,
  templateFamily: TemplateFamily,
  threeGenre: ThreeGameGenre,
  productionBeats: string[],
  pressureTypes: string[],
  rewardPath: string[]
): GameDevPromptProfile {
  return {
    id,
    label,
    sourcePromptPattern,
    templateFamily,
    threeGenre,
    productionBeats,
    pressureTypes,
    rewardPath,
    visualSlots: ["world.background", "player.main", "hazard.main", "item.reward", "cover.main"],
    audioCues: ["bgm.loop", "sfx.collect", "sfx.hit", "sfx.win", "sfx.lose", "sfx.warning"],
    validationChecklist: commonValidation
  };
}

function findProfile(profileId: GameDevPromptProfileId): GameDevPromptProfile {
  const profile = gameDevPromptProfiles.find((item) => item.id === profileId);
  if (!profile) throw new Error(`Unknown game dev prompt profile: ${profileId}`);
  return profile;
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

const decisionSlots: GuidedQuestionDecisionSlot[] = [
  "route_layout",
  "player_ability",
  "hazard_pressure",
  "progression_reward",
  "feedback_outcome"
];

type QuestionTemplate = Omit<ProfileGuidedQuestion, keyof DesignQuestion | "profileId"> & {
  id: string;
  label: string;
  prompt: string;
  options: string[];
  defaultAnswer: string;
};

const defaultQuestionTemplates: QuestionTemplate[] = [
  q("route", "路线", "玩家第一分钟应该沿着什么路线理解目标？", ["安全教学路线", "风险奖励路线", "多入口路线"], "安全教学路线", ["levelFlow", "stageGoals"]),
  q("ability", "能力", "玩家最核心的主动能力是什么？", ["冲刺", "射击", "跳跃", "互动"], "冲刺", ["gameConfig.gameplay", "attackRules"]),
  q("pressure", "压力", "主要压力来自哪里？", ["追击敌人", "时间限制", "障碍波次"], "追击敌人", ["enemyArchetypes", "spawnRules"]),
  q("reward", "奖励", "奖励成长如何让玩家想继续？", ["连收加分", "能力升级", "解锁区域"], "连收加分", ["progressionRules", "feedbackRules"]),
  q("feedback", "反馈", "胜利、失败和重开反馈应该突出什么？", ["强粒子和音效", "短重试", "阶段提示"], "强粒子和音效", ["impactRules", "audioCues"])
];

const profileQuestionTemplates: Partial<Record<GameDevPromptProfileId, QuestionTemplate[]>> = {
  strategy_tower_defense: [
    q("td_route", "防守路线", "敌人路线应该是单一路径、分叉路线还是环形路线？", ["单一路径", "分叉路线", "环形路线"], "分叉路线", ["levelFlow", "spawnTimeline"]),
    q("td_towers", "炮塔", "核心炮塔组合要突出什么策略？", ["激光塔持续输出", "导弹塔范围爆炸", "减速塔控场"], "激光塔持续输出", ["specialActions", "attackRules"]),
    q("td_waves", "波次", "敌人波次如何制造压力？", ["大量轻型敌人", "装甲慢速敌人", "快速偷家敌人"], "大量轻型敌人", ["enemyArchetypes", "spawnRules"]),
    q("td_economy", "经济", "金币和升级节奏应该偏向哪种体验？", ["快速建造", "谨慎升级", "击杀连奖"], "快速建造", ["progressionRules", "winCondition"]),
    q("td_base", "基地生命", "基地生命和失败反馈应该如何呈现？", ["基地护盾破裂", "警报音效", "最后一波反扑"], "基地护盾破裂", ["failCondition", "feedbackRules"])
  ],
  vertical_flight_shooter: [
    q("flight_weapon", "武器", "飞行射击的武器成长重点是什么？", ["直线主炮", "散射弹幕", "蓄力激光"], "直线主炮", ["specialActions", "attackRules"]),
    q("flight_formation", "敌机编队", "敌机编队应该怎样进入屏幕？", ["左右夹击", "V 字队形", "蛇形下压"], "V 字队形", ["enemyArchetypes", "spawnTimeline"]),
    q("flight_bullets", "弹幕压力", "弹幕压力要偏读得清还是高密度？", ["清晰慢弹", "中密度交叉弹", "Boss 高压弹幕"], "中密度交叉弹", ["spawnRules", "encounterTimeline"]),
    q("flight_shield", "护盾", "护盾或擦弹奖励要怎样鼓励冒险？", ["擦弹加分", "护盾充能", "拾取短暂无敌"], "护盾充能", ["progressionRules", "collisionRules"]),
    q("flight_boss", "Boss", "Boss 阶段应该突出什么反馈？", ["阶段变形", "弱点闪烁", "爆炸收尾"], "弱点闪烁", ["stageGoals", "impactRules"])
  ],
  platform_jumper: [
    q("platform_jump", "跳跃节奏", "平台跳跃第一分钟的跳跃节奏是什么？", ["短跳教学", "移动平台", "二段跳间隙"], "短跳教学", ["levelLayout", "stageGoals"]),
    q("platform_traps", "机关", "机关应该主要考验什么？", ["尖刺时机", "落石预警", "移动平台同步"], "尖刺时机", ["enemyArchetypes", "spawnTimeline"]),
    q("platform_checkpoint", "检查点", "检查点如何降低挫败感？", ["每段后检查点", "隐藏检查点", "Boss 前检查点"], "每段后检查点", ["progressionRules", "failCondition"]),
    q("platform_secret", "隐藏奖励", "隐藏奖励放在哪里最有吸引力？", ["高台路线", "危险捷径", "墙后区域"], "高台路线", ["levelFlow", "rewardPath"]),
    q("platform_finish", "终点反馈", "终点或重开反馈要突出什么？", ["旗帜动画", "金币结算", "快速重试"], "旗帜动画", ["winCondition", "feedbackRules"])
  ],
  match_three: [
    q("match_target", "消除目标", "本关三消目标应该是什么？", ["收集指定颜色", "打破障碍块", "护送目标到底部"], "收集指定颜色", ["winCondition", "stageGoals"]),
    q("match_chain", "连锁", "连锁反应如何制造爽感？", ["连锁加分", "全屏爆破", "生成特殊道具"], "生成特殊道具", ["feedbackRules", "progressionRules"]),
    q("match_special", "特殊道具", "特殊道具应该提供什么能力？", ["横竖清除", "同色清除", "区域爆炸"], "横竖清除", ["specialActions", "attackRules"]),
    q("match_limit", "步数", "步数或时间限制应如何给压力？", ["固定步数", "倒计时", "目标递增"], "固定步数", ["failCondition", "spawnTimeline"]),
    q("match_reward", "通关反馈", "通关奖励如何鼓励下一关？", ["星级评价", "道具奖励", "连胜奖励"], "星级评价", ["winCondition", "feedbackRules"])
  ],
  light_rpg: [
    q("rpg_skill", "技能", "主角第一套技能应该是什么定位？", ["近战连击", "远程法术", "治疗与护盾"], "近战连击", ["specialActions", "attackRules"]),
    q("rpg_monster", "怪物", "怪物压力主要来自什么？", ["近战追击", "远程弹幕", "精英怪技能"], "近战追击", ["enemyArchetypes", "spawnRules"]),
    q("rpg_quest", "任务", "第一分钟任务目标是什么？", ["救援 NPC", "收集材料", "击败小 Boss"], "收集材料", ["stageGoals", "winCondition"]),
    q("rpg_inventory", "背包", "背包或掉落如何影响成长？", ["装备升级", "药水补给", "任务物品"], "装备升级", ["progressionRules", "rewardPath"]),
    q("rpg_growth", "成长", "升级反馈应该突出什么？", ["技能解锁", "属性提升", "新区域开放"], "技能解锁", ["feedbackRules", "encounterTimeline"])
  ]
};

const profileGameplayPlans: Record<GameDevPromptProfileId, ProfileGameplayPlan> = {
  side_scroll_action_adventure: plan("side_scroll_action_adventure", ["patrol_routes", "ranged_throw", "parallax_platforming"], ["jump", "shoot", "dash"], ["0s safe run", "8s patrol enemy", "22s miniboss gate"], ["hidden scroll unlocks stronger throw"]),
  two_d_fighting: plan("two_d_fighting", ["combo_chain", "block_window", "hit_stun"], ["light_attack", "heavy_attack", "block"], ["0s spacing", "10s combo prompt", "25s rival rush"], ["combo meter unlocks finisher"]),
  steampunk_action_adventure: plan("steampunk_action_adventure", ["mount_inertia", "mechanical_switches", "fog_reveal"], ["jump", "interact", "dash"], ["0s mount", "12s switch", "28s machine gate"], ["scrap upgrades engine control"]),
  vertical_flight_shooter: plan("vertical_flight_shooter", ["enemy_formations", "projectile_pressure", "weapon_upgrades"], ["shoot", "boost", "shield"], ["0s safe flight", "8s V formation", "24s boss pressure"], ["power-up changes the attack pattern before the finale"]),
  strategy_tower_defense: plan("strategy_tower_defense", ["path_defense", "tower_building", "wave_economy"], ["build", "upgrade", "repair"], ["0s route preview", "8s first wave", "25s mixed rush"], ["gold converts into tower upgrades between waves"]),
  logic_puzzle: plan("logic_puzzle", ["path_connect", "move_budget", "blocked_tiles"], ["push", "reset", "hint"], ["0s rule tile", "10s blocked route", "25s limited solution"], ["stars reward fewer moves"]),
  point_click_adventure: plan("point_click_adventure", ["inventory_combine", "clue_chain", "room_unlock"], ["interact", "combine", "choose"], ["0s inspect", "12s clue combine", "30s unlock"], ["clues unlock branching ending"]),
  board_strategy: plan("board_strategy", ["turn_tactics", "skill_range", "legal_hints"], ["select", "move", "skill"], ["0s move hint", "12s enemy response", "30s checkmate setup"], ["territory unlocks skill charge"]),
  shooting_tower_defense: plan("shooting_tower_defense", ["manual_aim", "auto_turrets", "lane_defense"], ["shoot", "build", "repair"], ["0s aim", "10s place turret", "28s lane rush"], ["ammo pickups sustain manual fire"]),
  simulation_management: plan("simulation_management", ["orders", "customer_mood", "income_upgrade"], ["choose", "serve", "upgrade"], ["0s first order", "15s mood pressure", "35s rush hour"], ["income unlocks station upgrades"]),
  farm_life: plan("farm_life", ["planting", "weather", "market_price"], ["plant", "water", "sell"], ["0s plant", "15s weather", "35s market"], ["better tools increase harvest value"]),
  pet_care: plan("pet_care", ["feeding", "training", "evolution"], ["feed", "train", "play"], ["0s feed", "15s train", "35s evolution preview"], ["affection unlocks pet form"]),
  romance_visual_novel: plan("romance_visual_novel", ["branch_dialogue", "affection", "event_route"], ["choose", "inspect", "save"], ["0s choice", "15s affection", "35s route event"], ["memories unlock endings"]),
  match_three: plan("match_three", ["match_grid", "chain_reactions", "special_items"], ["swap", "clear", "booster"], ["0s first match", "12s special tile", "30s target clear"], ["chain reactions generate boosters"]),
  platform_jumper: plan("platform_jumper", ["jump_timing", "moving_platforms", "checkpoint_route"], ["jump", "double_jump", "dash"], ["0s short jump", "10s moving platform", "26s checkpoint finale"], ["hidden gems unlock dash refill"]),
  sports_competition: plan("sports_competition", ["timer_clutch", "opponent_pressure", "skill_shot"], ["shoot", "pass", "steal"], ["0s first shot", "12s defender", "30s clutch"], ["score streak improves stamina"]),
  card_battle: plan("card_battle", ["draw_mana", "turn_resolution", "deck_upgrade"], ["draw", "play_card", "combo"], ["0s draw", "12s enemy turn", "30s lethal setup"], ["new cards change deck curve"]),
  racing: plan("racing", ["steering", "drift", "boost_pickup"], ["steer", "drift", "boost"], ["0s steer", "10s drift", "30s final lap"], ["lap medals unlock vehicle upgrades"]),
  light_rpg: plan("light_rpg", ["quest_loop", "monster_combat", "loot_growth"], ["attack", "skill", "interact"], ["0s first quest", "12s monster fight", "35s boss gate"], ["xp unlocks skills and new route"]),
  three_d_space_shooter: plan("three_d_space_shooter", ["depth_flight", "enemy_squadrons", "shield_pressure"], ["shoot", "boost", "shield"], ["0s 3D movement", "10s squadron", "30s boss phase"], ["energy cores upgrade weapons"])
};

function q(
  id: string,
  label: string,
  prompt: string,
  options: string[],
  defaultAnswer: string,
  affectsDirector: string[]
): QuestionTemplate {
  return { id, label, prompt, options, defaultAnswer, decisionSlot: "route_layout", affectsDirector };
}

function plan(
  profileId: GameDevPromptProfileId,
  genreMechanics: string[],
  specialActions: string[],
  spawnTimeline: string[],
  progressionRules: string[]
): ProfileGameplayPlan {
  return { profileId, genreMechanics, specialActions, spawnTimeline, progressionRules };
}
