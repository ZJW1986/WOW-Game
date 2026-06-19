import type { ConversationSession, DesignQuestion } from "../core/types";

export interface IdeaDialogTurn {
  id: string;
  role: "assistant" | "user";
  content: string;
  question?: DesignQuestion;
  answer?: string;
}

export interface IdeaDialogModel {
  turns: IdeaDialogTurn[];
  currentQuestion?: DesignQuestion;
  answeredCount: number;
  totalQuestions: number;
  canGenerate: boolean;
}

export interface IdeaDialogActionState {
  canGenerate: boolean;
  isPreparingAssets: boolean;
  buttonLabel: string;
  statusLabel: string;
}

export function buildIdeaDialogModel(session: ConversationSession): IdeaDialogModel {
  const turns: IdeaDialogTurn[] = [
    {
      id: "idea",
      role: "user",
      content: session.idea
    }
  ];

  for (const question of session.questions) {
    const answer = session.answers.find((item) => item.questionId === question.id);
    turns.push({
      id: `question-${question.id}`,
      role: "assistant",
      content: question.prompt,
      question
    });

    if (!answer) {
      return {
        turns,
        currentQuestion: question,
        answeredCount: session.answers.length,
        totalQuestions: session.questions.length,
        canGenerate: false
      };
    }

    turns.push({
      id: `answer-${question.id}`,
      role: "user",
      content: answer.value,
      answer: answer.value
    });
  }

  turns.push({
    id: "ready",
    role: "assistant",
    content: "信息已经补齐，可以开始生成首版游戏。"
  });

  return {
    turns,
    answeredCount: session.answers.length,
    totalQuestions: session.questions.length,
    canGenerate: true
  };
}

export function readIdeaDialogActionState(input: {
  session: ConversationSession;
  hasDesignBrief: boolean;
  hasAssetCandidates: boolean;
  hasConfirmedAssets: boolean;
  creationPhase: string;
}): IdeaDialogActionState {
  const hasAnsweredQuestions = input.session.answers.length >= input.session.questions.length;
  const isPreparingAssets =
    hasAnsweredQuestions &&
    input.hasDesignBrief &&
    (!input.hasAssetCandidates || !input.hasConfirmedAssets) &&
    input.creationPhase !== "cooking" &&
    input.creationPhase !== "ready";
  const canGenerate =
    hasAnsweredQuestions &&
    ["chatting", "ai_thinking", "guided_questions", "asset_review", "ready_to_generate", "revision", "ready"].includes(input.creationPhase);

  if (isPreparingAssets) {
    return {
      canGenerate,
      isPreparingAssets: true,
      buttonLabel: "生成游戏",
      statusLabel: "AI 正在生成素材提示词，不影响生成游戏"
    };
  }

  return {
    canGenerate,
    isPreparingAssets: false,
    buttonLabel: canGenerate ? "生成游戏" : "发送",
    statusLabel: canGenerate
      ? input.hasDesignBrief
        ? "信息已补齐，可以生成游戏"
        : "信息已补齐，可用本地兜底方案生成游戏"
      : ""
  };
}
