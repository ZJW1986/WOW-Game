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
  canStartAssets: boolean;
  isPreparingAssets: boolean;
  buttonLabel: string;
  statusLabel: string;
}

export interface IdeaDialogCopy {
  readyForAssets: string;
  generateAssets: string;
  generate: string;
  send: string;
  statusConfirmAssets: string;
  statusGenerateAssetsNext: string;
  statusCoreAssetsConfirmed: string;
}

const defaultIdeaDialogCopy: IdeaDialogCopy = {
  readyForAssets: "Information is complete. Generate assets first, then confirm materials before building the playable game.",
  generateAssets: "Generate assets",
  generate: "Generate game",
  send: "Send",
  statusConfirmAssets: "Confirm background, player, hazard, and collectible before generating the game.",
  statusGenerateAssetsNext: "Questions are complete. Generate core assets next.",
  statusCoreAssetsConfirmed: "Core assets confirmed. Generate the playable build."
};

export function buildIdeaDialogModel(
  session: ConversationSession,
  copy: IdeaDialogCopy = defaultIdeaDialogCopy
): IdeaDialogModel {
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
    content: copy.readyForAssets
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
  copy?: IdeaDialogCopy;
}): IdeaDialogActionState {
  const copy = input.copy ?? defaultIdeaDialogCopy;
  const hasAnsweredQuestions = input.session.answers.length >= input.session.questions.length;
  const isPreparingAssets =
    hasAnsweredQuestions &&
    input.hasDesignBrief &&
    input.hasAssetCandidates &&
    !input.hasConfirmedAssets &&
    input.creationPhase !== "cooking" &&
    input.creationPhase !== "ready";

  const canStartAssets =
    hasAnsweredQuestions &&
    !input.hasAssetCandidates &&
    ["chatting", "guided_questions", "asset_review", "revision"].includes(input.creationPhase);

  const canGenerate =
    hasAnsweredQuestions &&
    input.hasDesignBrief &&
    input.hasConfirmedAssets &&
    ["assets_confirmed", "ready"].includes(input.creationPhase);

  if (isPreparingAssets) {
    return {
      canGenerate: false,
      canStartAssets: false,
      isPreparingAssets: true,
      buttonLabel: copy.generateAssets,
      statusLabel: copy.statusConfirmAssets
    };
  }

  if (canStartAssets) {
    return {
      canGenerate: false,
      canStartAssets: true,
      isPreparingAssets: false,
      buttonLabel: copy.generateAssets,
      statusLabel: copy.statusGenerateAssetsNext
    };
  }

  if (canGenerate) {
    return {
      canGenerate: true,
      canStartAssets: false,
      isPreparingAssets: false,
      buttonLabel: copy.generate,
      statusLabel: copy.statusCoreAssetsConfirmed
    };
  }

  return {
    canGenerate: false,
    canStartAssets: false,
    isPreparingAssets: false,
    buttonLabel: copy.send,
    statusLabel: ""
  };
}
