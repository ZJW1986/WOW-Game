import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Database,
  FileCode2,
  Gamepad2,
  ImageIcon,
  Library,
  Music2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { answerDesignQuestion, createConversationSession } from "../core/conversation";
import {
  getFeaturedGames,
  getGamesByCategory,
  getPopularGames,
  playCategories,
  type PlayCategory,
  type PlayGame
} from "../core/playCatalog";
import { runMockPipeline } from "../core/pipeline";
import {
  createStartTemplateTiles,
  createStartGameDraft,
  type StartGameDraft,
  type StartUploadedMaterial
} from "../core/start";
import { getOfficialTemplates, startDraftFromTemplate, type TemplateRecord } from "../core/templateCatalog";
import type {
  AssetCandidates,
  ConfirmedAssets,
  DesignBrief,
  AssetRequirement,
  ConversationSession,
  MockProject,
  PipelineArtifact,
  PublishRecord,
  ReferencePackageSummary,
  RevisionAnalysis,
  TemplateFamily,
  UserMaterialSlot
} from "../core/types";
import { getMessages, type Locale } from "./i18n";
import { buildIdeaDialogModel, readIdeaDialogActionState } from "./ideaDialogModel";
import { PhaserPreview } from "./PhaserPreview";
import {
  buildGenerationIdea,
  buildStudioChatMessages,
  type StudioChatMessage,
  type StudioFollowup
} from "./studioChat";
import { createMediaGateway } from "../services/mediaGateway";
import {
  requestAssetCandidates,
  requestDesignBrief,
  requestPlayableGeneration,
  requestGuidedQuestions,
  requestProcessUploadedMaterial,
  requestRegenerateAssetCandidate,
  requestRevisionAnalysis,
  replacePackageAsset,
  requestPlayableProject,
  submitPlayableFeedback,
  uploadPlayablePackage
} from "../services/generationClient";
import { createGenerationService } from "../services/generationService";

const rightTabs = [
  { id: "preview", labelKey: "preview", icon: Gamepad2 },
  { id: "assets", labelKey: "assets", icon: Library },
  { id: "code", labelKey: "code", icon: Code2 }
] as const;

type RightTab = (typeof rightTabs)[number]["id"];
type CreationPhase =
  | "chatting"
  | "ai_thinking"
  | "guided_questions"
  | "asset_generating"
  | "asset_review"
  | "assets_confirmed"
  | "revision"
  | "revision_thinking"
  | "cooking"
  | "ready"
  | "failed";
type AppPage = "create" | "play" | "projects" | "idea_dialog" | "studio";
type GenerationResult = Awaited<ReturnType<ReturnType<typeof createGenerationService>["generatePlayableVersion"]>>;
type GuidedQuestionStatus = "idle" | "loading" | "ready" | "fallback";
type AssetCandidateStatus = "idle" | "loading" | "ready" | "failed";
type GenerationNoticeTone = "working" | "success" | "fallback" | "error";

interface GenerationNotice {
  tone: GenerationNoticeTone;
  title: string;
  detail: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  idea: string;
  contentType: "ai_project" | "uploaded_package";
  editable: boolean;
  shareable: boolean;
  sourceLabel: string;
  status: "published" | "draft" | "private";
  visibility: "public" | "unlisted" | "private";
  updatedAt: string;
  plays: number;
  likes: number;
  templateFamily: TemplateFamily;
  project: MockProject;
}

function createProjectRecord(idea: string, index: number): ProjectRecord {
  const project = runMockPipeline(idea);
  return {
    id: `${project.id}-${index}`,
    title: project.title,
    idea,
    contentType: project.contentType,
    editable: project.editable,
    shareable: project.shareable,
    sourceLabel: project.sourceLabel,
    status: index % 3 === 0 ? "draft" : "published",
    visibility: index % 4 === 0 ? "private" : index % 2 === 0 ? "unlisted" : "public",
    updatedAt: `2026-06-${String(17 - index).padStart(2, "0")}`,
    plays: 1200 - index * 73,
    likes: 180 - index * 9,
    templateFamily: project.classification.templateFamily,
    project
  };
}

const seedProjectIdeas = [
  "做一个霓虹飞船躲避陨石并收集星星的小游戏。",
  "做一个横版机器人跳跃躲避尖刺并收集能量的游戏。",
  "做一个俯视角迷宫里躲避敌人并收集钥匙的游戏。",
  "做一个网格解谜，把能量块推到终点。",
  "做一个塔防小游戏，守住星门抵挡三波敌人。",
  "做一个卡牌选择冒险，玩家通过选择改变结局。",
  "做一个赛博猫收集芯片并避开巡逻机的游戏。",
  "做一个太空矿工收集水晶并返回基地的游戏。",
  "做一个办公室逃脱解谜，用道具打开安全门。",
  "做一个海底潜艇躲避水雷并收集氧气的游戏。",
  "做一个魔法训练场，躲避火球并点亮符文。",
  "做一个城市跑酷，跳过障碍并收集金币。"
];

function getPlayRoute(): { projectId: string; versionId: string } | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/play\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    versionId: decodeURIComponent(match[2])
  };
}

function getBrowserBaseUrl(): string {
  if (typeof window === "undefined") return "http://localhost:5173";
  return window.location.origin;
}

export function upsertGeneratedProjectRecord(
  current: ProjectRecord[],
  project: MockProject,
  publishRecord: PublishRecord
): ProjectRecord[] {
  const record: ProjectRecord = {
    id: project.id,
    title: project.title || project.gameConfig.title,
    idea: project.gameConfig.pitch,
    contentType: "ai_project",
    editable: project.editable,
    shareable: project.shareable,
    sourceLabel: project.sourceLabel,
    status: "published",
    visibility: "public",
    updatedAt: publishRecord.publishedAt.slice(0, 10),
    plays: 0,
    likes: 0,
    templateFamily: project.classification.templateFamily,
    project
  };
  const exists = current.some((item) => item.id === project.id);
  if (exists) return current.map((item) => (item.id === project.id ? { ...item, ...record } : item));
  return [record, ...current];
}

export function hasConfirmedCoreAssets(confirmedAssets?: ConfirmedAssets | null): boolean {
  const required: UserMaterialSlot[] = ["background", "player", "hazard", "collectible"];
  const confirmed = new Set(
    (confirmedAssets?.assets ?? [])
      .filter(
        (asset) =>
          asset.approvalStatus !== "rejected" &&
          isRuntimeImageUrl(asset.fileUrl) &&
          isRuntimeImageUrl(asset.previewUrl) &&
          asset.validationStatus !== "failed" &&
          !asset.error
      )
      .map((asset) => asset.slot)
  );
  return required.every((slot) => confirmed.has(slot));
}

export function buildConfirmedCoreAssets(
  assetCandidates?: AssetCandidates | null,
  uploadedMaterials: StartUploadedMaterial[] = []
): ConfirmedAssets {
  const assets = new Map<UserMaterialSlot, ConfirmedAssets["assets"][number]>();
  for (const candidate of assetCandidates?.candidates ?? []) {
    if (isConfirmableImageAsset(candidate)) {
      assets.set(candidate.slot, {
        ...candidate,
        assetKey: resolveMaterialAssetKey(candidate.slot, "top_down"),
        approvalStatus: "approved"
      });
    }
  }
  for (const material of uploadedMaterials) {
    if (!["background", "player", "hazard", "collectible"].includes(material.slot)) continue;
    if (!isRuntimeImageUrl(material.fileUrl) || !isRuntimeImageUrl(material.previewUrl)) continue;
    assets.set(material.slot, {
      slot: material.slot,
      assetKey: resolveMaterialAssetKey(material.slot, "top_down"),
      type: "image",
      label: material.fileName,
      prompt: `用户上传素材：${material.fileName}`,
      style: "user-upload",
      purpose: materialSlotLabels[material.slot],
      acceptedFileTypes: ["image/*"],
      previewUrl: material.previewUrl,
      fileUrl: material.fileUrl,
      source: "uploaded",
      provider: "user-upload",
      model: "user-upload",
      generationParams: {
        uploaded: true
      },
      approvalStatus: "approved",
      validationStatus: "passed"
    });
  }
  return { assets: Array.from(assets.values()) };
}

function isConfirmableImageAsset(asset: ConfirmedAssets["assets"][number]): boolean {
  return (
    ["background", "player", "hazard", "collectible"].includes(asset.slot) &&
    (asset.type === "image" || asset.type === "ui") &&
    asset.approvalStatus !== "rejected" &&
    isRuntimeImageUrl(asset.fileUrl) &&
    isRuntimeImageUrl(asset.previewUrl) &&
    asset.validationStatus !== "failed" &&
    !asset.error
  );
}

function isRuntimeImageUrl(fileUrl?: string): boolean {
  if (!fileUrl) return false;
  return fileUrl.startsWith("data:image") || fileUrl.startsWith("blob:") || fileUrl.startsWith("/projects/");
}

function addFollowup(current: StudioFollowup[], content: string): StudioFollowup[] {
  const trimmed = content.trim();
  if (!trimmed) return current;
  if (current.some((item) => item.content.trim() === trimmed)) return current;
  return [
    ...current,
    {
      id: `followup-${Date.now()}-${current.length + 1}`,
      content: trimmed,
      createdAt: new Date().toISOString()
    }
  ];
}

function readGuidedQuestionStatus(
  status: GuidedQuestionStatus,
  text: ReturnType<typeof getMessages>["ideaDialog"]
): string {
  if (status === "loading") return text.statusLoading;
  if (status === "ready") return text.statusReady;
  if (status === "fallback") return text.statusFallback;
  return text.statusIdle;
}

function readGenerationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function canStartAssetGeneration(
  session: ConversationSession,
  designBrief: DesignBrief | null,
  assetCandidates: AssetCandidates | null,
  creationPhase: CreationPhase
): boolean {
  const hasAnsweredGuidedQuestions = session.answers.length >= session.questions.length;
  return (
    hasAnsweredGuidedQuestions &&
    Boolean(designBrief) &&
    !assetCandidates &&
    ["chatting", "guided_questions", "asset_review", "revision"].includes(creationPhase)
  );
}

function playGenerationSuccessTone() {
  if (typeof window === "undefined") return;
  const audioWindow = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
  gain.connect(context.destination);

  for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.08);
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.08);
    oscillator.stop(context.currentTime + 0.5);
  }
  window.setTimeout(() => void context.close(), 650);
}

