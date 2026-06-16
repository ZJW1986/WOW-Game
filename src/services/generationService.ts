import { createConversationSession } from "../core/conversation";
import { createPublishRecord, runMockPipeline } from "../core/pipeline";
import type {
  PlayFeedback,
  PublishRecord,
  TemplateFamily,
  UserAnswer
} from "../core/types";

export interface GeneratePlayableInput {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
}

export interface SharePayload {
  qrPayload: string;
  webShareData: {
    title: string;
    text: string;
    url: string;
  };
}

export function createGenerationService() {
  return {
    async generatePlayableVersion(input: GeneratePlayableInput) {
      const session = createConversationSession(input.idea, {
        projectId: input.projectId,
        preferredTemplate: input.templateFamily
      });
      const project = runMockPipeline(input.idea);
      project.id = input.projectId;
      project.gameConfig.templateFamily = input.templateFamily;
      const version = {
        id: "v1",
        projectId: input.projectId,
        artifactFiles: project.artifacts.map((artifact) => artifact.fileName),
        status: "published" as const
      };
      const publishRecord = createPublishRecord(input.projectId, version.id, project.title, {
        visibility: "public",
        baseUrl: input.baseUrl
      });
      const share = createSharePayload(publishRecord);
      const feedback: PlayFeedback = {
        versionId: version.id,
        rating: 0,
        comment: "",
        playerName: "",
        iterationSuggestion: "下一版可根据玩家反馈继续调整节奏、数值和关卡。",
        createdAt: "2026-06-17T00:00:00.000Z"
      };

      return {
        session: {
          ...session,
          answers: input.answers
        },
        project,
        version,
        publishRecord,
        share,
        feedback
      };
    }
  };
}

function createSharePayload(publishRecord: PublishRecord): SharePayload {
  return {
    qrPayload: `WOW Game Share URL: ${publishRecord.publicUrl}`,
    webShareData: {
      title: publishRecord.shareTitle,
      text: publishRecord.shareDescription,
      url: publishRecord.publicUrl
    }
  };
}
