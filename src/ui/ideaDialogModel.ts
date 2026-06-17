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
    content: "信息已经补齐。点击生成后，我会进入游戏生成预览界面。"
  });

  return {
    turns,
    answeredCount: session.answers.length,
    totalQuestions: session.questions.length,
    canGenerate: true
  };
}
