import type { ConversationSession, MockProject } from "../core/types";
import type { getMessages } from "./i18n";

export type StudioChatPhase = "thinking" | "proposal" | "revision" | "generating" | "complete";

export interface StudioFollowup {
  id: string;
  content: string;
  createdAt: string;
}

export interface StudioChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  meta: string;
}

export function buildGenerationIdea(idea: string, followups: StudioFollowup[]): string {
  const additions = followups.map((item) => item.content.trim()).filter(Boolean);
  if (additions.length === 0) return idea;
  return [idea, ...additions.map((item) => `补充需求：${item}`)].join("\n");
}

function splitIdeaTurns(idea: string): { idea: string; inferredFollowups: string[] } {
  const lines = idea
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [firstLine = idea, ...rest] = lines;
  return {
    idea: firstLine,
    inferredFollowups: rest.map((line) => line.replace(/^(补充需求|琛ゅ厖闇\S*)[:：]\s*/, ""))
  };
}

export function buildStudioChatMessages({
  idea,
  followups,
  project,
  messages,
  phase,
  session
}: {
  idea: string;
  followups: StudioFollowup[];
  project: MockProject;
  messages: ReturnType<typeof getMessages>;
  phase: StudioChatPhase;
  session?: ConversationSession;
}): StudioChatMessage[] {
  const splitIdea = splitIdeaTurns(idea);
  const normalizedFollowups =
    followups.length > 0
      ? followups
      : splitIdea.inferredFollowups.map((content, index) => ({
          id: `inferred-followup-${index + 1}`,
          content,
          createdAt: ""
        }));

  const result: StudioChatMessage[] = [
    {
      id: "assistant-intro",
      role: "assistant",
      meta: messages.agent.pipelineLabel,
      content: messages.agent.intro
    },
    {
      id: "idea",
      role: "user",
      meta: "创意想法",
      content: splitIdea.idea
    }
  ];

  if (session) {
    for (const question of session.questions) {
      result.push({
        id: `question-${question.id}`,
        role: "assistant",
        meta: question.label,
        content: question.prompt
      });
      const answer = session.answers.find((item) => item.questionId === question.id);
      if (!answer) break;
      result.push({
        id: `answer-${question.id}`,
        role: "user",
        meta: "回答",
        content: answer.value
      });
    }
  }

  for (const followup of normalizedFollowups) {
    result.push({
      id: followup.id,
      role: "user",
      meta: "补充需求",
      content: followup.content
    });
  }

  if (phase !== "thinking") {
    result.push({
      id: `assistant-${phase}`,
      role: "assistant",
      meta: phase === "complete" ? messages.thinking.completeTitle : messages.thinking.title,
      content: [
        `${project.title} ${messages.agent.readySuffix}`,
        `${messages.thinking.goal}: ${project.gameConfig.playerGoal}`,
        `${messages.thinking.controls}: ${project.gameConfig.controls.join(" / ")}`,
        `${messages.thinking.assets}: ${project.assetPack.assets.length} items`,
        project.gameConfig.pitch
      ].join("\n")
    });
  }

  return result;
}