export function App() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const t = getMessages(locale);
  const [idea, setIdea] = useState<string>(t.prompt.defaultIdea);
  const [startDraft, setStartDraft] = useState<StartGameDraft>(() =>
    createStartGameDraft({ idea: t.prompt.defaultIdea })
  );
  const [page, setPage] = useState<AppPage>("create");
  const [welcomeName, setWelcomeName] = useState("@zhoujiaweizjw1986.b67y");
  const [projects, setProjects] = useState<ProjectRecord[]>(() =>
    seedProjectIdeas.map((item, index) => createProjectRecord(item, index + 1))
  );
  const [session, setSession] = useState<ConversationSession>(() =>
    createConversationSession(t.prompt.defaultIdea)
  );
  const [activeDraft, setActiveDraft] = useState<StartGameDraft>(() =>
    createStartGameDraft({ idea: t.prompt.defaultIdea })
  );
  const [creationPhase, setCreationPhase] = useState<CreationPhase>("chatting");
  const [revisionText, setRevisionText] = useState("");
  const [followups, setFollowups] = useState<StudioFollowup[]>([]);
  const [generatedProject, setGeneratedProject] = useState<MockProject | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [guidedQuestionStatus, setGuidedQuestionStatus] = useState<GuidedQuestionStatus>("idle");
  const [generationNotice, setGenerationNotice] = useState<GenerationNotice | null>(null);
  const [uploadedPackageMessage, setUploadedPackageMessage] = useState("");
  const [referencePackage, setReferencePackage] = useState<ReferencePackageSummary | null>(null);
  const [designBrief, setDesignBrief] = useState<DesignBrief | null>(null);
  const [assetCandidates, setAssetCandidates] = useState<AssetCandidates | null>(null);
  const [confirmedAssets, setConfirmedAssets] = useState<ConfirmedAssets | null>(null);
  const [assetCandidateStatus, setAssetCandidateStatus] = useState<AssetCandidateStatus>("idle");
  const [regeneratingAssetSlots, setRegeneratingAssetSlots] = useState<Set<UserMaterialSlot>>(() => new Set());
  const regeneratingAssetSlotsRef = useRef<Set<UserMaterialSlot>>(new Set());
  const [revisionHistory, setRevisionHistory] = useState<RevisionAnalysis[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const activeDraftRef = useRef(activeDraft);
  const revisionSubmittingRef = useRef(false);
  const fallbackProject = useMemo(() => runMockPipeline(idea), [idea]);
  const project = generatedProject ?? fallbackProject;
  const playRoute = getPlayRoute();
  const hasAnsweredGuidedQuestions = session.answers.length >= session.questions.length;
  const canStartAssets = canStartAssetGeneration(session, designBrief, assetCandidates, creationPhase);
  const canGeneratePlayable =
    hasAnsweredGuidedQuestions &&
    Boolean(designBrief) &&
    hasConfirmedCoreAssets(confirmedAssets) &&
    ["assets_confirmed", "ready"].includes(creationPhase);
  const ideaDialogActionState = readIdeaDialogActionState({
    session,
    hasDesignBrief: Boolean(designBrief),
    hasAssetCandidates: Boolean(assetCandidates),
    hasConfirmedAssets: hasConfirmedCoreAssets(confirmedAssets),
    creationPhase,
    copy: t.ideaDialog
  });

  useEffect(() => {
    activeDraftRef.current = activeDraft;
  }, [activeDraft]);

  const addUserMaterials = async (files: File[], preferredSlot?: UserMaterialSlot) => {
    const draft = activeDraftRef.current;
    const nextMaterials = await filesToUserMaterials(files, draft.templateFamily, preferredSlot);
    if (nextMaterials.length === 0) return;
    const mergedMaterials = [...draft.uploadedMaterials, ...nextMaterials];
    setActiveDraft({
      ...draft,
      uploadedFileNames: mergedMaterials.map((material) => material.fileName),
      uploadedMaterials: mergedMaterials
    });
    if (generatedProject) {
      setGeneratedProject({
        ...generatedProject,
        assetPack: {
          ...generatedProject.assetPack,
          assets: applyUserMaterialsToAssetPack(generatedProject.assetPack.assets, nextMaterials)
        }
      });
      setGenerationNotice({
        tone: "success",
        title: "素材已应用",
        detail: "上传素材已写入当前试玩 asset-pack，可直接重新开始试玩。"
      });
    }
    const nextConfirmedAssets = buildConfirmedCoreAssets(assetCandidates, mergedMaterials);
    setConfirmedAssets(nextConfirmedAssets);
    if (assetCandidates) {
      setCreationPhase(hasConfirmedCoreAssets(nextConfirmedAssets) ? "assets_confirmed" : "asset_review");
    }
    setRevisionText((current) => {
      if (current.trim()) return current;
      const summary = nextMaterials
        .map((material) => `${materialSlotLabels[material.slot ?? "player"]}:${material.fileName}`)
        .join("，");
      return `已上传素材，替换 ${summary}`;
    });
  };

  const submitFollowup = async () => {
    if (revisionSubmittingRef.current) return;
    if (!revisionText.trim()) return;
    const followupText = revisionText.trim();
    const nextQuestion = session.questions.find(
      (question) => !session.answers.some((answer) => answer.questionId === question.id)
    );
    if (nextQuestion) {
      setSession(answerDesignQuestion(session, nextQuestion.id, followupText));
      setRevisionText("");
      window.requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth"
        });
      });
      return;
    }
    revisionSubmittingRef.current = true;
    const nextFollowups = addFollowup(followups, followupText);
    if (nextFollowups === followups) {
      setRevisionText("");
      revisionSubmittingRef.current = false;
      return;
    }
    setFollowups(nextFollowups);
    const nextIdea = buildGenerationIdea(idea, nextFollowups);
    setIdea(nextIdea);
    setCreationPhase("revision_thinking");
    setGenerationNotice({
      tone: "working",
      title: "AI 正在理解追加需求",
      detail: "DeepSeek 会先分析你的补充，再更新开发提示词和确认问题。"
    });
    let revisionAnalysis: RevisionAnalysis | null = null;
    try {
      const result = await requestRevisionAnalysis({
        idea,
        followup: followupText,
        templateFamily: activeDraft.templateFamily,
        model: activeDraft.model,
        designBrief: designBrief ?? undefined,
        referencePackageId: referencePackage?.projectId,
        referenceVersionId: referencePackage?.versionId,
        userMaterials: activeDraft.uploadedMaterials.map((material) => ({
          assetKey: material.assetKey,
          slot: material.slot,
          fileName: material.fileName,
          fileUrl: material.fileUrl,
          previewUrl: material.previewUrl,
          mimeType: material.mimeType
        })),
        previousAnswers: session.answers
      });
      revisionAnalysis = result.revisionAnalysis;
      setRevisionHistory((current) => [...current, result.revisionAnalysis]);
      setDesignBrief((current) =>
        current
          ? {
              ...current,
              developerPrompt: result.revisionAnalysis.updatedDeveloperPrompt
            }
          : current
      );
    } catch {
      revisionAnalysis = {
        understoodChange: `理解追加需求：${followupText}`,
        updatedDeveloperPrompt: `${designBrief?.developerPrompt ?? idea}\nRevision: ${followupText}`,
        confirmationQuestions: [],
        affectedAssets: [],
        risks: ["追加需求分析接口回退为本地记录。"]
      };
      setRevisionHistory((current) => [...current, revisionAnalysis as RevisionAnalysis]);
    }
    setSession((current) => ({
      ...current,
      idea: nextIdea,
      turns: [
        ...current.turns,
        {
          id: `user-followup-${Date.now()}`,
          role: "user",
          stage: current.stage,
          content: followupText,
          createdAt: new Date().toISOString()
        },
        {
          id: `assistant-revision-${Date.now()}`,
          role: "assistant",
          stage: current.stage,
          content: revisionAnalysis
            ? `${revisionAnalysis.understoodChange}\n${revisionAnalysis.updatedDeveloperPrompt}`
            : "AI 已记录追加需求，等待重新生成。",
          createdAt: new Date().toISOString()
        }
      ]
    }));
    setRevisionText("");
    setGeneratedProject(null);
    setGenerationResult(null);
    setGenerationNotice(null);
    setAssetCandidates(null);
    setConfirmedAssets(null);
    setAssetCandidateStatus("idle");
    setCreationPhase("revision");
    window.requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    });
    revisionSubmittingRef.current = false;
  };

  const startResourceGeneration = async () => {
    if (!canGeneratePlayable) {
      setGenerationNotice({
        tone: "error",
        title: "请先确认核心素材",
        detail: "背景、主角、危险物和收集物确认后，才能生成可玩游戏。"
      });
      setPage("studio");
      setActiveTab("preview");
      return;
    }
    setCreationPhase("cooking");
    setActiveTab("preview");
    setPage("studio");
    setGenerationNotice({
      tone: "working",
      title: t.preview.cookingTitle,
      detail: t.preview.cookingDetail
    });
    const generationIdea = buildGenerationIdea(idea, followups);
    try {
      const result = (await requestPlayableGeneration({
        idea: generationIdea,
        answers: session.answers,
        templateFamily: activeDraft.templateFamily,
        projectId: `project-${Date.now()}`,
        baseUrl: getBrowserBaseUrl(),
        model: "deepseek-v4-flash",
        referencePackageId: referencePackage?.projectId,
        referenceVersionId: referencePackage?.versionId,
        designBrief: designBrief ?? undefined,
        confirmedAssets: confirmedAssets ?? undefined,
        revisionHistory,
        userMaterials: activeDraft.uploadedMaterials.map((material) => ({
          assetKey: material.assetKey,
          slot: material.slot,
          fileName: material.fileName,
          fileUrl: material.fileUrl,
          previewUrl: material.previewUrl,
          mimeType: material.mimeType
        }))
      })) as GenerationResult;
      setGenerationResult(result);
      setGeneratedProject(result.project);
      setProjects((current) => upsertGeneratedProjectRecord(current, result.project, result.publishRecord));
      setCreationPhase("ready");
      setActiveTab("preview");
      const fallbackTasks = result.fallbacksUsed ?? [];
      setGenerationNotice({
        tone: fallbackTasks.length > 0 ? "fallback" : "success",
        title: fallbackTasks.length > 0 ? t.notices.fallbackTitle : t.notices.successTitle,
        detail:
          fallbackTasks.length > 0
            ? `${t.notices.fallbackDetailPrefix}${fallbackTasks.join(", ")}${t.notices.fallbackDetailSuffix}`
            : `${result.project.gameConfig.title}${t.notices.publishedSuffix}${result.publishRecord.publicUrl}`
      });
      window.setTimeout(() => setGenerationNotice(null), 4200);
      playGenerationSuccessTone();
    } catch (error) {
      setGenerationResult(null);
      setGeneratedProject(null);
      setCreationPhase(hasConfirmedCoreAssets(confirmedAssets) ? "assets_confirmed" : "asset_review");
      setActiveTab("preview");
      setGenerationNotice({
        tone: "error",
        title: t.notices.errorTitle,
        detail: `${readGenerationError(error)}。请重试生成；不会使用浏览器本地 fallback，因为它无法本地化 Agnes 图片。`
      });
      window.setTimeout(() => setGenerationNotice(null), 5200);
    }
  };

  const answerCurrentDialogQuestion = (value: string) => {
    const nextQuestion = session.questions.find(
      (question) => !session.answers.some((answer) => answer.questionId === question.id)
    );
    if (!nextQuestion) return;
    setSession(answerDesignQuestion(session, nextQuestion.id, value));
  };

  const loadGuidedQuestions = async (
    nextIdea: string,
    templateFamily: TemplateFamily,
    model: StartGameDraft["model"]
  ) => {
    setGuidedQuestionStatus("loading");
    setCreationPhase("ai_thinking");
    let nextDesignBrief: DesignBrief | null = null;
    try {
      const briefResult = await requestDesignBrief({
        idea: nextIdea,
        templateFamily,
        model,
        referencePackageId: referencePackage?.projectId,
        referenceVersionId: referencePackage?.versionId,
        userMaterials: activeDraft.uploadedMaterials.map((material) => ({
          assetKey: material.assetKey,
          slot: material.slot,
          fileName: material.fileName,
          fileUrl: material.fileUrl,
          previewUrl: material.previewUrl,
          mimeType: material.mimeType
        }))
      });
      nextDesignBrief = briefResult.designBrief;
      setDesignBrief(briefResult.designBrief);
      const result = await requestGuidedQuestions({
        idea: nextIdea,
        templateFamily,
        model,
        projectId: `project-${Date.now()}`,
        designBrief: briefResult.designBrief,
        referencePackageId: referencePackage?.projectId,
        referenceVersionId: referencePackage?.versionId,
        userMaterials: activeDraft.uploadedMaterials.map((material) => ({
          assetKey: material.assetKey,
          slot: material.slot,
          fileName: material.fileName,
          fileUrl: material.fileUrl,
          previewUrl: material.previewUrl,
          mimeType: material.mimeType
        }))
      });
      setSession((current) => {
        if (current.idea !== nextIdea || current.answers.length > 0) return current;
        return createConversationSession(nextIdea, {
          preferredTemplate: templateFamily,
          questions: result.questions
        });
      });
      setGuidedQuestionStatus(result.fallbackUsed ? "fallback" : "ready");
      setCreationPhase((current) =>
        current === "cooking" || current === "ready" ? current : "guided_questions"
      );
    } catch {
      setGuidedQuestionStatus("fallback");
      setCreationPhase((current) =>
        current === "cooking" || current === "ready" ? current : "chatting"
      );
    }
  };

  const startAssetGeneration = async () => {
    const currentDesignBrief = designBrief;
    const hasAnsweredAllQuestions = session.answers.length >= session.questions.length;
    const canRequestAssets =
      hasAnsweredAllQuestions &&
      Boolean(currentDesignBrief) &&
      assetCandidateStatus !== "loading" &&
      ["chatting", "guided_questions", "asset_review", "assets_confirmed", "revision"].includes(creationPhase);
    if (!currentDesignBrief || !canRequestAssets) return;
    const nextIdea = buildGenerationIdea(idea, followups);
    setPage("studio");
    setActiveTab("preview");
    setAssetCandidates(null);
    setConfirmedAssets(null);
    setAssetCandidateStatus("loading");
    setCreationPhase("asset_generating");
    try {
      const assetResult = await requestAssetCandidates({
        idea: nextIdea,
        templateFamily: activeDraft.templateFamily,
        model: activeDraft.model,
        designBrief: currentDesignBrief,
        answers: session.answers,
        referencePackageId: referencePackage?.projectId,
        referenceVersionId: referencePackage?.versionId,
        userMaterials: activeDraft.uploadedMaterials.map((material) => ({
          assetKey: material.assetKey,
          slot: material.slot,
          fileName: material.fileName,
          fileUrl: material.fileUrl,
          previewUrl: material.previewUrl,
          mimeType: material.mimeType
        }))
      });
      setAssetCandidates(assetResult.assetCandidates);
      setConfirmedAssets(null);
      setAssetCandidateStatus("ready");
      setCreationPhase("asset_review");
    } catch {
      setAssetCandidates(null);
      setConfirmedAssets(null);
      setAssetCandidateStatus("failed");
      setCreationPhase("asset_review");
    }
  };

  const regenerateAssetCandidate = async (candidate: AssetCandidates["candidates"][number]) => {
    if (regeneratingAssetSlotsRef.current.has(candidate.slot)) return;
    const nextIdea = buildGenerationIdea(idea, followups);
    regeneratingAssetSlotsRef.current = new Set(regeneratingAssetSlotsRef.current).add(candidate.slot);
    setRegeneratingAssetSlots((current) => new Set(current).add(candidate.slot));
    try {
      const result = await requestRegenerateAssetCandidate({
        idea: nextIdea,
        templateFamily: activeDraft.templateFamily,
        candidate
      });
      setAssetCandidates((current) => {
        const nextCandidates = current
          ? {
              candidates: current.candidates.map((item) =>
                item.slot === candidate.slot ? result.assetCandidate : item
              )
            }
          : { candidates: [result.assetCandidate] };
        const nextConfirmedAssets = buildConfirmedCoreAssets(nextCandidates, activeDraft.uploadedMaterials);
        setConfirmedAssets(nextConfirmedAssets);
        setCreationPhase(hasConfirmedCoreAssets(nextConfirmedAssets) ? "assets_confirmed" : "asset_review");
        return nextCandidates;
      });
      setGenerationNotice({
        tone: result.assetCandidate.validationStatus === "failed" || result.assetCandidate.error ? "error" : "success",
        title: result.assetCandidate.validationStatus === "failed" || result.assetCandidate.error ? "素材仍不可用" : "素材已重新生成",
        detail:
          result.assetCandidate.error ??
          `${materialSlotLabels[result.assetCandidate.slot]} 已更新，不会影响其他已生成素材。`
      });
    } catch (error) {
      setGenerationNotice({
        tone: "error",
        title: "单素材重生成失败",
        detail: readGenerationError(error)
      });
    } finally {
      const nextRef = new Set(regeneratingAssetSlotsRef.current);
      nextRef.delete(candidate.slot);
      regeneratingAssetSlotsRef.current = nextRef;
      setRegeneratingAssetSlots((current) => {
        const next = new Set(current);
        next.delete(candidate.slot);
        return next;
      });
    }
  };

  const uploadAssetCandidateReplacement = async (slot: UserMaterialSlot, files: File[]) => {
    const file = files.find((item) => item.type.startsWith("image/"));
    if (!file) return;
    const existingCandidate = assetCandidates?.candidates.find((candidate) => candidate.slot === slot);
    const fileBase64 = await readFileAsBase64(file);
    try {
      const result = await requestProcessUploadedMaterial({
        idea: buildGenerationIdea(idea, followups),
        templateFamily: activeDraft.templateFamily,
        slot,
        assetKey: resolveMaterialAssetKey(slot, activeDraft.templateFamily),
        fileName: file.name,
        fileBase64,
        contentType: file.type || fallbackMimeType(file),
        label: existingCandidate?.label ?? materialSlotLabels[slot],
        prompt: existingCandidate?.prompt ?? file.name,
        style: existingCandidate?.style ?? "uploaded"
      });
      setAssetCandidates((current) => {
        const nextCandidates = current
          ? {
              candidates: current.candidates.map((candidate) =>
                candidate.slot === slot ? result.assetCandidate : candidate
              )
            }
          : { candidates: [result.assetCandidate] };
        const nextConfirmedAssets = buildConfirmedCoreAssets(nextCandidates);
        setConfirmedAssets(nextConfirmedAssets);
        setCreationPhase(hasConfirmedCoreAssets(nextConfirmedAssets) ? "assets_confirmed" : "asset_review");
        return nextCandidates;
      });
      setGenerationNotice({
        tone: result.assetCandidate.validationStatus === "failed" || result.assetCandidate.error ? "error" : "success",
        title: result.assetCandidate.validationStatus === "failed" || result.assetCandidate.error ? "上传素材不可用" : "上传素材已处理",
        detail:
          result.assetCandidate.error ??
          `${materialSlotLabels[result.assetCandidate.slot]} 已经过后端抠图/校验，可用于素材确认。`
      });
    } catch (error) {
      setGenerationNotice({
        tone: "error",
        title: "上传素材处理失败",
        detail: readGenerationError(error)
      });
    }
  };

  const openIdeaDialog = (nextIdea: string, templateFamily?: TemplateFamily) => {
    const normalizedIdea = nextIdea.trim() || t.prompt.defaultIdea;
    const nextTemplate = templateFamily ?? startDraft.templateFamily;
    const nextDraft = { ...startDraft, idea: normalizedIdea, templateFamily: nextTemplate };
    setIdea(normalizedIdea);
    setActiveDraft(nextDraft);
    setSession(createConversationSession(normalizedIdea, { preferredTemplate: nextTemplate }));
    setGuidedQuestionStatus("loading");
    setGeneratedProject(null);
    setGenerationResult(null);
    setGenerationNotice(null);
    setRevisionText("");
    setFollowups([]);
    setDesignBrief(null);
    setAssetCandidates(null);
    setConfirmedAssets(null);
    setAssetCandidateStatus("idle");
    setRevisionHistory([]);
    setCreationPhase("chatting");
    setActiveTab("preview");
    setPage("idea_dialog");
    loadGuidedQuestions(normalizedIdea, nextTemplate, nextDraft.model);
  };

  const openStudio = (nextIdea: string, templateFamily?: TemplateFamily, nextProject?: MockProject) => {
    const normalizedIdea = nextIdea.trim() || t.prompt.defaultIdea;
    const nextTemplate = templateFamily ?? startDraft.templateFamily;
    const nextDraft = { ...startDraft, idea: normalizedIdea, templateFamily: nextTemplate };
    setIdea(normalizedIdea);
    setActiveDraft(nextDraft);
    setSession(createConversationSession(normalizedIdea, { preferredTemplate: nextTemplate }));
    setGuidedQuestionStatus(nextProject ? "idle" : "loading");
    setGeneratedProject(nextProject ?? null);
    setGenerationResult(null);
    setGenerationNotice(null);
    setRevisionText("");
    setFollowups([]);
    setDesignBrief(null);
    setAssetCandidates(null);
    setConfirmedAssets(null);
    setAssetCandidateStatus("idle");
    setRevisionHistory([]);
    setCreationPhase(nextProject ? "ready" : "chatting");
    setActiveTab("preview");
    setPage("studio");
    if (!nextProject) {
      loadGuidedQuestions(normalizedIdea, nextTemplate, nextDraft.model);
    }
  };

  const openProjectPlay = (record: ProjectRecord) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", record.project.playUrl);
    }
    setGeneratedProject(record.project);
    setGenerationResult(null);
    setCreationPhase("ready");
    setActiveTab("preview");
    setPage("studio");
  };

  const addUploadedPackage = (project: MockProject) => {
    setProjects((current) => [
      {
        id: `${project.id}-${Date.now()}`,
        title: project.title,
        idea: project.gameConfig.pitch,
        contentType: project.contentType,
        editable: project.editable,
        shareable: project.shareable,
        sourceLabel: project.sourceLabel,
        status: "published",
        visibility: "public",
        updatedAt: "2026-06-17",
        plays: 0,
        likes: 0,
        templateFamily: project.classification.templateFamily,
        project
      },
      ...current
    ]);
  };

  if (playRoute) {
    return (
      <PlayableDetailPage
        projectId={playRoute.projectId}
        versionId={playRoute.versionId}
        messages={t}
        onCreate={() => {
          window.history.pushState({}, "", "/");
          setPage("create");
        }}
      />
    );
  }

  if (page === "play") {
    return (
      <PlayPage
        locale={locale}
        projects={projects}
        onCreate={() => setPage("create")}
        onProjects={() => setPage("projects")}
        onPlayGame={() => openStudio(idea)}
        onPlayProject={openProjectPlay}
      />
    );
  }

  if (page === "projects") {
    return (
      <ProjectsPage
        locale={locale}
        projects={projects}
        welcomeName={welcomeName}
        onWelcomeNameChange={setWelcomeName}
        onCreate={() => setPage("create")}
        onPlay={() => setPage("play")}
        onEdit={(record) =>
          record.contentType === "uploaded_package"
            ? openProjectPlay(record)
            : openStudio(record.idea, record.templateFamily, record.project)
        }
        onRun={(record) =>
          record.contentType === "uploaded_package"
            ? openProjectPlay(record)
            : record.editable
            ? openStudio(record.idea, record.templateFamily, record.project)
            : openProjectPlay(record)
        }
        onDuplicate={(record) => {
          if (!record.editable || record.contentType === "uploaded_package") return;
          setProjects((current) => [
            {
              ...record,
              id: `${record.id}-copy-${Date.now()}`,
              title: `${record.title} Copy`,
              status: "draft",
              visibility: "private",
              updatedAt: "2026-06-17",
              project: runMockPipeline(record.idea)
            },
            ...current
          ]);
        }}
        onDelete={(record) => setProjects((current) => current.filter((item) => item.id !== record.id))}
      />
    );
  }

  if (page === "create") {
    return (
      <StartPage
        draft={startDraft}
        locale={locale}
        onLocaleToggle={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
        onDraftChange={setStartDraft}
        onPlay={() => setPage("play")}
        onProjects={() => setPage("projects")}
        uploadMessage={uploadedPackageMessage}
        referencePackage={referencePackage}
        onRemoveReferencePackage={() => {
          setReferencePackage(null);
          setUploadedPackageMessage("");
        }}
        onCreate={() => {
          const nextIdea = startDraft.idea.trim() || t.prompt.defaultIdea;
          openIdeaDialog(nextIdea, startDraft.templateFamily);
        }}
        onUseTemplate={(template) => {
          const draft = startDraftFromTemplate(template, startDraft.idea);
          setStartDraft(draft);
          openIdeaDialog(draft.idea, draft.templateFamily);
        }}
        onPreviewTemplate={(template) => {
          setStartDraft(startDraftFromTemplate(template, startDraft.idea));
          setPage("play");
        }}
        onUploadPackage={async (file) => {
          setUploadedPackageMessage(`正在解析 ${file.name}...`);
          try {
            const payload = await uploadPlayablePackage({
              packageName: file.name.replace(/\.zip$/i, ""),
              packageFileName: file.name,
              packageBase64: await readFileAsBase64(file),
              baseUrl: getBrowserBaseUrl(),
              description: `上传包：${file.name}`
            });
            setReferencePackage(createReferencePackageSummary(payload));
            setUploadedPackageMessage(`${file.name} 已解析为参考案例，可输入你的创意生成新游戏。`);
          } catch (error) {
            setUploadedPackageMessage(`上传失败：${readGenerationError(error)}`);
          }
        }}
      />
    );
  }

  if (page === "idea_dialog") {
    return (
      <IdeaDialogPage
        session={session}
        statusLabel={ideaDialogActionState.statusLabel || readGuidedQuestionStatus(guidedQuestionStatus, t.ideaDialog)}
        messages={t}
        draft={activeDraft}
        revisionText={revisionText}
        canGenerate={canGeneratePlayable}
        canStartAssets={canStartAssets || ideaDialogActionState.canStartAssets}
        isPreparingAssets={ideaDialogActionState.isPreparingAssets}
        actionLabel={ideaDialogActionState.buttonLabel}
        isGenerating={creationPhase === "cooking"}
        onRevisionTextChange={setRevisionText}
        onAnswer={answerCurrentDialogQuestion}
        onGenerate={startResourceGeneration}
        onStartAssets={startAssetGeneration}
        onClose={() => setPage("create")}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="chrome-bar">
        <div className="project-switcher">
          <button className="brand-home-button" onClick={() => setPage("create")} title={t.start.create}>
            <span className="brand-mark">W</span>
          </button>
          <button
            className="project-menu"
            title={t.brand.projectTitle}
            onClick={() => setProjectMenuOpen((value) => !value)}
          >
            <span>{project.title}</span>
            <ChevronDown size={16} />
          </button>
          {projectMenuOpen && (
            <div className="project-info-popover">
              <div>
                <span>{t.brand.projectTitle}</span>
                <strong>{project.title}</strong>
              </div>
              <p>{project.gameConfig.pitch}</p>
              <dl>
                <dt>{t.thinking.template}</dt>
                <dd>{project.classification.templateFamily}</dd>
                <dt>{t.thinking.goal}</dt>
                <dd>{project.gameConfig.playerGoal}</dd>
                <dt>{t.thinking.assets}</dt>
                <dd>{project.assetPack.assets.length}</dd>
                <dt>{t.preview.verification}</dt>
                <dd>{project.qaReport.scores.buildHealth}%</dd>
              </dl>
            </div>
          )}
        </div>
        <div className="chrome-actions">
          <button className="ghost-button" onClick={() => setPage("create")}>
            <Plus size={15} />
            {t.start.create}
          </button>
          <button className="ghost-button" onClick={() => setPage("play")}>
            <Gamepad2 size={15} />
            {t.start.play}
          </button>
          <button className="ghost-button" onClick={() => setPage("projects")}>
            <Wand2 size={15} />
            {t.start.myProjects}
          </button>
          <button
            className="locale-button"
            onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
          >
            {locale === "zh-CN" ? "中文" : "EN"}
          </button>
          <button className="ghost-button">
            <Zap size={15} />
            {t.brand.upgrade}
          </button>
          <button className="share-button" onClick={() => setShareOpen(true)}>
            <Share2 size={16} />
            {t.brand.share}
          </button>
          <div className="user-orb">Z</div>
        </div>
      </header>

      <section className="creator-shell">
        <aside className="agent-panel">
          <AgentHeader project={project} messages={t} />
          <div className="agent-scroll" ref={chatScrollRef}>
            <StudioChatFlow
              messages={buildStudioChatMessages({
                idea,
                followups,
                project,
                messages: t,
                phase: creationPhase,
                session,
                referencePackageName: referencePackage?.packageName,
                designBrief,
                revisionHistory,
                assetCandidates,
                assetCandidateStatus
              })}
              onConfirmAssets={(candidates) => {
                const nextConfirmedAssets = buildConfirmedCoreAssets(candidates, activeDraft.uploadedMaterials);
                setConfirmedAssets(nextConfirmedAssets);
                setCreationPhase(hasConfirmedCoreAssets(nextConfirmedAssets) ? "assets_confirmed" : "asset_review");
              }}
              onUploadAsset={uploadAssetCandidateReplacement}
              onRegenerateAsset={regenerateAssetCandidate}
              regeneratingSlots={regeneratingAssetSlots}
            />
          </div>
          <PromptDock
            messages={t}
            revisionText={revisionText}
            modelStatusLabel={readGuidedQuestionStatus(guidedQuestionStatus, t.ideaDialog)}
            canGenerate={canGeneratePlayable}
            canStartAssets={canStartAssets}
            isGenerating={creationPhase === "cooking"}
            isGeneratingAssets={creationPhase === "asset_generating"}
            isSubmittingRevision={creationPhase === "revision_thinking"}
            onGenerate={startResourceGeneration}
            onStartAssets={startAssetGeneration}
            onIdeaChange={setRevisionText}
            onSubmitRevision={submitFollowup}
            onUploadMaterials={addUserMaterials}
          />
        </aside>

        <section className="stage-panel">
          <nav className="stage-tabs" aria-label="Workspace tabs">
            {rightTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? "stage-tab active" : "stage-tab"}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  {t.tabs[tab.labelKey]}
                </button>
              );
            })}
          </nav>

          <div className="stage-toolbar">
            <div className="toolbar-left">
              <button title={t.toolbar.refresh}>
                <RefreshCcw size={16} />
              </button>
              <button title={t.toolbar.console}>
                <FileCode2 size={16} />
              </button>
            </div>
            <div className="toolbar-right">
              <span className="live-dot" />
              <button title={t.toolbar.fullscreen}>
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div className="stage-content">
            {activeTab === "preview" && (
              <PreviewWorkspace
                project={generatedProject}
                messages={t}
                phase={creationPhase}
                notice={generationNotice}
                canGenerate={canGeneratePlayable}
                canStartAssets={canStartAssets}
                onGenerate={startResourceGeneration}
                onStartAssets={startAssetGeneration}
              />
            )}
            {activeTab === "assets" && (
              <AssetWorkspace
                key={`${project.id}-${project.version.id}`}
                project={project}
                messages={t}
                onAssetsChange={(assets) => {
                  const nextProject = { ...project, assetPack: { ...project.assetPack, assets } };
                  setGeneratedProject(nextProject);
                }}
              />
            )}
            {activeTab === "code" && <CodeWorkspace project={project} messages={t} />}
          </div>
        </section>
      </section>
      {shareOpen && (
        <SharePanel
          project={project}
          publicUrl={generationResult?.publishRecord.publicUrl ?? `${getBrowserBaseUrl()}${project.playUrl}`}
          qrPayload={generationResult?.share.qrPayload ?? `WOW Game Share URL: ${getBrowserBaseUrl()}${project.playUrl}`}
          messages={t}
          onClose={() => setShareOpen(false)}
        />
      )}
    </main>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",").pop() ?? "" : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read uploaded package"));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read uploaded material"));
    reader.readAsDataURL(file);
  });
}

