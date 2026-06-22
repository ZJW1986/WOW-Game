import type {
  AssetCandidates,
  ConversationSession,
  DesignBrief,
  MockProject,
  RevisionAnalysis,
  ThreeAssetCandidates
} from "../core/types";
import type { getMessages } from "./i18n";

export type StudioChatPhase =
  | "chatting"
  | "ai_thinking"
  | "guided_questions"
  | "asset_generating"
  | "asset_review"
  | "assets_confirmed"
  | "three_asset_generating"
  | "three_asset_review"
  | "three_assets_confirmed"
  | "revision"
  | "revision_thinking"
  | "cooking"
  | "ready"
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
  threeAssetCandidates?: ThreeAssetCandidates;
  assetProgress?: AssetProgressStep[];
}

export interface AssetProgressStep {
  slot: "background" | "player" | "hazard" | "collectible";
  label: string;
  status: "generating";
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
  threeAssetCandidates,
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
  threeAssetCandidates?: ThreeAssetCandidates | null;
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
    const assetProgress = createAssetProgressSteps();
    const isThreeAssets = phase === "three_asset_generating";
    result.push({
      id: isThreeAssets ? "three-asset-candidates-loading" : "asset-candidates-loading",
      role: "assistant",
      meta: isThreeAssets ? "3D模型生成" : "素材生成",
      content: isThreeAssets
        ? "Tripo3D 正在生成玩家、障碍物和收集物模型。"
        : [
            "AI 正在根据开发提示词生成核心素材。",
            ...assetProgress.map((step) => `${step.label}生成中`)
          ].join("\n"),
      assetProgress: isThreeAssets ? undefined : assetProgress
    });
  } else if (assetCandidateStatus === "failed") {
    result.push({
      id: "asset-candidates-failed",
      role: "assistant",
      meta: phase === "three_asset_review" ? "3D模型生成失败" : "素材生成失败",
      content:
        phase === "three_asset_review"
          ? "3D 模型生成失败。请检查 TRIPO_API_KEY，或上传 GLB/GLTF 替换后再生成游戏。"
          : "图片生成失败。请重试、上传替换素材，或在素材卡中使用占位图继续；确认核心素材前不会生成游戏。"
    });
  } else if (assetCandidates) {
    result.push({
      id: "asset-candidates",
      role: "assistant",
      meta: "素材确认",
      content: "请确认背景、主角、危险物和收集物。确认后，最终游戏会通过 asset-pack.json 使用这些素材。",
      assetCandidates
    });
  } else if (threeAssetCandidates) {
    result.push({
      id: "three-asset-candidates",
      role: "assistant",
      meta: "3D模型确认",
      content: "请确认玩家、障碍物和收集物三个 Tripo3D 模型。确认后，Three.js 会从 three-asset-pack.json 加载这些模型。",
      threeAssetCandidates
    });
  }

  if (phase === "assets_confirmed") {
    result.push({
      id: "assistant-assets-confirmed",
      role: "assistant",
      meta: "素材已确认",
      content: "核心素材已确认。现在可以生成可玩游戏，Phaser 运行时会从最终 asset-pack.json 读取这些素材。"
    });
  }

  if (phase === "three_assets_confirmed") {
    result.push({
      id: "assistant-three-assets-confirmed",
      role: "assistant",
      meta: "3D模型已确认",
      content: "三个核心 3D 模型已确认。现在可以生成 Three.js 可玩游戏。"
    });
  }

  if (phase === "ready") {
    const matureBrief = project.artifacts.find((artifact) => artifact.fileName === "mature-game-brief.json");
    const matureSummary =
      typeof matureBrief?.content === "object" && matureBrief.content !== null
        ? `成熟体验：${JSON.stringify(matureBrief.content).slice(0, 120)}`
        : "成熟体验：已生成关卡节奏和反馈规则";
    result.push({
      id: `assistant-${phase}`,
      role: "assistant",
      meta: messages.thinking.completeTitle,
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

function createAssetProgressSteps(): AssetProgressStep[] {
  return [
    { slot: "background", label: "背景", status: "generating" },
    { slot: "player", label: "主角", status: "generating" },
    { slot: "hazard", label: "危险物", status: "generating" },
    { slot: "collectible", label: "收集物", status: "generating" }
  ];
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
