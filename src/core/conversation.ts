import { classifyIdea } from "./pipeline";
import type {
  ConversationSession,
  ConversationStage,
  ConversationTurn,
  DesignQuestion,
  EngineType,
  TemplateFamily,
  ThreeGameGenre
} from "./types";
import { getThreeGenreProfile } from "./threeGenreProfiles";

const FIXED_TIME = "2026-06-17T00:00:00.000Z";

export function createConversationSession(
  idea: string,
  options: {
    projectId?: string;
    engineType?: EngineType;
    preferredTemplate?: TemplateFamily;
    threeGameGenre?: ThreeGameGenre;
    questions?: DesignQuestion[];
  } = {}
): ConversationSession {
  const questions =
    options.questions ??
    (options.engineType === "threejs3d"
      ? createThreeGuidedQuestions(idea, options.threeGameGenre)
      : createGuidedQuestions(idea, options.preferredTemplate));
  return {
    id: "session-1",
    projectId: options.projectId ?? "project-1",
    idea,
    stage: "guided_questions",
    questions,
    answers: [],
    turns: [
      turn(
        "system",
        "idea_intake",
        `WOW Game 会把创意转换成标准游戏生产产物。推荐模板：${options.preferredTemplate ?? "auto"}`
      ),
      turn("user", "idea_intake", idea),
      turn(
        "assistant",
        "guided_questions",
        `我已经理解你的创意。为了生成可玩的第一版，请先回答 ${questions.length} 个关键问题。`
      )
    ]
  };
}

export function answerDesignQuestion(
  session: ConversationSession,
  questionId: string,
  value: string
): ConversationSession {
  const question = session.questions.find((item) => item.id === questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }
  const answers = [
    ...session.answers.filter((answer) => answer.questionId !== questionId),
    { questionId, value, answeredAt: FIXED_TIME }
  ];
  const stage: ConversationStage =
    answers.length >= session.questions.length ? "gdd_review" : "guided_questions";
  const answerPrefix = `${question.label}:`;
  return {
    ...session,
    stage,
    answers,
    turns: [
      ...session.turns.filter(
        (item) =>
          !(item.role === "user" && item.stage === "guided_questions" && item.content.startsWith(answerPrefix))
      ),
      turn("user", "guided_questions", `${question.label}: ${value}`),
      ...(stage === "gdd_review"
        ? [turn("assistant", "gdd_review", "信息已经补齐，可以开始生成首版游戏。")]
        : [])
    ]
  };
}

export function getNextConversationAction(session: ConversationSession) {
  return {
    stage: session.stage,
    canGenerateArtifact: session.stage !== "guided_questions",
    nextLabel:
      session.stage === "guided_questions"
        ? "继续回答问题"
        : session.stage === "gdd_review"
          ? "生成 GDD"
          : "继续下一阶段"
  };
}

