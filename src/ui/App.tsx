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
  createStartGameDraft,
  templateOptions,
  type StartGameDraft
} from "../core/start";
import type {
  AssetRequirement,
  ConversationSession,
  MockProject,
  PipelineArtifact,
  TemplateFamily
} from "../core/types";
import { getMessages, type Locale } from "./i18n";
import { buildIdeaDialogModel } from "./ideaDialogModel";
import { PhaserPreview } from "./PhaserPreview";
import {
  buildGenerationIdea,
  buildStudioChatMessages,
  type StudioChatMessage,
  type StudioFollowup
} from "./studioChat";
import { createMediaGateway } from "../services/mediaGateway";
import {
  requestPlayableGeneration,
  requestGuidedQuestions,
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
type CreationPhase = "chatting" | "ready_to_generate" | "revision" | "cooking" | "ready" | "failed";
type AppPage = "create" | "play" | "projects" | "idea_dialog" | "studio";
type GenerationResult = Awaited<ReturnType<ReturnType<typeof createGenerationService>["generatePlayableVersion"]>>;
type GuidedQuestionStatus = "idle" | "loading" | "ready" | "fallback";
type GenerationNoticeTone = "working" | "success" | "fallback" | "error";

interface GenerationNotice {
  tone: GenerationNoticeTone;
  title: string;
  detail: string;
}

interface ProjectRecord {
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

function addFollowup(current: StudioFollowup[], content: string): StudioFollowup[] {
  const trimmed = content.trim();
  if (!trimmed) return current;
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
  const [shareOpen, setShareOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fallbackProject = useMemo(() => runMockPipeline(idea), [idea]);
  const project = generatedProject ?? fallbackProject;
  const playRoute = getPlayRoute();
  const hasAnsweredGuidedQuestions = session.answers.length >= session.questions.length;
  const canGeneratePlayable =
    hasAnsweredGuidedQuestions &&
    (creationPhase === "ready_to_generate" || creationPhase === "revision" || creationPhase === "ready");

  const submitFollowup = () => {
    if (!revisionText.trim()) return;
    const nextQuestion = session.questions.find(
      (question) => !session.answers.some((answer) => answer.questionId === question.id)
    );
    if (nextQuestion) {
      setSession(answerDesignQuestion(session, nextQuestion.id, revisionText.trim()));
      setRevisionText("");
      window.requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth"
        });
      });
      return;
    }
    const nextFollowups = addFollowup(followups, revisionText);
    setFollowups(nextFollowups);
    const nextIdea = buildGenerationIdea(idea, nextFollowups);
    setIdea(nextIdea);
    setSession((current) => ({
      ...current,
      idea: nextIdea,
      turns: [
        ...current.turns,
        {
          id: `user-followup-${Date.now()}`,
          role: "user",
          stage: current.stage,
          content: revisionText.trim(),
          createdAt: new Date().toISOString()
        }
      ]
    }));
    setRevisionText("");
    setGeneratedProject(null);
    setGenerationResult(null);
    setGenerationNotice(null);
    setCreationPhase("revision");
    window.requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    });
  };

  useEffect(() => {
    if (
      (page !== "studio" && page !== "idea_dialog") ||
      creationPhase !== "chatting" ||
      !hasAnsweredGuidedQuestions
    ) {
      return;
    }
    setCreationPhase("ready_to_generate");
  }, [creationPhase, hasAnsweredGuidedQuestions, page]);

  const startResourceGeneration = async () => {
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
        model: "deepseek-v4-flash"
      })) as GenerationResult;
      setGenerationResult(result);
      setGeneratedProject(result.project);
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
      const fallback = await createGenerationService().generatePlayableVersion({
        idea: generationIdea,
        answers: session.answers,
        templateFamily: activeDraft.templateFamily,
        projectId: "project-local-fallback",
        baseUrl: getBrowserBaseUrl(),
        model: "mock-designer"
      });
      setGenerationResult(fallback);
      setGeneratedProject(fallback.project);
      setCreationPhase("ready");
      setActiveTab("preview");
      setGenerationNotice({
        tone: "error",
        title: t.notices.errorTitle,
        detail: `${readGenerationError(error)}${t.notices.errorDetailSuffix}`
      });
      window.setTimeout(() => setGenerationNotice(null), 5200);
      playGenerationSuccessTone();
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
    try {
      const result = await requestGuidedQuestions({
        idea: nextIdea,
        templateFamily,
        model,
        projectId: `project-${Date.now()}`
      });
      setSession((current) => {
        if (current.idea !== nextIdea || current.answers.length > 0) return current;
        return createConversationSession(nextIdea, {
          preferredTemplate: templateFamily,
          questions: result.questions
        });
      });
      setGuidedQuestionStatus(result.fallbackUsed ? "fallback" : "ready");
    } catch {
      setGuidedQuestionStatus("fallback");
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
        onEdit={(record) => openStudio(record.idea, record.templateFamily, record.project)}
        onRun={(record) =>
          record.editable
            ? openStudio(record.idea, record.templateFamily, record.project)
            : openProjectPlay(record)
        }
        onDuplicate={(record) => {
          if (!record.editable) return;
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
        onCreate={() => {
          const nextIdea = startDraft.idea.trim() || t.prompt.defaultIdea;
          openIdeaDialog(nextIdea, startDraft.templateFamily);
        }}
        onUploadPackage={async (file) => {
          const payload = await uploadPlayablePackage({
            packageName: file.name.replace(/\.zip$/i, ""),
            packageFileName: file.name,
            packageEntry: "index.html",
            description: `上传包：${file.name}`
          });
          addUploadedPackage(payload.project as MockProject);
          setUploadedPackageMessage(`${file.name}${t.notices.uploadedPackageSuffix}`);
          setPage("projects");
        }}
      />
    );
  }

  if (page === "idea_dialog") {
    return (
      <IdeaDialogPage
        session={session}
        statusLabel={readGuidedQuestionStatus(guidedQuestionStatus, t.ideaDialog)}
        messages={t}
        draft={activeDraft}
        revisionText={revisionText}
        canGenerate={canGeneratePlayable}
        isGenerating={creationPhase === "cooking"}
        onRevisionTextChange={setRevisionText}
        onAnswer={answerCurrentDialogQuestion}
        onGenerate={startResourceGeneration}
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
                session
              })}
            />
          </div>
          <PromptDock
            messages={t}
            revisionText={revisionText}
            modelStatusLabel={readGuidedQuestionStatus(guidedQuestionStatus, t.ideaDialog)}
            canGenerate={canGeneratePlayable}
            isGenerating={creationPhase === "cooking"}
            onGenerate={startResourceGeneration}
            onIdeaChange={setRevisionText}
            onSubmitRevision={submitFollowup}
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
              <PreviewWorkspace project={generatedProject} messages={t} phase={creationPhase} notice={generationNotice} />
            )}
            {activeTab === "assets" && (
              <AssetWorkspace key={`${project.id}-${project.version.id}`} project={project} messages={t} />
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

function StartPage({
  draft,
  locale,
  onLocaleToggle,
  onDraftChange,
  onPlay,
  onProjects,
  onCreate,
  onUploadPackage,
  uploadMessage
}: {
  draft: StartGameDraft;
  locale: Locale;
  onLocaleToggle: () => void;
  onDraftChange: (draft: StartGameDraft) => void;
  onPlay: () => void;
  onProjects: () => void;
  onCreate: () => void;
  onUploadPackage: (file: File) => Promise<void>;
  uploadMessage: string;
}) {
  const canCreate = draft.idea.trim().length > 0;
  const t = getMessages(locale);
  const updateDraft = (patch: Partial<StartGameDraft>) => onDraftChange({ ...draft, ...patch });

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
            {t.start.subtitlePrefix} <button>{t.start.subtitleAction}</button>
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

          <div className="template-picker">
            {templateOptions.map((template) => (
              <button
                key={template.id}
                className={draft.templateFamily === template.id ? "template-chip active" : "template-chip"}
                onClick={() => updateDraft({ templateFamily: template.id as TemplateFamily })}
              >
                <strong>{template.label}</strong>
                <span>{template.description}</span>
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
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    updateDraft({
                      uploadedFileNames: files.map((file) => file.name)
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
                {draft.uploadedFileNames.slice(0, 3).map((fileName) => (
                  <span key={fileName}>{fileName}</span>
                ))}
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
  isGenerating,
  onRevisionTextChange,
  onAnswer,
  onGenerate,
  onClose
}: {
  session: ConversationSession;
  statusLabel: string;
  messages: ReturnType<typeof getMessages>;
  draft: StartGameDraft;
  revisionText: string;
  canGenerate: boolean;
  isGenerating: boolean;
  onRevisionTextChange: (value: string) => void;
  onAnswer: (value: string) => void;
  onGenerate: () => void;
  onClose: () => void;
}) {
  const dialog = buildIdeaDialogModel(session);
  const currentQuestion = dialog.currentQuestion;
  const answerValue = revisionText.trim() || currentQuestion?.defaultAnswer || "";
  const progressText = `${dialog.answeredCount}/${dialog.totalQuestions}`;

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
                  if (canGenerate) onGenerate();
                  else submitAnswer();
                }
              }}
              placeholder={
                canGenerate
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
                className={canGenerate ? "idea-send-button generate" : "idea-send-button"}
                disabled={isGenerating || (!canGenerate && !currentQuestion)}
                onClick={canGenerate ? onGenerate : submitAnswer}
              >
                {isGenerating ? <RefreshCcw size={18} /> : canGenerate ? <Wand2 size={18} /> : <Send size={18} />}
                <span>{canGenerate ? messages.ideaDialog.generate : messages.ideaDialog.send}</span>
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
  const [record, setRecord] = useState<{ project: MockProject; publishRecord: { publicUrl: string } } | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    let active = true;
    requestPlayableProject(projectId, versionId)
      .then((payload) => {
        if (active) setRecord(payload as { project: MockProject; publishRecord: { publicUrl: string } });
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
          <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} />
        </div>
        <aside className="play-detail-side">
          <h2>{messages.playDetail.goal}</h2>
          <p>{project.gameConfig.playerGoal}</p>
          <h2>{messages.playDetail.controls}</h2>
          <p>{project.gameConfig.controls.join(" / ")}</p>
          <h2>{messages.playDetail.shareLink}</h2>
          <code>{record.publishRecord.publicUrl}</code>
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

function StudioChatFlow({ messages }: { messages: StudioChatMessage[] }) {
  return (
    <div className="studio-chat-flow" aria-label="AI 创作对话">
      {messages.map((message) => (
        <article key={message.id} className={`studio-chat-message ${message.role}`}>
          <span>{message.meta}</span>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}

function PromptDock({
  messages,
  revisionText,
  modelStatusLabel,
  canGenerate,
  isGenerating,
  onGenerate,
  onIdeaChange,
  onSubmitRevision
}: {
  messages: ReturnType<typeof getMessages>;
  revisionText: string;
  modelStatusLabel: string;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onIdeaChange: (idea: string) => void;
  onSubmitRevision: () => void;
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
          <ImageIcon size={16} />
          <Wand2 size={16} />
          <RefreshCcw size={16} />
        </div>
        <button className="dock-action" onClick={onSubmitRevision} disabled={!revisionText.trim()}>
          {messages.prompt.sendFollowup}
        </button>
        <button
          className={isGenerating ? "send-button generating" : "send-button"}
          title={messages.prompt.generateNext}
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isGenerating ? <RefreshCcw size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

function PreviewWorkspace({
  project,
  messages,
  phase,
  notice
}: {
  project: MockProject | null;
  messages: ReturnType<typeof getMessages>;
  phase: CreationPhase;
  notice: GenerationNotice | null;
}) {
  const isCooking = phase === "cooking";
  const isPlayableReady = phase === "ready" && project;
  return (
    <div className="preview-workspace">
      {isCooking ? (
        <div className="cooking-state" role="status" aria-live="polite">
          <div className="cooking-orbit">
            <span />
            <span />
            <span />
          </div>
          <p>{messages.preview.cookingEyebrow}</p>
          <h2>{messages.preview.cookingTitle}</h2>
          <strong>{messages.preview.cookingSubtitle}</strong>
          <small>{messages.preview.cookingDetail}</small>
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
      {!isCooking && !isPlayableReady && (
        <div className="preview-empty-state">
          <div className="preview-empty-icon">
            <Gamepad2 size={30} />
          </div>
          <p>{messages.preview.waitingEyebrow}</p>
          <h2>{messages.preview.waitingTitle}</h2>
          <span>{messages.preview.waitingDetail}</span>
        </div>
      )}
      {!isCooking && isPlayableReady && (
        <>
          <div className="preview-canvas-shell">
            <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} />
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

function AssetWorkspace({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  const [assets, setAssets] = useState<AssetRequirement[]>(project.assetPack.assets);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(project.assetPack.assets[0]?.assetKey ?? "");
  const mediaGateway = useMemo(() => createMediaGateway(), []);
  const readyCount = assets.filter((asset) => asset.status !== "missing" && asset.status !== "failed").length;
  const selectedAsset = assets.find((asset) => asset.assetKey === selectedKey) ?? assets[0];
  const visibleAssets = assets.filter((asset) => {
    const text = `${asset.assetKey} ${asset.type} ${asset.purpose} ${asset.status}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const updateAsset = (nextAsset: AssetRequirement) => {
    setAssets((current) =>
      current.map((asset) => (asset.assetKey === nextAsset.assetKey ? nextAsset : asset))
    );
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
      </div>

      <div className="asset-browser-summary">
        <strong>{readyCount}/{assets.length} {messages.assets.ready}</strong>
        <span>asset-pack.json / project {project.id} / version {project.version.id}</span>
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
              onUpload={(file) => uploadAsset(asset, file)}
            />
          ))}
        </div>
        {selectedAsset && <AssetInspector asset={selectedAsset} messages={messages} />}
      </div>
    </div>
  );
}

function AssetInspector({ asset, messages }: { asset: AssetRequirement; messages: ReturnType<typeof getMessages> }) {
  return (
    <aside className="asset-inspector">
      <div className="asset-inspector-preview">
        {asset.type === "sfx" || asset.type === "bgm" ? (
          <div className="audio-preview">{messages.assets.audio}</div>
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
      </div>
      {asset.error && <p className="asset-error">{asset.error}</p>}
    </aside>
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
  onUpload
}: {
  asset: AssetRequirement;
  audioLabel: string;
  selected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <article className={selected ? "asset-tile selected" : "asset-tile"} onClick={onSelect}>
      <input className="asset-check" type="checkbox" checked={selected} readOnly aria-label={asset.assetKey} />
      <div className={`asset-thumb ${asset.type}`}>
        {asset.type === "sfx" || asset.type === "bgm" ? <span>{audioLabel}</span> : <Database size={22} />}
      </div>
      <strong>{asset.assetKey}</strong>
      <span>{asset.type} / {asset.status}</span>
      <div className="asset-tile-actions">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRegenerate();
          }}
        >
          <RefreshCcw size={14} />
        </button>
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
