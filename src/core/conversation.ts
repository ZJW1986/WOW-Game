import { classifyIdea } from "./pipeline";
import type {
  ConversationSession,
  ConversationStage,
  ConversationTurn,
  DesignQuestion,
  TemplateFamily
} from "./types";

const FIXED_TIME = "2026-06-17T00:00:00.000Z";

export function createConversationSession(
  idea: string,
  options: {
    projectId?: string;
    preferredTemplate?: TemplateFamily;
    questions?: DesignQuestion[];
  } = {}
): ConversationSession {
  const questions = options.questions ?? createGuidedQuestions(idea, options.preferredTemplate);
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
        `WOW Game 会把创意转成标准游戏生产产物。推荐模板：${options.preferredTemplate ?? "auto"}`
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
  return {
    ...session,
    stage,
    answers,
    turns: [
      ...session.turns,
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
      choiceQuestion("jump_feel", "跳跃手感", "横版关卡里，玩家跳跃应该偏轻快、精准，还是带一点惯性？", [
        "轻快精准",
        "有惯性和挑战",
        "更适合新手"
      ], "轻快精准"),
      choiceQuestion("level_route", "关卡路线", "第一版更像连续平台冲刺，还是收集金币后到达终点？", [
        "连续平台冲刺",
        "收集后到终点",
        "避开尖刺到终点"
      ], "收集后到终点")
    ],
    top_down: [
      choiceQuestion("movement_style", "移动方式", "俯视角里，玩家主要是自由移动躲避，还是带冲刺技能穿越危险区？", [
        "自由移动躲避",
        "带冲刺技能",
        "边移动边收集"
      ], "自由移动躲避"),
      choiceQuestion("enemy_pressure", "敌人压力", "危险物应该静态分布、巡逻移动，还是主动追踪玩家？", [
        "静态分布",
        "巡逻移动",
        "主动追踪"
      ], "主动追踪")
    ],
    grid_logic: [
      choiceQuestion("rule_goal", "解谜目标", "格子玩法的目标是推箱到位、点亮所有格子，还是有限步数收集？", [
        "推箱到位",
        "点亮所有格子",
        "有限步数收集"
      ], "有限步数收集"),
      choiceQuestion("move_limit", "步数限制", "第一版是否需要步数限制来制造解谜压力？", [
        "需要 20 步限制",
        "需要 30 步限制",
        "暂时不限制"
      ], "需要 30 步限制")
    ],
    tower_defense: [
      choiceQuestion("tower_types", "防御塔类型", "第一版需要哪些防御塔差异：快速、范围、减速，还是先只做一种？", [
        "快速塔+范围塔",
        "快速塔+减速塔",
        "先只做一种基础塔"
      ], "快速塔+范围塔"),
      choiceQuestion("wave_pressure", "波次压力", "敌人波次应该是少量高血量，还是大量低血量？", [
        "少量高血量",
        "大量低血量",
        "混合波次"
      ], "混合波次")
    ],
    ui_heavy: [
      choiceQuestion("choice_loop", "选择循环", "核心选择是卡牌组合、资源经营，还是剧情分支？", [
        "卡牌组合",
        "资源经营",
        "剧情分支"
      ], "卡牌组合"),
      {
        id: "round_goal",
        label: "回合目标",
        prompt: "每回合玩家要达成什么目标才算推进？",
        inputType: "short_text",
        defaultAnswer: "选择最优卡牌组合并让资源保持正增长",
        required: true
      }
    ]
  };

  const sharedQuestions = createSharedGuidedQuestions(templateFamily);
  return [sharedQuestions[0], ...familyQuestions[templateFamily], sharedQuestions[1]];
}

function createSharedGuidedQuestions(templateFamily: TemplateFamily): DesignQuestion[] {
  return [
    {
      id: "goal",
      label: "胜利目标",
      prompt: "玩家怎样算赢？",
      inputType: "short_text",
      defaultAnswer:
        templateFamily === "platformer"
          ? "到达终点并收集 6 枚金币"
          : templateFamily === "tower_defense"
            ? "守住基地并击退 3 波敌人"
            : templateFamily === "grid_logic"
              ? "在限制步数内完成目标状态"
              : "收集 6 颗星星并避开所有危险物",
      required: true
    },
    {
      id: "failure",
      label: "失败条件",
      prompt: "玩家怎样会失败？",
      inputType: "short_text",
      defaultAnswer:
        templateFamily === "tower_defense"
          ? "敌人突破基地生命值"
          : "碰到危险物或生命值耗尽",
      required: true
    },
    {
      id: "style",
      label: "美术风格",
      prompt: "画面应该是什么风格？",
      inputType: "single_choice",
      options: ["霓虹科幻", "森林童话", "像素街机", "极简几何"],
      defaultAnswer: "霓虹科幻",
      required: true
    },
    {
      id: "duration",
      label: "单局时长",
      prompt: "第一版试玩应该持续多久？",
      inputType: "single_choice",
      options: ["30 秒", "60 秒", "90 秒"],
      defaultAnswer: "60 秒",
      required: true
    }
  ];
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
