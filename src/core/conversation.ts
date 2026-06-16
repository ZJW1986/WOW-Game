import type {
  ConversationSession,
  ConversationStage,
  ConversationTurn,
  DesignQuestion
} from "./types";

const FIXED_TIME = "2026-06-17T00:00:00.000Z";

export function createConversationSession(idea: string): ConversationSession {
  const questions = createGuidedQuestions(idea);
  return {
    id: "session-1",
    projectId: "project-1",
    idea,
    stage: "guided_questions",
    questions,
    answers: [],
    turns: [
      turn("system", "idea_intake", "WOW Game 会把创意转成标准游戏生产产物。"),
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
        ? [turn("assistant", "gdd_review", "信息已补齐，可以生成并确认标准 GDD。")]
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

function createGuidedQuestions(idea: string): DesignQuestion[] {
  const isPlatformer = /跳|横版|平台|jump/i.test(idea);
  return [
    {
      id: "goal",
      label: "胜利目标",
      prompt: "玩家怎样算赢？",
      inputType: "short_text",
      defaultAnswer: isPlatformer ? "到达终点并收集 6 个金币" : "收集 6 颗星星并避开所有危险物",
      required: true
    },
    {
      id: "failure",
      label: "失败条件",
      prompt: "玩家怎样会失败？",
      inputType: "short_text",
      defaultAnswer: "碰到危险物或生命值耗尽",
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

function turn(role: ConversationTurn["role"], stage: ConversationStage, content: string): ConversationTurn {
  return {
    id: `${role}-${stage}-${content.length}`,
    role,
    stage,
    content,
    createdAt: FIXED_TIME
  };
}