export function createGuidedQuestions(idea: string, preferredTemplate?: TemplateFamily): DesignQuestion[] {
  const templateFamily = preferredTemplate ?? classifyIdea(idea).templateFamily;
  const familyQuestions: Record<TemplateFamily, DesignQuestion[]> = {
    platformer: [
      choiceQuestion(
        "core_action",
        "关卡节奏",
        "平台关卡的第一分钟应该怎样推进平台、陷阱、金币路径和终点压力？",
        ["先低台教学，再金币路径，最后尖刺和终点", "连续跳台加移动陷阱，节奏更紧张", "短平台加安全检查点，适合新手"],
        "先低台教学，再金币路径，最后尖刺和终点"
      ),
      choiceQuestion(
        "character_enemy_item",
        "角色与道具",
        "主角、危险物和收集物分别是什么？",
        ["冒险者 / 尖刺 / 金币", "机器人 / 激光 / 电池", "小动物 / 陷阱 / 宝石"],
        "冒险者 / 尖刺 / 金币"
      )
    ],
    top_down: [
      choiceQuestion(
        "core_action",
        "敌人/障碍行为",
        "俯视角里，敌人和障碍应该如何制造压力？",
        ["追踪敌人加陨石波次", "巡逻敌人加地雷预警", "弹幕敌人加奖励路线"],
        "追踪敌人加陨石波次"
      ),
      choiceQuestion(
        "character_enemy_item",
        "角色与道具",
        "主角、敌人或障碍、收集物分别是什么？",
        ["飞船 / 陨石 / 星星", "太空猫 / 陨石 / 鱼干", "探险者 / 机器人 / 能量核心"],
        "飞船 / 陨石 / 星星"
      )
    ],
    grid_logic: [
      choiceQuestion(
        "core_action",
        "核心规则",
        "格子玩法的核心解法是什么？",
        ["推箱到位", "点亮所有格子", "有限步数收集目标"],
        "有限步数收集目标"
      ),
      choiceQuestion(
        "character_enemy_item",
        "棋子与目标",
        "玩家棋子、阻碍格和目标物分别是什么？",
        ["光标 / 墙块 / 宝石", "机器人 / 箱子 / 出口", "魔法师 / 封印 / 符文"],
        "光标 / 墙块 / 宝石"
      )
    ],
    tower_defense: [
      choiceQuestion(
        "core_action",
        "防守方式",
        "第一版希望玩家主要做哪种防守决策？",
        ["放置快速塔和范围塔", "放置快速塔和减速塔", "先只做一种基础塔"],
        "放置快速塔和范围塔"
      ),
      choiceQuestion(
        "character_enemy_item",
        "防御元素",
        "防御塔、敌人和奖励资源分别是什么？",
        ["炮塔 / 小怪 / 水晶", "弓塔 / 史莱姆 / 金币", "激光塔 / 无人机 / 能量"],
        "炮塔 / 小怪 / 水晶"
      )
    ],
    ui_heavy: [
      choiceQuestion(
        "core_action",
        "选择循环",
        "核心选择是卡牌组合、资源经营，还是剧情分支？",
        ["卡牌组合", "资源经营", "剧情分支"],
        "卡牌组合"
      ),
      choiceQuestion(
        "character_enemy_item",
        "界面元素",
        "玩家主要管理哪些角色、资源或压力指标？",
        ["英雄卡 / 能量 / 倒计时", "商店 / 金币 / 顾客耐心", "角色关系 / 线索 / 风险值"],
        "英雄卡 / 能量 / 倒计时"
      )
    ]
  };

  return [
    sharedQuestion("goal", templateFamily),
    familyQuestions[templateFamily][0],
    sharedQuestion("failure", templateFamily),
    familyQuestions[templateFamily][1],
    sharedQuestion("style_audio_pacing", templateFamily)
  ];
}

export function createThreeGuidedQuestions(
  idea: string,
  preferredGenre: ThreeGameGenre = "flight_shooter"
): DesignQuestion[] {
  void idea;
  return getThreeGenreProfile(preferredGenre).questions.map((question) => ({ ...question }));
}

function sharedQuestion(id: "goal" | "failure" | "style_audio_pacing", templateFamily: TemplateFamily): DesignQuestion {
  if (id === "goal") {
    return {
      id: "goal",
      label: "玩法目标",
      prompt: "玩家怎样才算赢？请用一句话说明第一版的胜利目标。",
      inputType: "short_text",
      defaultAnswer:
        templateFamily === "platformer"
          ? "收集 6 枚金币并到达终点"
          : templateFamily === "tower_defense"
            ? "守住基地并击退 3 波敌人"
            : templateFamily === "grid_logic"
              ? "在有限步数内完成目标状态"
              : "收集 6 个目标物并避开所有危险物",
      required: true
    };
  }
  if (id === "failure") {
    return {
      id: "failure",
      label: "奖励/失败反馈",
      prompt: "玩家获得奖励和失败时，系统应该给出什么反馈？",
      inputType: "short_text",
      defaultAnswer:
        templateFamily === "tower_defense"
          ? "敌人突破基地生命值"
          : "碰到危险物或生命值耗尽",
      required: true
    };
  }
  return {
    id: "style_audio_pacing",
    label: "关卡节奏/视听",
    prompt: "画面风格、音效氛围和第一关节奏希望是什么？",
    inputType: "single_choice",
    options: [
      "霓虹科幻 / 电子音效 / 30 秒快速上手",
      "森林童话 / 轻快音效 / 60 秒渐进挑战",
      "像素街机 / 复古音效 / 90 秒高压挑战",
      "极简几何 / 清脆音效 / 45 秒专注体验"
    ],
    defaultAnswer: "霓虹科幻 / 电子音效 / 30 秒快速上手",
    required: true
  };
}

function choiceQuestion(
  id: string,
  label: string,
  prompt: string,
  options: string[],
  defaultAnswer: string
): DesignQuestion {
  return {
    id,
    label,
    prompt,
    inputType: "single_choice",
    options,
    defaultAnswer,
    required: true
  };
}

function turn(role: ConversationTurn["role"], stage: ConversationStage, content: string): ConversationTurn {
  return {
    id: `${role}-${stage}-${content.length}`,
    role,
    stage,
    content,
    createdAt: FIXED_TIME
  };
}