const materialSlotLabels: Record<UserMaterialSlot, string> = {
  background: "背景",
  player: "角色",
  hazard: "敌人/障碍",
  collectible: "收集物",
  cover: "封面",
  bgm: "BGM",
  sfx: "音效"
};

const materialSlotOptions: UserMaterialSlot[] = ["background", "player", "hazard", "collectible", "cover", "bgm", "sfx"];

function resolveMaterialAssetKey(slot: UserMaterialSlot, templateFamily: TemplateFamily): string {
  const map: Record<TemplateFamily, Record<UserMaterialSlot, string>> = {
    platformer: {
      background: "cover.main",
      player: "player.hero",
      hazard: "hazard.spike",
      collectible: "item.collectible",
      cover: "cover.main",
      bgm: "bgm.loop",
      sfx: "sfx.collect"
    },
    top_down: {
      background: "world.background",
      player: "player.ship",
      hazard: "hazard.enemy",
      collectible: "item.collectible",
      cover: "cover.main",
      bgm: "bgm.loop",
      sfx: "sfx.collect"
    },
    grid_logic: {
      background: "world.tiles",
      player: "player.cursor",
      hazard: "hazard.block",
      collectible: "item.collectible",
      cover: "cover.main",
      bgm: "bgm.loop",
      sfx: "sfx.collect"
    },
    tower_defense: {
      background: "world.path",
      player: "player.tower",
      hazard: "hazard.enemy",
      collectible: "item.collectible",
      cover: "cover.main",
      bgm: "bgm.loop",
      sfx: "sfx.collect"
    },
    ui_heavy: {
      background: "world.background",
      player: "player.panel",
      hazard: "hazard.timer",
      collectible: "item.collectible",
      cover: "cover.main",
      bgm: "bgm.loop",
      sfx: "sfx.collect"
    }
  };
  return map[templateFamily][slot];
}

