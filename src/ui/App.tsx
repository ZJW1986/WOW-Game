import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Cpu,
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
  Trash2,
  Upload,
  Wand2,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createConversationSession } from "../core/conversation";
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
  requestPlayableProject,
  submitPlayableFeedback
} from "../services/generationClient";
import { createGenerationService } from "../services/generationService";

const rightTabs = [
  { id: "preview", labelKey: "preview", icon: Gamepad2 },
  { id: "assets", labelKey: "assets", icon: Library },
  { id: "code", labelKey: "code", icon: Code2 }
] as const;

type RightTab = (typeof rightTabs)[number]["id"];
type CreationPhase = "thinking" | "proposal" | "revision" | "generating" | "complete";
type AppPage = "create" | "play" | "projects" | "studio";
type GenerationResult = Awaited<ReturnType<ReturnType<typeof createGenerationService>["generatePlayableVersion"]>>;

interface ProjectRecord {
  id: string;
  title: string;
  idea: string;
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
  const [creationPhase, setCreationPhase] = useState<CreationPhase>("thinking");
  const [revisionText, setRevisionText] = useState("");
  const [followups, setFollowups] = useState<StudioFollowup[]>([]);
  const [generatedProject, setGeneratedProject] = useState<MockProject | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fallbackProject = useMemo(() => runMockPipeline(idea), [idea]);
  const project = generatedProject ?? fallbackProject;
  const playRoute = getPlayRoute();

  const submitFollowup = () => {
    if (!revisionText.trim()) return;
    const nextFollowups = addFollowup(followups, revisionText);
    setFollowups(nextFollowups);
    setSession(createConversationSession(buildGenerationIdea(idea, nextFollowups), {
      preferredTemplate: activeDraft.templateFamily
    }));
    setRevisionText("");
    setGeneratedProject(null);
    setCreationPhase("thinking");
    window.requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    });
  };

  useEffect(() => {
    if (page !== "studio" || creationPhase !== "thinking") return;
    const timer = window.setTimeout(() => setCreationPhase("proposal"), 2600);
    return () => window.clearTimeout(timer);
  }, [creationPhase, page, idea]);

  const startResourceGeneration = async () => {
    setCreationPhase("generating");
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
      setCreationPhase("complete");
      setActiveTab("preview");
    } catch {
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
      setCreationPhase("complete");
      setActiveTab("preview");
    }
  };

  const openStudio = (nextIdea: string, templateFamily?: TemplateFamily, nextProject?: MockProject) => {
    const normalizedIdea = nextIdea.trim() || t.prompt.defaultIdea;
    const nextTemplate = templateFamily ?? startDraft.templateFamily;
    setIdea(normalizedIdea);
    setActiveDraft({ ...startDraft, idea: normalizedIdea, templateFamily: nextTemplate });
    setSession(createConversationSession(normalizedIdea, { preferredTemplate: nextTemplate }));
    setGeneratedProject(nextProject ?? null);
    setGenerationResult(null);
    setRevisionText("");
    setFollowups([]);
    setCreationPhase(nextProject ? "complete" : "thinking");
    setActiveTab("preview");
    setPage("studio");
  };

  if (playRoute) {
    return (
      <PlayableDetailPage
        projectId={playRoute.projectId}
        versionId={playRoute.versionId}
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
        onCreate={() => setPage("create")}
        onProjects={() => setPage("projects")}
        onPlayGame={() => openStudio(idea)}
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
        onRun={(record) => openStudio(record.idea, record.templateFamily, record.project)}
        onDuplicate={(record) =>
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
          ])
        }
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
        onCreate={() => {
          const nextIdea = startDraft.idea.trim() || t.prompt.defaultIdea;
          openStudio(nextIdea, startDraft.templateFamily);
        }}
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
          <ThinkingPipelinePanel
            phase={creationPhase}
            project={project}
            messages={t}
            onApprove={startResourceGeneration}
            onRequestRevision={() => setCreationPhase("revision")}
          />
          <div className="agent-scroll" ref={chatScrollRef}>
            <StudioChatFlow
              messages={buildStudioChatMessages({
                idea,
                followups,
                project,
                messages: t,
                phase: creationPhase
              })}
            />
          </div>
          <PromptDock
            messages={t}
            revisionText={revisionText}
            canGenerate={creationPhase === "proposal" || creationPhase === "complete"}
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
            {activeTab === "preview" && <PreviewWorkspace project={project} messages={t} />}
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
  onCreate
}: {
  draft: StartGameDraft;
  locale: Locale;
  onLocaleToggle: () => void;
  onDraftChange: (draft: StartGameDraft) => void;
  onPlay: () => void;
  onProjects: () => void;
  onCreate: () => void;
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
            <label className="upload-button">
              <Upload size={16} />
              {t.start.upload}
              <input
                multiple
                type="file"
                onChange={(event) =>
                  updateDraft({
                    uploadedFileNames: Array.from(event.target.files ?? []).map((file) => file.name)
                  })
                }
              />
            </label>
            <div className="uploaded-files">
              {draft.uploadedFileNames.slice(0, 2).map((fileName) => (
                <span key={fileName}>{fileName}</span>
              ))}
            </div>
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

function PlayableDetailPage({
  projectId,
  versionId,
  onCreate
}: {
  projectId: string;
  versionId: string;
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
          <h1>游戏未找到</h1>
          <p>这个 Play 链接可能已经失效，或者当前服务没有对应版本。</p>
          <button onClick={onCreate}>创建一个新游戏</button>
        </section>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="play-detail-shell">
        <section className="play-detail-empty">
          <h1>正在加载游戏...</h1>
          <p>正在读取本地发布版本。</p>
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
        <button onClick={onCreate}>Create your game</button>
      </header>
      <section className="play-detail-layout">
        <div className="play-detail-game">
          <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} />
        </div>
        <aside className="play-detail-side">
          <h2>玩法目标</h2>
          <p>{project.gameConfig.playerGoal}</p>
          <h2>操作方式</h2>
          <p>{project.gameConfig.controls.join(" / ")}</p>
          <h2>分享链接</h2>
          <code>{record.publishRecord.publicUrl}</code>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPlayableFeedback(projectId, versionId, {
                rating,
                comment: comment.trim() || "好玩",
                playerName: "guest"
              }).then((payload) => {
                setFeedbackMessage(payload.feedback.iterationSuggestion);
                setComment("");
              });
            }}
          >
            <label>
              评分
              <input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              />
            </label>
            <label>
              反馈
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <button type="submit">提交反馈</button>
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
  onClose
}: {
  project: MockProject;
  publicUrl: string;
  qrPayload: string;
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
        <button className="share-close" onClick={onClose}>Close</button>
        <h2>分享试玩链接</h2>
        <p>{project.title}</p>
        <input readOnly value={publicUrl} />
        <div className="share-actions">
          <button onClick={copyLink}>{copied ? "已复制" : "复制链接"}</button>
          <button onClick={shareNative}>系统分享</button>
        </div>
        <div className="qr-box">
          <span>QR Payload</span>
          <code>{qrPayload}</code>
        </div>
      </section>
    </div>
  );
}

