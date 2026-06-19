import type { AssetCandidates, ConversationSession, DesignBrief, MockProject, RevisionAnalysis } from "../core/types";
import type { getMessages } from "./i18n";

export type StudioChatPhase =
  | "chatting"
  | "ai_thinking"
  | "guided_questions"
  | "asset_review"
  | "ready_to_generate"
  | "revision"
  | "revision_thinking"
  | "cooking"
  | "ready"
  | "playable_ready"
  | "failed";

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
  assetCandidates?: AssetCandidates;
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
    inferredFollowups: rest.map((line) => line.replace(/^(补充需求|追加需求|需求补充)\s*[:：]\s*/, ""))
  };
}

export function buildStudioChatMessages({
  idea,
  followups,
  project,
  messages,
  phase,
  session,
  referencePackageName,
  designBrief,
  revisionHistory,
  assetCandidates,
  assetCandidateStatus
}: {
  idea: string;
  followups: StudioFollowup[];
  project: MockProject;
  messages: ReturnType<typeof getMessages>;
  phase: StudioChatPhase;
  session?: ConversationSession;
  referencePackageName?: string;
  designBrief?: DesignBrief | null;
  revisionHistory?: RevisionAnalysis[];
  assetCandidates?: AssetCandidates | null;
  assetCandidateStatus?: "idle" | "loading" | "ready" | "failed";
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
  const visibleFollowups = dedupeFollowups(normalizedFollowups);

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

  if (referencePackageName) {
    result.push({
      id: "reference-package",
      role: "system",
      meta: "参考案例",
      content: `已参考：${referencePackageName}`
    });
  }

  if (designBrief) {
    result.push({
      id: "design-brief",
      role: "assistant",
      meta: "AI 设计分析",
      content: [
        designBrief.coreGameplay,
        `目标：${designBrief.playerGoal}`,
        `开发提示词：${designBrief.developerPrompt}`
      ].join("\n")
    });
  }

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

  for (const followup of visibleFollowups) {
    result.push({
      id: followup.id,
      role: "user",
      meta: "补充需求",
      content: followup.content
    });
  }

  for (const revision of revisionHistory ?? []) {
    result.push({
      id: `revision-${revision.updatedDeveloperPrompt.slice(0, 24)}`,
      role: "assistant",
      meta: "追加需求分析",
      content: [revision.understoodChange, revision.updatedDeveloperPrompt].join("\n")
    });
  }

  if (assetCandidateStatus === "loading") {
    result.push({
      id: "asset-candidates-loading",
      role: "assistant",
      meta: "素材提示词",
      content: "AI 正在生成素材提示词。你可以先生成游戏，素材完成后会在这里确认。"
    });
  } else if (assetCandidateStatus === "failed") {
    result.push({
      id: "asset-candidates-failed",
      role: "assistant",
      meta: "素材提示词",
      content: "素材提示词生成失败，已使用占位资源继续，不影响游戏试玩。"
    });
  } else if (assetCandidates) {
    result.push({
      id: "asset-candidates",
      role: "assistant",
      meta: "素材确认",
      content: "素材已生成，可选确认。当前游戏可先用占位资源生成，确认素材后下一次生成会采用这些方向。",
      assetCandidates
    });
  }

  if (phase === "ready_to_generate") {
    result.push({
      id: "assistant-ready-to-generate",
      role: "assistant",
      meta: messages.chat.readyMeta,
      content: [
        "我已经可以开始生成首版游戏。",
        `${messages.thinking.goal}: ${project.gameConfig.playerGoal}`,
        `${messages.thinking.controls}: ${project.gameConfig.controls.join(" / ")}`,
        `${messages.thinking.assets}: ${project.assetPack.assets.length} items`
      ].join("\n")
    });
  } else if (phase !== "chatting") {
    const matureBrief = project.artifacts.find((artifact) => artifact.fileName === "mature-game-brief.json");
    const matureSummary =
      typeof matureBrief?.content === "object" && matureBrief.content !== null
        ? `成熟体验：${JSON.stringify(matureBrief.content).slice(0, 120)}`
        : "成熟体验：已生成关卡节奏和反馈规则";
    result.push({
      id: `assistant-${phase}`,
      role: "assistant",
      meta: phase === "ready" ? messages.thinking.completeTitle : messages.thinking.title,
      content: [
        `${project.title} ${messages.agent.readySuffix}`,
        `${messages.thinking.goal}: ${project.gameConfig.playerGoal}`,
        `${messages.thinking.controls}: ${project.gameConfig.controls.join(" / ")}`,
        `${messages.thinking.assets}: ${project.assetPack.assets.length} items`,
        matureSummary,
        project.gameConfig.pitch
      ].join("\n")
    });
  }

  return result;
}

function dedupeFollowups(followups: StudioFollowup[]): StudioFollowup[] {
  const seen = new Set<string>();
  return followups.filter((followup) => {
    const key = followup.content.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