async function filesToUserMaterials(
  files: File[],
  templateFamily: TemplateFamily,
  preferredSlot?: UserMaterialSlot
): Promise<StartUploadedMaterial[]> {
  const supportedFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("audio/"));
  const materials = await Promise.all(
    supportedFiles.map(async (file, index) => {
      const slot = preferredSlot ?? inferMaterialSlotFromFile(file, index);
      const fileUrl = await readFileAsDataUrl(file);
      return {
        id: `${file.name}-${file.lastModified}-${index}`,
        assetKey: resolveMaterialAssetKey(slot, templateFamily),
        slot,
        fileName: file.name,
        fileUrl,
        previewUrl: fileUrl,
        mimeType: file.type || fallbackMimeType(file)
      };
    })
  );
  return materials;
}

function inferMaterialSlotFromFile(file: File, index: number): UserMaterialSlot {
  if (file.type.startsWith("audio/")) {
    const lower = file.name.toLowerCase();
    return lower.includes("bgm") || lower.includes("loop") || lower.includes("music") ? "bgm" : "sfx";
  }
  if (index === 0) return "background";
  if (index === 1) return "player";
  if (index === 2) return "hazard";
  return "collectible";
}

function fallbackMimeType(file: File): string {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return lower.endsWith(".png") ? "image/png" : "application/octet-stream";
}

function applyUserMaterialsToAssetPack(
  assets: AssetRequirement[],
  userMaterials: StartUploadedMaterial[]
): AssetRequirement[] {
  const materialsByKey = new Map(userMaterials.map((material) => [material.assetKey, material]));
  return assets.map((asset) => {
    const material = materialsByKey.get(asset.assetKey);
    if (!material) return asset;
    if (!isMaterialCompatibleWithAsset(asset, material)) return asset;
    return {
      ...asset,
      status: "uploaded",
      source: "uploaded",
      generationMode: "uploaded",
      copyrightStatus: "user_provided",
      fileUrl: material.fileUrl,
      previewUrl: material.previewUrl ?? material.fileUrl,
      provider: "uploaded",
      model: "user-file",
      approvalStatus: "approved",
      generationParams: {
        ...asset.generationParams,
        fileName: material.fileName,
        slot: material.slot ?? ""
      },
      error: undefined
    };
  });
}

function isMaterialCompatibleWithAsset(asset: AssetRequirement, material: StartUploadedMaterial): boolean {
  if (asset.type === "image" || asset.type === "ui") return material.mimeType.startsWith("image/");
  if (asset.type === "sfx" || asset.type === "bgm") return material.mimeType.startsWith("audio/");
  return false;
}

function createReferencePackageSummary(payload: Record<string, any>): ReferencePackageSummary {
  const packageManifest = payload.packageManifest ?? {};
  const assetIndex = payload.assetIndex ?? {};
  const runtimeEntry = payload.runtimeEntry ?? {};
  const healthReport = payload.healthReport ?? {};
  const aiEditPlan = payload.aiEditPlan ?? {};
  return {
    projectId: payload.project?.id ?? packageManifest.projectId,
    versionId: payload.project?.version?.id ?? packageManifest.versionId ?? "v1",
    packageName: packageManifest.packageName ?? payload.project?.title ?? "参考游戏",
    packageFileName: packageManifest.packageFileName ?? "",
    fileCount: packageManifest.fileCount ?? 0,
    totalSize: packageManifest.totalSize ?? 0,
    healthStatus: healthReport.status ?? "warning",
    entry: runtimeEntry.entry ?? "index.html",
    scripts: runtimeEntry.scripts ?? [],
    styles: runtimeEntry.styles ?? [],
    images: assetIndex.images ?? [],
    audio: assetIndex.audio ?? [],
    fonts: assetIndex.fonts ?? [],
    data: assetIndex.data ?? [],
    suggestedEdits: aiEditPlan.suggestedEdits ?? [],
    risks: [...(healthReport.errors ?? []), ...(healthReport.warnings ?? [])]
  };
}