function PlayPage({
  onCreate,
  onProjects,
  onPlayGame
}: {
  onCreate: () => void;
  onProjects: () => void;
  onPlayGame: (game: PlayGame) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<PlayCategory>("All");
  const games = activeCategory === "All" ? getFeaturedGames() : getGamesByCategory(activeCategory).slice(0, 12);
  const t = getMessages("zh-CN");

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
        <GameSection
          title={activeCategory === "All" ? t.play.featured : `${activeCategory} games`}
          games={games}
          onPlayGame={onPlayGame}
          compact
        />
        <GameMosaic title={t.play.popular} games={getPopularGames()} onPlayGame={onPlayGame} />
        <GameSection title={t.play.casual} games={getGamesByCategory("Casual").slice(0, 8)} onPlayGame={onPlayGame} />
        <GameSection title={t.play.advanced} games={getGamesByCategory("Advanced").slice(0, 8)} onPlayGame={onPlayGame} />
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
        </div>
        <strong>{project.templateFamily}</strong>
      </div>
      <div className="project-card-body">
        <h2>{project.title}</h2>
        <p>{project.idea}</p>
        <div className="project-meta">
          <span>{project.updatedAt}</span>
          <span>{formatCount(project.plays)} / {project.likes}</span>
        </div>
        <div className="project-actions">
          <button className="edit-action" onClick={onEdit}>
            <Pencil size={14} />
            {messages.projects.edit}
          </button>
          <button title={messages.projects.duplicate} onClick={onDuplicate}>
            <Copy size={14} />
          </button>
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
  compact = false,
  onPlayGame
}: {
  title: string;
  games: PlayGame[];
  compact?: boolean;
  onPlayGame: (game: PlayGame) => void;
}) {
  return (
    <section className="game-section">
      <div className="section-row">
        <h2>{title}</h2>
        {!compact && <button>查看更多</button>}
      </div>
      <div className={compact ? "game-row compact" : "game-row"}>
        {games.map((game) => (
          <GameCard key={game.id} game={game} onClick={() => onPlayGame(game)} />
        ))}
      </div>
    </section>
  );
}

function GameMosaic({
  title,
  games,
  onPlayGame
}: {
  title: string;
  games: PlayGame[];
  onPlayGame: (game: PlayGame) => void;
}) {
  return (
    <section className="game-section">
      <div className="section-row">
        <h2>{title}</h2>
      </div>
      <div className="game-mosaic">
        {games.map((game) => (
          <GameCard key={game.id} game={game} onClick={() => onPlayGame(game)} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ game, onClick }: { game: PlayGame; onClick: () => void }) {
  return (
    <button className={`game-card ${game.size ?? "normal"}`} onClick={onClick}>
      <div className="game-art" style={{ background: cardBackground(game.palette) }}>
        <span>{game.categories[0]}</span>
        <strong>{game.title}</strong>
      </div>
      <div className="game-card-overlay">
        <strong>{game.title}</strong>
        <span>{formatCount(game.plays)} 游玩 / {game.likes} 喜欢</span>
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

function ThinkingPipelinePanel({
  phase,
  project,
  messages,
  onApprove,
  onRequestRevision
}: {
  phase: CreationPhase;
  project: MockProject;
  messages: ReturnType<typeof getMessages>;
  onApprove: () => void;
  onRequestRevision: () => void;
}) {
  const steps = [
    { label: messages.thinking.steps.idea, detail: messages.thinking.details.idea },
    { label: messages.thinking.steps.physics, detail: project.classification.templateFamily },
    { label: messages.thinking.steps.gdd, detail: messages.thinking.details.gdd },
    { label: messages.thinking.steps.assets, detail: messages.thinking.details.assets },
    { label: messages.thinking.steps.ready, detail: messages.thinking.details.ready }
  ];
  const activeIndex =
    phase === "thinking" ? 3 : phase === "proposal" || phase === "revision" ? 5 : 6;

  return (
    <article className={`chat-card thinking-card ${phase}`}>
      <div className="thinking-card-header">
        <div className="thinking-core">
          <Cpu size={18} />
          <span />
        </div>
        <div>
          <p className="thought-line">{messages.thinking.eyebrow}</p>
          <h3>{messages.thinking.title}</h3>
        </div>
      </div>

      <div className="thinking-stream">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={
              index < activeIndex
                ? "thinking-step complete"
                : index === activeIndex
                  ? "thinking-step active"
                  : "thinking-step"
            }
          >
            <span className="step-node" />
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          </div>
        ))}
      </div>

      {phase === "proposal" && (
        <ProposalSummary
          project={project}
          messages={messages}
          onApprove={onApprove}
          onRequestRevision={onRequestRevision}
        />
      )}
      {phase === "generating" && (
        <div className="resource-pulse">
          <span />
          <div>
            <strong>{messages.thinking.generatingTitle}</strong>
            <small>{messages.thinking.generatingDetail}</small>
          </div>
        </div>
      )}

      {phase === "complete" && (
        <div className="resource-pulse complete">
          <CheckCircle2 size={18} />
          <div>
            <strong>{messages.thinking.completeTitle}</strong>
            <small>{messages.thinking.completeDetail}</small>
          </div>
        </div>
      )}
    </article>
  );
}

function ProposalSummary({
  project,
  messages,
  onApprove,
  onRequestRevision
}: {
  project: MockProject;
  messages: ReturnType<typeof getMessages>;
  onApprove: () => void;
  onRequestRevision: () => void;
}) {
  return (
    <div className="proposal-summary">
      <div className="proposal-grid">
        <span>{messages.thinking.template}</span>
        <strong>{project.classification.templateFamily}</strong>
        <span>{messages.thinking.goal}</span>
        <strong>{project.gameConfig.playerGoal}</strong>
        <span>{messages.thinking.controls}</span>
        <strong>{project.gameConfig.controls.join(" / ")}</strong>
        <span>{messages.thinking.assets}</span>
        <strong>{project.assetPack.assets.length} items</strong>
      </div>
      <p>{project.gameConfig.pitch}</p>
      <div className="proposal-actions">
        <button className="secondary-action" onClick={onRequestRevision}>
          {messages.thinking.addRequirement}
        </button>
        <button className="primary-action" onClick={onApprove}>
          {messages.thinking.approve}
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

function PromptDock({
  messages,
  revisionText,
  canGenerate,
  onGenerate,
  onIdeaChange,
  onSubmitRevision
}: {
  messages: ReturnType<typeof getMessages>;
  revisionText: string;
  canGenerate: boolean;
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
          {messages.prompt.localEngine}
        </button>
        <div className="tool-icons">
          <ImageIcon size={16} />
          <Wand2 size={16} />
          <RefreshCcw size={16} />
        </div>
        <button className="dock-action" onClick={onSubmitRevision} disabled={!revisionText.trim()}>
          {messages.prompt.sendFollowup}
        </button>
        <button className="send-button" title={messages.prompt.generateNext} onClick={onGenerate} disabled={!canGenerate}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function PreviewWorkspace({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  return (
    <div className="preview-workspace">
      <div className="preview-canvas-shell">
        <PhaserPreview config={project.gameConfig} assetPack={project.assetPack} />
      </div>
      <div className="floating-status">
        <CheckCircle2 size={16} />
        <span>{messages.preview.generated}</span>
      </div>
      <VerificationRail project={project} messages={messages} />
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