function StartPage({
  draft,
  locale,
  onLocaleToggle,
  onDraftChange,
  onPlay,
  onProjects,
  onCreate,
  onUseTemplate,
  onPreviewTemplate,
  onUploadPackage,
  referencePackage,
  onRemoveReferencePackage,
  uploadMessage
}: {
  draft: StartGameDraft;
  locale: Locale;
  onLocaleToggle: () => void;
  onDraftChange: (draft: StartGameDraft) => void;
  onPlay: () => void;
  onProjects: () => void;
  onCreate: () => void;
  onUseTemplate: (template: TemplateRecord) => void;
  onPreviewTemplate: (template: TemplateRecord) => void;
  onUploadPackage: (file: File) => Promise<void>;
  referencePackage: ReferencePackageSummary | null;
  onRemoveReferencePackage: () => void;
  uploadMessage: string;
}) {
  const canCreate = draft.idea.trim().length > 0;
  const t = getMessages(locale);
  const updateDraft = (patch: Partial<StartGameDraft>) => onDraftChange({ ...draft, ...patch });
  const officialTemplates = getOfficialTemplates();
  const templateTiles = createStartTemplateTiles();
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  return (
    <main className="start-shell">
      <header className="start-nav">
        <div className="start-brand">
          <div className="brand-mark">W</div>
          <strong>WOW Game</strong>
        </div>
        <nav className="start-mode-tabs" aria-label={t.start.modeAria}>
          <button className="active">
            <Plus size={15} />
            {t.start.create}
          </button>
          <button onClick={onPlay}>
            <Gamepad2 size={15} />
            {t.start.play}
          </button>
        </nav>
        <div className="start-actions">
          <button className="ghost-button">
            <Zap size={15} />
            {t.brand.upgrade}
          </button>
          <button className="ghost-button" onClick={onProjects}>
            <Wand2 size={15} />
            {t.start.myProjects}
          </button>
          <button className="locale-button" onClick={onLocaleToggle}>
            {locale === "zh-CN" ? "中文" : "EN"}
          </button>
        </div>
      </header>

      <section className="start-stage">
        <div className="start-copy">
          <h1>{t.start.title}</h1>
          <p>
            {t.start.subtitlePrefix}{" "}
            <button type="button" onClick={() => setShowTemplateLibrary(true)}>
              {t.start.subtitleAction}
            </button>
          </p>
        </div>

        <section className="create-dialog" aria-label={t.start.dialogAria}>
          <textarea
            maxLength={500}
            value={draft.idea}
            onChange={(event) => updateDraft({ idea: event.target.value })}
            placeholder={t.prompt.placeholder}
          />

          <div className="create-dialog-row">
            <label className="field-label">
              {t.start.engine}
              <span className="engine-pill">{t.prompt.localEngine}</span>
            </label>
            <span className="char-count">{draft.idea.length}/500</span>
          </div>

          <div className="start-template-toolbar">
            <span>小游戏类型</span>
            <button type="button" className="official-template-launcher" onClick={() => setShowTemplateLibrary(true)}>
              <Library size={15} />
              官方模板库
            </button>
          </div>

          <div className="template-icon-grid" aria-label="小游戏类型">
            {templateTiles.map((template) => (
              <button
                key={template.templateFamily}
                type="button"
                className={
                  draft.templateFamily === template.templateFamily ? "template-icon-card active" : "template-icon-card"
                }
                onClick={() => {
                  const templateFamily = template.templateFamily as TemplateFamily;
                  updateDraft({
                    templateFamily,
                    uploadedMaterials: draft.uploadedMaterials.map((material) => ({
                      ...material,
                      assetKey: resolveMaterialAssetKey(material.slot, templateFamily)
                    }))
                  });
                }}
              >
                <i>{template.icon}</i>
                <strong>{template.shortLabel}</strong>
                <span>{template.hint}</span>
              </button>
            ))}
          </div>

          <div className="create-dialog-footer">
            <div className="upload-choice-group" aria-label={t.start.uploadOptionsAria}>
              <label className="upload-button material-upload">
                <ImageIcon size={16} />
                <span>
                  {t.start.uploadMaterials}
                  <small>{t.start.uploadMaterialsHint}</small>
                </span>
                <input
                  multiple
                  type="file"
                  accept="image/*,audio/*,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a"
                  onChange={async (event) => {
                    const files = Array.from(event.target.files ?? []);
                    const materials = await filesToUserMaterials(files, draft.templateFamily);
                    updateDraft({
                      uploadedFileNames: files.map((file) => file.name),
                      uploadedMaterials: materials
                    });
                  }}
                />
              </label>
              <label className="upload-button package-upload">
                <Upload size={16} />
                <span>
                  {t.start.uploadPackage}
                  <small>{t.start.uploadPackageHint}</small>
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={async (event) => {
                    const file = Array.from(event.target.files ?? []).find((item) =>
                      item.name.toLowerCase().endsWith(".zip")
                    );
                    if (file) {
                      await onUploadPackage(file);
                    }
                  }}
                />
              </label>
            </div>
            {draft.uploadedFileNames.length > 0 ? (
              <div className="uploaded-files">
                {draft.uploadedMaterials.length > 0
                  ? draft.uploadedMaterials.slice(0, 4).map((material) => (
                      <label key={material.id}>
                        <span>{material.fileName}</span>
                        <select
                          value={material.slot}
                          onChange={(event) => {
                            const slot = event.target.value as UserMaterialSlot;
                            updateDraft({
                              uploadedMaterials: draft.uploadedMaterials.map((item) =>
                                item.id === material.id
                                  ? {
                                      ...item,
                                      slot,
                                      assetKey: resolveMaterialAssetKey(slot, draft.templateFamily)
                                    }
                                  : item
                              )
                            });
                          }}
                        >
                          {materialSlotOptions.map((slot) => (
                            <option key={slot} value={slot}>
                              {materialSlotLabels[slot]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))
                  : draft.uploadedFileNames.slice(0, 3).map((fileName) => <span key={fileName}>{fileName}</span>)}
              </div>
            ) : null}
            {referencePackage ? (
              <div className="reference-package-card">
                <div>
                  <strong>{referencePackage.packageName}</strong>
                  <span>
                    {referencePackage.fileCount} files / 图片 {referencePackage.images.length} / 音频 {referencePackage.audio.length} / {referencePackage.healthStatus}
                  </span>
                </div>
                <button type="button" onClick={onRemoveReferencePackage}>
                  移除参考
                </button>
              </div>
            ) : null}
            {uploadMessage ? <p className="upload-message">{uploadMessage}</p> : null}
            <button className="create-button" disabled={!canCreate} onClick={onCreate}>
              {t.start.create}
              <Send size={17} />
            </button>
          </div>
        </section>
      </section>
      {showTemplateLibrary ? (
        <div className="official-template-modal" role="dialog" aria-modal="true" aria-label="官方模板库">
          <div className="official-template-dialog">
            <header className="official-template-dialog-header">
              <div>
                <span>OFFICIAL TEMPLATES</span>
                <strong>官方模板库</strong>
              </div>
              <button type="button" onClick={() => setShowTemplateLibrary(false)} aria-label="关闭官方模板库">
                <X size={17} />
              </button>
            </header>
            <div className="official-template-grid">
              {officialTemplates.map((template) => (
                <article className="official-template-card" key={template.templateId}>
                  <div>
                    <span>{template.tags.slice(0, 2).join(" / ")}</span>
                    <strong>{template.title}</strong>
                    <p>{template.description}</p>
                  </div>
                  <div className="official-template-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateLibrary(false);
                        onPreviewTemplate(template);
                      }}
                    >
                      试玩
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateLibrary(false);
                        onUseTemplate(template);
                      }}
                    >
                      使用此模板
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function IdeaDialogPage({
  session,
  statusLabel,
  messages,
  draft,
  revisionText,
  canGenerate,
  canStartAssets,
  isPreparingAssets,
  actionLabel,
  isGenerating,
  onRevisionTextChange,
  onAnswer,
  onGenerate,
  onStartAssets,
  onClose
}: {
  session: ConversationSession;
  statusLabel: string;
  messages: ReturnType<typeof getMessages>;
  draft: StartGameDraft;
  revisionText: string;
  canGenerate: boolean;
  canStartAssets: boolean;
  isPreparingAssets: boolean;
  actionLabel: string;
  isGenerating: boolean;
  onRevisionTextChange: (value: string) => void;
  onAnswer: (value: string) => void;
  onGenerate: () => void;
  onStartAssets: () => void;
  onClose: () => void;
}) {
  const dialog = buildIdeaDialogModel(session, messages.ideaDialog);
  const currentQuestion = dialog.currentQuestion;
  const answerValue = revisionText.trim() || currentQuestion?.defaultAnswer || "";
  const progressText = `${dialog.answeredCount}/${dialog.totalQuestions}`;
  const canRunPrimaryAction = canGenerate || canStartAssets;
  const runPrimaryAction = () => {
    if (canGenerate) onGenerate();
    else if (canStartAssets) onStartAssets();
    else submitAnswer();
  };

  const submitAnswer = () => {
    if (!currentQuestion || !answerValue) return;
    onAnswer(answerValue);
    onRevisionTextChange("");
  };

  return (
    <main className="idea-dialog-shell">
      <section className="idea-dialog-window" aria-label={messages.ideaDialog.aria}>
        <header className="idea-dialog-header">
          <div>
            <span>{messages.ideaDialog.eyebrow}</span>
            <h1>{messages.ideaDialog.title}</h1>
          </div>
          <button className="idea-dialog-close" onClick={onClose} aria-label={messages.ideaDialog.close}>
            <X size={24} />
          </button>
        </header>

        <div className="idea-dialog-body">
          <div className="idea-dialog-scroll">
            <div className="idea-dialog-status">
              <span>{statusLabel}</span>
              <strong>{draft.templateFamily}</strong>
              <em>{progressText}</em>
            </div>
            {dialog.turns.map((turn) =>
              turn.role === "user" ? (
                <div className="idea-message-row user" key={turn.id}>
                  <article className="idea-user-bubble">{turn.content}</article>
                </div>
              ) : (
                <div className="idea-message-row assistant" key={turn.id}>
                  <div className="idea-avatar">AI</div>
                  <article className="idea-assistant-bubble">
                    <p>{turn.content}</p>
                    {turn.question?.options && (
                      <div className="idea-option-stack">
                        {turn.question.options.map((option, index) => (
                          <button
                            key={option}
                            className="idea-option-card"
                            onClick={() => {
                              onAnswer(option);
                              onRevisionTextChange("");
                            }}
                          >
                            <span>{index + 1}</span>
                            <strong>{option}</strong>
                            <small>{messages.ideaDialog.optionHint}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )
            )}
          </div>

          <footer className="idea-dialog-composer">
            <textarea
              value={revisionText}
              onChange={(event) => onRevisionTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (canRunPrimaryAction) runPrimaryAction();
                  else submitAnswer();
                }
              }}
              placeholder={
                canRunPrimaryAction
                  ? messages.ideaDialog.readyPlaceholder
                  : messages.ideaDialog.replyPlaceholder
              }
            />
            <div className="idea-dialog-actions">
              <button
                className="idea-pick-button"
                disabled={!currentQuestion}
                onClick={() => {
                  if (!currentQuestion) return;
                  onAnswer(currentQuestion.defaultAnswer);
                  onRevisionTextChange("");
                }}
              >
                {messages.ideaDialog.pickForMe}
              </button>
              <button
                className={canRunPrimaryAction ? "idea-send-button generate" : "idea-send-button"}
                disabled={isGenerating || (!canRunPrimaryAction && !currentQuestion)}
                onClick={runPrimaryAction}
              >
                {isGenerating ? <RefreshCcw size={18} /> : canRunPrimaryAction ? <Wand2 size={18} /> : <Send size={18} />}
                <span>{actionLabel}</span>
              </button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

function PlayableDetailPage({
  projectId,
  versionId,
  messages,
  onCreate
}: {
  projectId: string;
  versionId: string;
  messages: ReturnType<typeof getMessages>;
  onCreate: () => void;
}) {
  const [record, setRecord] = useState<{
    project: MockProject;
    publishRecord: { publicUrl: string };
    uploadedPackage?: {
      runtimeEntry: { entryUrl: string };
      packageManifest: { fileCount: number; totalSize: number };
      assetIndex: { images: Array<{ path: string; type: string }>; audio: Array<{ path: string; type: string }> };
      healthReport: { status: string; errors: string[]; warnings: string[] };
      aiEditPlan: { summary: string; suggestedEdits: string[] };
    };
  } | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [packageMessage, setPackageMessage] = useState("");

  useEffect(() => {
    let active = true;
    requestPlayableProject(projectId, versionId)
      .then((payload) => {
        if (active) setRecord(payload as NonNullable<typeof record>);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
    return () => {
      active = false;
    };
  }, [projectId, versionId]);

  if (error) {
    return (
      <main className="play-detail-shell">
        <section className="play-detail-empty">
          <h1>{messages.playDetail.notFoundTitle}</h1>
          <p>{messages.playDetail.notFoundDetail}</p>
          <button onClick={onCreate}>{messages.playDetail.createNew}</button>
        </section>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="play-detail-shell">
        <section className="play-detail-empty">
          <h1>{messages.playDetail.loadingTitle}</h1>
          <p>{messages.playDetail.loadingDetail}</p>
        </section>
      </main>
    );
  }

  const project = record.project;
  const refreshRecord = () => {
    requestPlayableProject(projectId, versionId).then((payload) => {
      setRecord(payload as NonNullable<typeof record>);
    });
  };
  return (
    <main className="play-detail-shell">
      <header className="play-detail-header">
        <div>
          <strong>WOW Game Play</strong>
          <h1>{project.title}</h1>
          <p>{project.gameConfig.pitch}</p>
        </div>
        <button onClick={onCreate}>{messages.playDetail.createYourGame}</button>
      </header>
      <section className="play-detail-layout">
        <div className="play-detail-game">
          {record.uploadedPackage ? (
            <UploadedPackagePreview packageRecord={record.uploadedPackage} title={project.title} />
          ) : (
            <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} gameHooks={project.gameHooks} />
          )}
        </div>
        <aside className="play-detail-side">
          <h2>{messages.playDetail.goal}</h2>
          <p>{project.gameConfig.playerGoal}</p>
          <h2>{messages.playDetail.controls}</h2>
          <p>{project.gameConfig.controls.join(" / ")}</p>
          <h2>{messages.playDetail.shareLink}</h2>
          <code>{record.publishRecord.publicUrl}</code>
          {record.uploadedPackage ? (
            <div className="uploaded-package-summary">
              <h2>上传包体</h2>
              <p>
                {record.uploadedPackage.packageManifest.fileCount} files / {record.uploadedPackage.healthReport.status}
              </p>
              <p>图片 {record.uploadedPackage.assetIndex.images.length} / 音频 {record.uploadedPackage.assetIndex.audio.length}</p>
              <strong>AI 修改建议</strong>
              <p>{record.uploadedPackage.aiEditPlan.summary}</p>
              <strong>安全替换资源</strong>
              {[...record.uploadedPackage.assetIndex.images, ...record.uploadedPackage.assetIndex.audio].map((asset) => (
                <label className="package-asset-replace" key={asset.path}>
                  <span>{asset.path}</span>
                  <input
                    type="file"
                    accept={asset.type === "audio" ? "audio/*" : "image/*"}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await replacePackageAsset({
                        projectId,
                        versionId,
                        assetPath: asset.path,
                        fileBase64: await readFileAsBase64(file),
                        fileName: file.name
                      });
                      setPackageMessage(`${asset.path} 已替换`);
                      refreshRecord();
                    }}
                  />
                </label>
              ))}
              {packageMessage ? <p className="feedback-message">{packageMessage}</p> : null}
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPlayableFeedback(projectId, versionId, {
                rating,
                comment: comment.trim() || messages.playDetail.defaultFeedback,
                playerName: "guest"
              }).then((payload) => {
                setFeedbackMessage(payload.feedback.iterationSuggestion);
                setComment("");
              });
            }}
          >
            <label>
              {messages.playDetail.rating}
              <input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              />
            </label>
            <label>
              {messages.playDetail.feedback}
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <button type="submit">{messages.playDetail.submitFeedback}</button>
          </form>
          {feedbackMessage && <p className="feedback-message">{feedbackMessage}</p>}
        </aside>
      </section>
    </main>
  );
}

function UploadedPackagePreview({
  packageRecord,
  title
}: {
  packageRecord: {
    runtimeEntry: { entryUrl: string };
    healthReport: { status: string; errors: string[]; warnings: string[] };
  };
  title: string;
}) {
  if (packageRecord.healthReport.status === "fail") {
    return (
      <div className="uploaded-package-preview error">
        <h2>上传游戏暂不可运行</h2>
        <p>{packageRecord.healthReport.errors.join(" / ")}</p>
      </div>
    );
  }
  return (
    <iframe
      className="uploaded-package-frame"
      title={`${title} uploaded playable`}
      src={packageRecord.runtimeEntry.entryUrl}
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-popups"
      allow="autoplay; fullscreen; gamepad"
    />
  );
}

function SharePanel({
  project,
  publicUrl,
  qrPayload,
  messages,
  onClose
}: {
  project: MockProject;
  publicUrl: string;
  qrPayload: string;
  messages: ReturnType<typeof getMessages>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
  };
  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `WOW Game - ${project.title}`,
        text: project.gameConfig.pitch,
        url: publicUrl
      });
    } else {
      await copyLink();
    }
  };
  return (
    <div className="share-overlay">
      <section className="share-panel">
        <button className="share-close" onClick={onClose}>{messages.sharePanel.close}</button>
        <h2>{messages.sharePanel.title}</h2>
        <p>{project.title}</p>
        <input readOnly value={publicUrl} />
        <div className="share-actions">
          <button onClick={copyLink}>{copied ? messages.sharePanel.copied : messages.sharePanel.copy}</button>
          <button onClick={shareNative}>{messages.sharePanel.native}</button>
        </div>
        <div className="qr-box">
          <span>{messages.sharePanel.qrPayload}</span>
          <code>{qrPayload}</code>
        </div>
      </section>
    </div>
  );
}

function PlayPage({
  locale,
  projects,
  onCreate,
  onProjects,
  onPlayGame,
  onPlayProject
}: {
  locale: Locale;
  projects: ProjectRecord[];
  onCreate: () => void;
  onProjects: () => void;
  onPlayGame: (game: PlayGame) => void;
  onPlayProject: (project: ProjectRecord) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<PlayCategory>("All");
  const games = activeCategory === "All" ? getFeaturedGames() : getGamesByCategory(activeCategory).slice(0, 12);
  const uploadedProjects = projects.filter((project) => project.contentType === "uploaded_package").slice(0, 6);
  const t = getMessages(locale);

  return (
    <main className="play-shell">
      <header className="play-nav">
        <div className="start-brand">
          <div className="brand-mark">W</div>
          <strong>WOW Game</strong>
        </div>
        <nav className="start-mode-tabs" aria-label={t.start.modeAria}>
          <button onClick={onCreate}>
            <Plus size={15} />
            {t.start.create}
          </button>
          <button className="active">
            <Gamepad2 size={15} />
            {t.start.play}
          </button>
        </nav>
        <div className="play-actions">
          <button className="ghost-button">
            <Zap size={15} />
            {t.brand.upgrade}
          </button>
          <button className="ghost-button" onClick={onProjects}>
            <Wand2 size={15} />
            {t.start.myProjects}
          </button>
          <button className="play-icon-button" title={t.play.search}>
            <Search size={18} />
          </button>
        </div>
      </header>

      <nav className="play-category-bar" aria-label="Game categories">
        {playCategories.map((category) => (
          <button
            key={category}
            className={category === activeCategory ? "active" : ""}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <section className="play-scroll">
        {uploadedProjects.length > 0 ? (
          <section className="game-section">
            <div className="section-row">
              <h2>{t.play.uploaded}</h2>
            </div>
            <div className="project-grid compact-project-grid">
              {uploadedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  messages={t}
                  onEdit={() => undefined}
                  onRun={() => onPlayProject(project)}
                  onDuplicate={() => undefined}
                  onDelete={() => undefined}
                />
              ))}
            </div>
          </section>
        ) : null}
        <GameSection
          title={activeCategory === "All" ? t.play.featured : activeCategory}
          games={games}
          messages={t}
          onPlayGame={onPlayGame}
          compact
        />
        <GameMosaic title={t.play.popular} games={getPopularGames()} messages={t} onPlayGame={onPlayGame} />
        <GameSection title={t.play.casual} games={getGamesByCategory("Casual").slice(0, 8)} messages={t} onPlayGame={onPlayGame} />
        <GameSection title={t.play.advanced} games={getGamesByCategory("Advanced").slice(0, 8)} messages={t} onPlayGame={onPlayGame} />
      </section>
    </main>
  );
}

function ProjectsPage({
  locale,
  projects,
  welcomeName,
  onWelcomeNameChange,
  onCreate,
  onPlay,
  onEdit,
  onRun,
  onDuplicate,
  onDelete
}: {
  locale: Locale;
  projects: ProjectRecord[];
  welcomeName: string;
  onWelcomeNameChange: (value: string) => void;
  onCreate: () => void;
  onPlay: () => void;
  onEdit: (project: ProjectRecord) => void;
  onRun: (project: ProjectRecord) => void;
  onDuplicate: (project: ProjectRecord) => void;
  onDelete: (project: ProjectRecord) => void;
}) {
  const t = getMessages(locale);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [filter, setFilter] = useState<"all" | ProjectRecord["status"]>("all");
  const [sort, setSort] = useState<"updated" | "plays" | "name">("updated");
  const visibleProjects = projects
    .filter((project) => filter === "all" || project.status === filter)
    .sort((left, right) => {
      if (sort === "plays") return right.plays - left.plays;
      if (sort === "name") return left.title.localeCompare(right.title);
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / pageSize));
  const safePage = Math.min(pageIndex, totalPages);
  const pageProjects = visibleProjects.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPageIndex(1);
  }, [filter, pageSize]);

  return (
    <main className="projects-shell">
      <header className="start-nav projects-nav">
        <div className="start-brand">
          <div className="brand-mark">W</div>
          <strong>WOW Game</strong>
        </div>
        <nav className="start-mode-tabs" aria-label={t.start.modeAria}>
          <button onClick={onCreate}>
            <Plus size={15} />
            {t.start.create}
          </button>
          <button onClick={onPlay}>
            <Gamepad2 size={15} />
            {t.start.play}
          </button>
          <button className="active">
            <Wand2 size={15} />
            {t.start.myProjects}
          </button>
        </nav>
        <div className="start-actions">
          <button className="ghost-button">
            <Zap size={15} />
            {t.brand.upgrade}
          </button>
          <button className="locale-button">{locale === "zh-CN" ? "中文" : "EN"}</button>
        </div>
      </header>

      <section className="projects-scroll">
        <div className="welcome-panel">
          <label>
            <span>{t.projects.welcomeLabel}</span>
            <input
              value={welcomeName}
              onChange={(event) => onWelcomeNameChange(event.target.value)}
              aria-label={t.projects.welcomeLabel}
            />
          </label>
          <button className="ghost-button">
            <Share2 size={16} />
            {t.projects.shareProfile}
          </button>
        </div>

        <section className="tips-panel">
          <div>
            <strong>{t.projects.tipsTitle}</strong>
            <span>{t.projects.tipsDescription}</span>
          </div>
          <button className="primary-action">{t.projects.enableTips}</button>
        </section>

        <section className="projects-board">
          <div className="projects-board-header">
            <div>
              <h1>{t.projects.title}</h1>
              <p>{t.projects.subtitle}</p>
            </div>
            <div className="projects-filters">
              <label>
                {t.projects.filter}
                <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                  <option value="all">{t.projects.all}</option>
                  <option value="published">{t.projects.published}</option>
                  <option value="draft">{t.projects.draft}</option>
                  <option value="private">{t.projects.private}</option>
                </select>
              </label>
              <label>
                {t.projects.sort}
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="updated">{t.projects.lastModified}</option>
                  <option value="plays">{t.projects.mostPlayed}</option>
                  <option value="name">{t.projects.nameSort}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="project-grid">
            {pageProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                messages={t}
                onEdit={() => onEdit(project)}
                onRun={() => onRun(project)}
                onDuplicate={() => onDuplicate(project)}
                onDelete={() => onDelete(project)}
              />
            ))}
          </div>

          <div className="project-pagination">
            <label>
              {t.projects.perPage}
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[6, 9, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="pagination-controls">
              <button disabled={safePage <= 1} onClick={() => setPageIndex((value) => Math.max(1, value - 1))}>
                <ChevronDown size={16} />
              </button>
              <span>{t.projects.page} {safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPageIndex((value) => Math.min(totalPages, value + 1))}>
                <ChevronDown size={16} />
              </button>
            </div>
            <span>{visibleProjects.length} {t.projects.countSuffix}</span>
          </div>
        </section>
      </section>
    </main>
  );
}

function ProjectCard({
  project,
  messages,
  onEdit,
  onRun,
  onDuplicate,
  onDelete
}: {
  project: ProjectRecord;
  messages: ReturnType<typeof getMessages>;
  onEdit: () => void;
  onRun: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="project-card">
      <div className="project-cover" style={{ background: cardBackground("#0b5666,#ffbf4d") }}>
        <div className="project-badges">
          <span className={`status ${project.status}`}>{messages.projects[project.status]}</span>
          <span>{messages.projects[project.visibility]}</span>
          {!project.editable ? <span>{messages.projects.readOnly}</span> : null}
        </div>
        <strong>{project.sourceLabel}</strong>
      </div>
      <div className="project-card-body">
        <h2>{project.title}</h2>
        <p>{project.idea}</p>
        <div className="project-meta">
          <span>{project.updatedAt}</span>
          <span>{formatCount(project.plays)} / {project.likes}</span>
        </div>
        <div className="project-actions">
          {project.editable ? (
            <>
              <button className="edit-action" onClick={onEdit}>
                <Pencil size={14} />
                {messages.projects.edit}
              </button>
              <button title={messages.projects.duplicate} onClick={onDuplicate}>
                <Copy size={14} />
              </button>
            </>
          ) : (
            <button className="edit-action" onClick={onRun}>
              <Gamepad2 size={14} />
              {messages.projects.experience}
            </button>
          )}
          <button title={messages.projects.run} onClick={onRun}>
            <Gamepad2 size={14} />
          </button>
          <button title={messages.projects.delete} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function GameSection({
  title,
  games,
  messages,
  compact = false,
  onPlayGame
}: {
  title: string;
  games: PlayGame[];
  messages: ReturnType<typeof getMessages>;
  compact?: boolean;
  onPlayGame: (game: PlayGame) => void;
}) {
  return (
    <section className="game-section">
      <div className="section-row">
        <h2>{title}</h2>
        {!compact && <button>{messages.play.viewMore}</button>}
      </div>
      <div className={compact ? "game-row compact" : "game-row"}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} messages={messages} onClick={() => onPlayGame(game)} />
        ))}
      </div>
    </section>
  );
}

function GameMosaic({
  title,
  games,
  messages,
  onPlayGame
}: {
  title: string;
  games: PlayGame[];
  messages: ReturnType<typeof getMessages>;
  onPlayGame: (game: PlayGame) => void;
}) {
  return (
    <section className="game-section">
      <div className="section-row">
        <h2>{title}</h2>
      </div>
      <div className="game-mosaic">
        {games.map((game) => (
          <GameCard key={game.id} game={game} messages={messages} onClick={() => onPlayGame(game)} />
        ))}
      </div>
    </section>
  );
}

function GameCard({
  game,
  messages,
  onClick
}: {
  game: PlayGame;
  messages: ReturnType<typeof getMessages>;
  onClick: () => void;
}) {
  return (
    <button className={`game-card ${game.size ?? "normal"}`} onClick={onClick}>
      <div className="game-art" style={{ background: cardBackground(game.palette) }}>
        <span>{game.categories[0]}</span>
        <strong>{game.title}</strong>
      </div>
      <div className="game-card-overlay">
        <strong>{game.title}</strong>
        <span>{formatCount(game.plays)} {messages.play.plays} / {game.likes} {messages.play.likes}</span>
      </div>
    </button>
  );
}

function cardBackground(palette: string): string {
  const [a, b] = palette.split(",");
  return `radial-gradient(circle at 24% 22%, rgba(255,255,255,.34), transparent 12%),
    linear-gradient(135deg, ${a}, ${b}),
    repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 2px, transparent 2px 18px)`;
}

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
}

function AgentHeader({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  return (
    <div className="agent-header">
      <div className="agent-avatar">
        <Bot size={18} />
      </div>
      <div>
        <strong>{messages.brand.agent}</strong>
        <span>{project.classification.templateFamily} {messages.agent.pipelineLabel}</span>
      </div>
    </div>
  );
}

function AgentIntro({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  return (
    <article className="chat-card agent-card">
      <p className="thought-line">{messages.agent.thinking}</p>
      <h2>{project.title} {messages.agent.readySuffix}</h2>
      <p>{messages.agent.intro}</p>
      <div className="quick-actions">
        <span>{messages.agent.actionHazards}</span>
        <span>{messages.agent.actionCheckpoints}</span>
        <span>{messages.agent.actionPickupCue}</span>
      </div>
    </article>
  );
}

function UserPrompt({ text }: { text: string }) {
  return <div className="user-prompt">{text}</div>;
}

function StudioChatFlow({
  messages,
  onConfirmAssets,
  onUploadAsset,
  onRegenerateAsset,
  regeneratingSlots
}: {
  messages: StudioChatMessage[];
  onConfirmAssets: (assetCandidates: AssetCandidates) => void;
  onUploadAsset: (slot: UserMaterialSlot, files: File[]) => Promise<void>;
  onRegenerateAsset: (assetCandidate: AssetCandidates["candidates"][number]) => void;
  regeneratingSlots: Set<UserMaterialSlot>;
}) {
  return (
    <div className="studio-chat-flow" aria-label="AI 创作对话">
      {messages.map((message) => (
        <article key={message.id} className={`studio-chat-message ${message.role}`}>
          <span>{message.meta}</span>
          <p>{message.content}</p>
          {message.assetProgress ? <AssetProgressList steps={message.assetProgress} /> : null}
          {message.assetCandidates ? (
            <AssetCandidateReview
              assetCandidates={message.assetCandidates}
              onConfirm={() => onConfirmAssets(message.assetCandidates as AssetCandidates)}
              onUploadAsset={onUploadAsset}
              onRegenerateAsset={onRegenerateAsset}
              regeneratingSlots={regeneratingSlots}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}

function AssetProgressList({ steps }: { steps: NonNullable<StudioChatMessage["assetProgress"]> }) {
  return (
    <div className="asset-progress-list" aria-label="素材生成进度">
      {steps.map((step) => (
        <div className="asset-progress-step" key={step.slot}>
          <span className="asset-progress-dot" />
          <strong>{step.label}</strong>
          <span>生成中</span>
        </div>
      ))}
    </div>
  );
}

function PromptDock({
  messages,
  revisionText,
  modelStatusLabel,
  canGenerate,
  canStartAssets,
  isGenerating,
  isGeneratingAssets,
  isSubmittingRevision,
  onGenerate,
  onStartAssets,
  onIdeaChange,
  onSubmitRevision
  ,
  onUploadMaterials
}: {
  messages: ReturnType<typeof getMessages>;
  revisionText: string;
  modelStatusLabel: string;
  canGenerate: boolean;
  canStartAssets: boolean;
  isGenerating: boolean;
  isGeneratingAssets: boolean;
  isSubmittingRevision: boolean;
  onGenerate: () => void;
  onStartAssets: () => void;
  onIdeaChange: (idea: string) => void;
  onSubmitRevision: () => void;
  onUploadMaterials: (files: File[], preferredSlot?: UserMaterialSlot) => Promise<void>;
}) {
  return (
    <div className="prompt-dock">
      <textarea
        value={revisionText}
        onChange={(event) => onIdeaChange(event.target.value)}
        aria-label={messages.prompt.aria}
        placeholder={messages.prompt.followupPlaceholder}
      />
      <div className="prompt-tools">
        <button className="model-select">
          {modelStatusLabel}
        </button>
        <div className="tool-icons">
          <label title="上传图片素材">
            <ImageIcon size={16} />
            <input
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
              multiple
              onChange={async (event) => {
                await onUploadMaterials(Array.from(event.target.files ?? []));
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label title="上传音频素材">
            <Music2 size={16} />
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              multiple
              onChange={async (event) => {
                await onUploadMaterials(Array.from(event.target.files ?? []));
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Wand2 size={16} />
          <RefreshCcw size={16} />
        </div>
        <button className="dock-action" onClick={onSubmitRevision} disabled={!revisionText.trim() || isSubmittingRevision}>
          {messages.prompt.sendFollowup}
        </button>
        <button
          className={isGenerating || isGeneratingAssets ? "send-button generating" : "send-button"}
          title={canStartAssets ? "生成素材方案" : messages.prompt.generateNext}
          onClick={canStartAssets ? onStartAssets : onGenerate}
          disabled={isGeneratingAssets || (!canStartAssets && !canGenerate)}
        >
          {isGenerating || isGeneratingAssets ? <RefreshCcw size={18} /> : canStartAssets ? <ImageIcon size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

function AssetCandidateReview({
  assetCandidates,
  onConfirm,
  onUploadAsset,
  onRegenerateAsset,
  regeneratingSlots
}: {
  assetCandidates: AssetCandidates;
  onConfirm: () => void;
  onUploadAsset: (slot: UserMaterialSlot, files: File[]) => Promise<void>;
  onRegenerateAsset: (assetCandidate: AssetCandidates["candidates"][number]) => void;
  regeneratingSlots: Set<UserMaterialSlot>;
}) {
  const confirmableAssets = buildConfirmedCoreAssets(assetCandidates);
  const canConfirmDirection = hasConfirmedCoreAssets(confirmableAssets);
  return (
    <section className="asset-candidate-review">
      <div className="asset-candidate-header">
        <span>素材确认</span>
        <strong>AI 已生成四张核心图片素材</strong>
        <button type="button" onClick={onConfirm} disabled={!canConfirmDirection}>
          确认素材方向
        </button>
        {!canConfirmDirection ? <small>补齐四个核心素材后可确认；失败素材可重试或上传替换。</small> : null}
      </div>
      <div className="asset-candidate-grid">
        {assetCandidates.candidates.map((candidate) => {
          const canConfirm =
            isRuntimeImageUrl(candidate.fileUrl) &&
            isRuntimeImageUrl(candidate.previewUrl) &&
            candidate.validationStatus !== "failed" &&
            !candidate.error;
          const hasWarning = canConfirm && candidate.validationStatus === "warning";
          const hasOriginalLibrary = typeof candidate.generationParams?.originalLibraryUrl === "string";
          const cutoutApplied = candidate.generationParams?.cutoutApplied === true;
          const isRegenerating = regeneratingSlots.has(candidate.slot);
          const fullPrompt =
            typeof candidate.generationParams?.finalPrompt === "string"
              ? candidate.generationParams.finalPrompt
              : candidate.prompt;
          const candidateVersionKey =
            candidate.fileUrl || candidate.previewUrl || String(candidate.generationParams?.assetBatchId ?? "");
          return (
            <article
              className="asset-candidate-card"
              key={`${candidate.slot}-${candidate.assetKey}-${candidateVersionKey}`}
            >
              {candidate.type === "image" || candidate.type === "ui" ? (
                candidate.previewUrl ? <img src={candidate.previewUrl} alt={candidate.label} /> : <div className="asset-audio-preview">生成失败</div>
              ) : (
                <div className="asset-audio-preview">
                  <Zap size={20} />
                  <span>{candidate.type.toUpperCase()}</span>
                </div>
              )}
              <div>
                <span>{materialSlotLabels[candidate.slot]}</span>
                <strong>{candidate.label}</strong>
                <p>{candidate.prompt}</p>
                <details className="asset-candidate-prompt">
                  <summary>查看完整提示词</summary>
                  <p>{fullPrompt}</p>
                </details>
                <div className="asset-candidate-meta">
                  {candidate.requiresTransparency ? (
                    <small>
                      {cutoutApplied ? "已生成透明 PNG" : "透明 PNG 校验中"}
                      {typeof candidate.alphaCoverage === "number" ? ` · ${(candidate.alphaCoverage * 100).toFixed(0)}%` : ""}
                    </small>
                  ) : null}
                  {hasOriginalLibrary ? <small>原图已入库</small> : null}
                  {typeof candidate.generationParams?.processedLibraryUrl === "string" ? <small>游戏用图已入库</small> : null}
                </div>
                {candidate.error ? <small className="asset-candidate-error">{candidate.error}</small> : null}
                  {hasWarning && candidate.validationErrors?.length ? (
                    <small className="asset-candidate-warning">{candidate.validationErrors.join(" ")}</small>
                  ) : null}
                <div className="asset-candidate-actions">
                  <span className={canConfirm ? "asset-candidate-status ready" : "asset-candidate-status failed"}>
                    {canConfirm ? (hasWarning ? "可用但建议优化" : "素材可用") : "需要重试或替换"}
                  </span>
                  {!canConfirm ? (
                    <button type="button" onClick={() => onRegenerateAsset(candidate)} disabled={isRegenerating}>
                      <RefreshCcw size={13} />
                      {isRegenerating ? "生成中" : "重新生成此素材"}
                    </button>
                  ) : null}
                  {typeof candidate.generationParams?.originalLibraryUrl === "string" ? (
                    <a href={candidate.generationParams.originalLibraryUrl} download>
                      下载原图
                    </a>
                  ) : null}
                  <label>
                    <Upload size={13} />
                    上传替换
                    <input
                      type="file"
                      accept={candidate.acceptedFileTypes.join(",")}
                      onChange={async (event) => {
                        await onUploadAsset(candidate.slot, Array.from(event.target.files ?? []));
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PreviewWorkspace({
  project,
  messages,
  phase,
  notice,
  canGenerate,
  canStartAssets,
  onGenerate,
  onStartAssets
}: {
  project: MockProject | null;
  messages: ReturnType<typeof getMessages>;
  phase: CreationPhase;
  notice: GenerationNotice | null;
  canGenerate: boolean;
  canStartAssets: boolean;
  onGenerate: () => void;
  onStartAssets: () => void;
}) {
  const isCooking = phase === "cooking";
  const isPlayableReady = phase === "ready" && project;
  const isAssetGenerating = phase === "asset_generating";
  const isAssetReview = phase === "asset_review";
  const isAssetsConfirmed = phase === "assets_confirmed";
  return (
    <div className="preview-workspace">
      {isCooking || isAssetGenerating ? (
        <div className="cooking-state" role="status" aria-live="polite">
          <div className="cooking-orbit">
            <span />
            <span />
            <span />
          </div>
          <p>{isAssetGenerating ? "素材生成中" : messages.preview.cookingEyebrow}</p>
          <h2>{isAssetGenerating ? "正在生成背景、角色、障碍和收集物" : messages.preview.cookingTitle}</h2>
          <strong>{isAssetGenerating ? "完成后会在左侧对话中确认素材" : messages.preview.cookingSubtitle}</strong>
          <small>{isAssetGenerating ? "Agnes 生图通常需要几十秒，请等待左侧素材卡出现。" : messages.preview.cookingDetail}</small>
        </div>
      ) : notice && notice.tone !== "working" && (
        <div className={`preview-result-banner ${notice.tone}`}>
          <Sparkles size={18} />
          <div>
            <strong>{notice.title}</strong>
            <span>{notice.detail}</span>
          </div>
        </div>
      )}
      {!isCooking && !isAssetGenerating && !isPlayableReady && (
        <div className="preview-empty-state">
          <div className="preview-empty-icon">
            <Gamepad2 size={30} />
          </div>
          <p>{isAssetsConfirmed ? "素材已确认" : isAssetReview ? "素材确认" : messages.preview.waitingEyebrow}</p>
          <h2>
            {isAssetsConfirmed
              ? "现在可以生成可玩游戏"
              : isAssetReview
                ? "请先在左侧确认核心素材"
                : messages.preview.waitingTitle}
          </h2>
          <span>
            {isAssetsConfirmed
              ? "点击下方按钮开始构建 Phaser 试玩版本。"
              : isAssetReview
                ? "确认背景、主角、危险物和收集物后，这里会进入生成游戏状态。"
                : messages.preview.waitingDetail}
          </span>
          {isAssetsConfirmed ? (
            <button className="preview-primary-action" type="button" disabled={!canGenerate} onClick={onGenerate}>
              生成可玩游戏
            </button>
          ) : canStartAssets ? (
            <button className="preview-primary-action" type="button" onClick={onStartAssets}>
              生成素材方案
            </button>
          ) : null}
        </div>
      )}
      {!isCooking && isPlayableReady && (
        <>
          <div className="preview-canvas-shell">
            <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} gameHooks={project.gameHooks} />
          </div>
          <div className="floating-status">
            <CheckCircle2 size={16} />
            <span>{messages.preview.generated}</span>
          </div>
          <VerificationRail project={project} messages={messages} />
        </>
      )}
    </div>
  );
}

function VerificationRail({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  return (
    <aside className="verification-rail">
      <h3>{messages.preview.verification}</h3>
      <Score label={messages.preview.build} value={project.qaReport.scores.buildHealth} />
      <Score label={messages.preview.visual} value={project.qaReport.scores.visualUsability} />
      <Score label={messages.preview.intent} value={project.qaReport.scores.intentAlignment} />
      <div className="protocol-list">
        {project.qaReport.debugProtocolEntries.map((entry) => (
          <span key={entry}>{entry}</span>
        ))}
      </div>
    </aside>
  );
}

function AssetWorkspace({
  project,
  messages,
  onAssetsChange
}: {
  project: MockProject;
  messages: ReturnType<typeof getMessages>;
  onAssetsChange: (assets: AssetRequirement[]) => void;
}) {
  const [assets, setAssets] = useState<AssetRequirement[]>(project.assetPack.assets);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(project.assetPack.assets[0]?.assetKey ?? "");
  const mediaGateway = useMemo(() => createMediaGateway(), []);
  useEffect(() => {
    setAssets(project.assetPack.assets);
    setSelectedKey(project.assetPack.assets[0]?.assetKey ?? "");
    setQuery("");
  }, [project.id, project.version.id, project.assetPack.assets]);
  const readyCount = assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  const selectedAsset = assets.find((asset) => asset.assetKey === selectedKey) ?? assets[0];
  const visibleAssets = prioritizeAssets(
    assets.filter((asset) => {
      const text = `${asset.assetKey} ${asset.type} ${asset.purpose} ${asset.status} ${asset.source} ${asset.provider}`.toLowerCase();
      return text.includes(query.toLowerCase());
    })
  );
  const primaryAssets = assets.filter((asset) => isPrimaryAssetKey(asset.assetKey));
  const agnesImageCount = assets.filter((asset) => asset.type === "image" && asset.provider === "agnes").length;
  const imageAssetCount = assets.filter((asset) => asset.type === "image").length;
  const referencePackage = readReferencePackageArtifact(project);

  const updateAsset = (nextAsset: AssetRequirement) => {
    setAssets((current) => {
      const nextAssets = current.map((asset) => (asset.assetKey === nextAsset.assetKey ? nextAsset : asset));
      onAssetsChange(nextAssets);
      return nextAssets;
    });
    setSelectedKey(nextAsset.assetKey);
  };

  const regenerateAsset = async (asset: AssetRequirement) => {
    const nextAsset = await mediaGateway.regenerateProjectAsset(project.id, project.version.id, asset);
    updateAsset(nextAsset);
  };

  const regenerateMissing = async () => {
    const nextAssets = await Promise.all(
      assets.map((asset) =>
        asset.status === "missing" || asset.status === "failed"
          ? mediaGateway.regenerateProjectAsset(project.id, project.version.id, asset)
          : Promise.resolve(asset)
      )
    );
    setAssets(nextAssets);
    onAssetsChange(nextAssets);
  };

  const replaceFromLibrary = async (asset: AssetRequirement) => {
    const nextAsset = await mediaGateway.generateProjectAsset(project.id, project.version.id, {
      ...asset,
      source: "library",
      provider: "asset-library",
      model: "builtin-library-v1"
    });
    updateAsset(nextAsset);
  };

  const uploadAsset = (asset: AssetRequirement, file: File) => {
    const nextAsset = mediaGateway.uploadProjectAsset(project.id, project.version.id, asset, {
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      previewUrl: URL.createObjectURL(file)
    });
    updateAsset(nextAsset);
  };

  return (
    <div className="asset-browser">
      <div className="asset-browser-toolbar">
        <div className="asset-path">
          <button title={messages.assets.back}>{messages.assets.back}</button>
          <strong>{messages.assets.folder}</strong>
        </div>
        <label className="asset-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={messages.assets.search}
          />
        </label>
        <button className="asset-toolbar-button" onClick={regenerateMissing}>
          <RefreshCcw size={16} />
          {messages.assets.regenerateMissing}
        </button>
        {selectedAsset && (
          <label className="asset-toolbar-button">
            <Upload size={16} />
            {messages.assets.upload}
            <input
              type="file"
              accept={selectedAsset.acceptedFileTypes.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAsset(selectedAsset, file);
              }}
            />
          </label>
        )}
        {selectedAsset && (
          <button className="asset-create-button" onClick={() => regenerateAsset(selectedAsset)}>
            <Wand2 size={16} />
            {messages.assets.create}
          </button>
        )}
        {selectedAsset && (selectedAsset.type === "image" || selectedAsset.type === "ui") && (
          <button className="asset-toolbar-button" onClick={() => replaceFromLibrary(selectedAsset)}>
            <Library size={16} />
            {messages.assets.replaceFromLibrary}
          </button>
        )}
      </div>

      <div className="asset-browser-summary">
        <strong>{readyCount}/{assets.length} {messages.assets.ready}</strong>
        <span>asset-pack.json / project {project.id} / version {project.version.id}</span>
      </div>
      <div className="asset-primary-strip">
        <span>Primary assets</span>
        {primaryAssets.map((asset) => (
          <button key={asset.assetKey} onClick={() => setSelectedKey(asset.assetKey)}>
            <strong>{asset.assetKey}</strong>
            <em>{asset.provider}</em>
          </button>
        ))}
        {imageAssetCount > 0 && agnesImageCount === 0 && (
          <small>Images are using the built-in library fallback, not Agnes.</small>
        )}
      </div>

      <div className="asset-browser-layout">
        <div className="asset-grid-board">
          {visibleAssets.map((asset) => (
            <AssetTile
              key={asset.assetKey}
              asset={asset}
              audioLabel={messages.assets.audio}
              selected={asset.assetKey === selectedAsset?.assetKey}
              onSelect={() => setSelectedKey(asset.assetKey)}
              onRegenerate={() => regenerateAsset(asset)}
              onReplaceFromLibrary={() => replaceFromLibrary(asset)}
              onUpload={(file) => uploadAsset(asset, file)}
            />
          ))}
        </div>
        {selectedAsset && <AssetInspector asset={selectedAsset} messages={messages} />}
      </div>
      {referencePackage ? (
        <ReferenceAssetPanel
          referencePackage={referencePackage}
          onAdopt={(file) => {
            const target = assets.find((asset) => matchesReferenceFileSlot(asset.type, file.type));
            if (!target) return;
            updateAsset({
              ...target,
              status: "uploaded",
              source: "uploaded",
              generationMode: "uploaded",
              copyrightStatus: "user_provided",
              fileUrl: `/api/uploads/${referencePackage.projectId}/${referencePackage.versionId}/files/${encodeURIComponent(file.path)}`,
              previewUrl: `/api/uploads/${referencePackage.projectId}/${referencePackage.versionId}/files/${encodeURIComponent(file.path)}`,
              provider: "reference-package",
              model: "adopted-reference",
              generationParams: {
                ...target.generationParams,
                referencePath: file.path
              },
              approvalStatus: "approved"
            });
          }}
        />
      ) : null}
    </div>
  );
}

function readReferencePackageArtifact(project: MockProject): ReferencePackageSummary | null {
  const artifact = project.artifacts.find((item) => item.fileName === "reference-package.json");
  return artifact?.content ? (artifact.content as ReferencePackageSummary) : null;
}

function matchesReferenceFileSlot(assetType: AssetRequirement["type"], fileType: ReferencePackageSummary["images"][number]["type"]) {
  if (fileType === "image") return assetType === "image" || assetType === "ui";
  if (fileType === "audio") return assetType === "sfx" || assetType === "bgm";
  return false;
}

function ReferenceAssetPanel({
  referencePackage,
  onAdopt
}: {
  referencePackage: ReferencePackageSummary;
  onAdopt?: (file: ReferencePackageSummary["images"][number]) => void;
}) {
  const files = [
    ...referencePackage.images.map((file) => ({ ...file, group: "图片" })),
    ...referencePackage.audio.map((file) => ({ ...file, group: "音频" })),
    ...referencePackage.fonts.map((file) => ({ ...file, group: "字体" })),
    ...referencePackage.data.map((file) => ({ ...file, group: "数据" }))
  ];
  return (
    <section className="reference-asset-panel">
      <div>
        <span>参考案例资源</span>
        <strong>{referencePackage.packageName}</strong>
        <small>
          {referencePackage.fileCount} files / {referencePackage.healthStatus}
        </small>
      </div>
      <div className="reference-asset-list">
        {files.slice(0, 24).map((file) => (
          <div className="reference-asset-row" key={`${file.group}-${file.path}`}>
            <span>{file.group}</span>
            <strong>{file.path}</strong>
            <em>{Math.ceil(file.size / 1024)} KB</em>
            {onAdopt && (file.type === "image" || file.type === "audio") ? (
              <button type="button" onClick={() => onAdopt(file)}>
                采用为新素材
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AssetInspector({ asset, messages }: { asset: AssetRequirement; messages: ReturnType<typeof getMessages> }) {
  return (
    <aside className="asset-inspector">
      <div className="asset-inspector-preview">
        {asset.type === "sfx" || asset.type === "bgm" ? (
          <div className="audio-preview">{messages.assets.audio}</div>
        ) : asset.fileUrl && asset.fileUrl.startsWith("data:image") ? (
          <img src={asset.fileUrl} alt={asset.assetKey} />
        ) : (
          <div className={`asset-visual ${asset.type}`}>{asset.type}</div>
        )}
      </div>
      <h3>{messages.assets.details}</h3>
      <strong>{asset.assetKey}</strong>
      <span className={`asset-status ${asset.status}`}>{asset.status}</span>
      <label>{messages.assets.prompt}</label>
      <p>{asset.prompt}</p>
      <label>{messages.assets.description}</label>
      <p>{asset.spec}</p>
      <div className="meta-table">
        <span>{messages.assets.mode}</span>
        <strong>{asset.source}</strong>
        <span>{messages.assets.provider}</span>
        <strong>{asset.provider}</strong>
        <span>{messages.assets.model}</span>
        <strong>{asset.model}</strong>
        <span>{messages.assets.copyright}</span>
        <strong>{asset.copyrightStatus}</strong>
        <span>{messages.assets.targetSize}</span>
        <strong>{asset.targetSize ?? "-"}</strong>
        <span>{messages.assets.approval}</span>
        <strong>{asset.approvalStatus ?? "-"}</strong>
      </div>
      {asset.error && <p className="asset-error">{asset.error}</p>}
    </aside>
  );
}

function prioritizeAssets(assets: AssetRequirement[]): AssetRequirement[] {
  return [...assets].sort((left, right) => {
    const leftRank = assetPriority(left.assetKey);
    const rightRank = assetPriority(right.assetKey);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.assetKey.localeCompare(right.assetKey);
  });
}

function assetPriority(assetKey: string): number {
  if (assetKey === "player.ship" || assetKey.startsWith("player.")) return 0;
  if (assetKey === "world.background" || assetKey.startsWith("world.")) return 1;
  if (assetKey === "cover.main") return 2;
  if (assetKey.startsWith("item.")) return 3;
  if (assetKey.startsWith("hazard.")) return 4;
  return 10;
}

function isPrimaryAssetKey(assetKey: string): boolean {
  return (
    assetKey === "player.ship" ||
    assetKey === "world.background" ||
    assetKey === "cover.main" ||
    assetKey === "item.collectible" ||
    assetKey.startsWith("hazard.")
  );
}

function CodeWorkspace({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  return (
    <div className="code-workspace">
      <section className="code-panel">
        <h3>{messages.code.artifacts}</h3>
        <div className="artifact-grid">
          {project.artifacts.map((artifact) => (
            <ArtifactCard key={artifact.fileName} artifact={artifact} />
          ))}
        </div>
      </section>
      <section className="code-panel">
        <h3>{messages.code.gameConfig}</h3>
        <pre>{JSON.stringify(project.gameConfig, null, 2)}</pre>
      </section>
    </div>
  );
}

function AssetTile({
  asset,
  audioLabel,
  selected,
  onSelect,
  onRegenerate,
  onReplaceFromLibrary,
  onUpload
}: {
  asset: AssetRequirement;
  audioLabel: string;
  selected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onReplaceFromLibrary: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <article className={selected ? "asset-tile selected" : "asset-tile"} onClick={onSelect}>
      <input className="asset-check" type="checkbox" checked={selected} readOnly aria-label={asset.assetKey} />
      <div className={`asset-thumb ${asset.type}`}>
        {asset.type === "sfx" || asset.type === "bgm" ? (
          <span>{audioLabel}</span>
        ) : asset.fileUrl && asset.fileUrl.startsWith("data:image") ? (
          <img src={asset.fileUrl} alt="" />
        ) : (
          <Database size={22} />
        )}
      </div>
      <strong>{asset.assetKey}</strong>
      <span>{asset.type} / {asset.status}</span>
      <div className="asset-source-row">
        <small>{asset.source}</small>
        <small>{asset.provider}</small>
      </div>
      <div className="asset-tile-actions">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRegenerate();
          }}
        >
          <RefreshCcw size={14} />
        </button>
        {(asset.type === "image" || asset.type === "ui") && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onReplaceFromLibrary();
            }}
          >
            <Library size={14} />
          </button>
        )}
        <label onClick={(event) => event.stopPropagation()}>
          <Upload size={14} />
          <input
            type="file"
            accept={asset.acceptedFileTypes.join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
    </article>
  );
}

function ArtifactCard({ artifact }: { artifact: PipelineArtifact }) {
  return (
    <article className="artifact-card">
      <div>
        <span>{artifact.stage}</span>
        <strong>{artifact.fileName}</strong>
      </div>
      <code>{artifact.format}</code>
    </article>
  );
}

function LogLine({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="log-line">
      <CheckCircle2 size={16} className={ok ? "ok" : ""} />
      <span>{label}</span>
      <code>{detail}</code>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <div className="score-bar">
        <div style={{ width: `${value}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
