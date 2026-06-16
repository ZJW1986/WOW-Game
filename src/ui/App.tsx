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
  Plus,
  RefreshCcw,
  Search,
  Send,
  Share2,
  Upload,
  Wand2,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  answerDesignQuestion,
  createConversationSession,
  getNextConversationAction
} from "../core/conversation";
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
  modelOptions,
  templateOptions,
  type StartGameDraft,
  type StartModelId
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

const rightTabs = [
  { id: "preview", labelKey: "preview", icon: Gamepad2 },
  { id: "assets", labelKey: "assets", icon: Library },
  { id: "code", labelKey: "code", icon: Code2 }
] as const;

type RightTab = (typeof rightTabs)[number]["id"];

export function App() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const t = getMessages(locale);
  const [idea, setIdea] = useState<string>(t.prompt.defaultIdea);
  const [startDraft, setStartDraft] = useState<StartGameDraft>(() =>
    createStartGameDraft({ idea: t.prompt.defaultIdea })
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [homeMode, setHomeMode] = useState<"create" | "play">("create");
  const [session, setSession] = useState<ConversationSession>(() =>
    createConversationSession(t.prompt.defaultIdea)
  );
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const project = useMemo(() => runMockPipeline(idea), [idea]);

  if (!hasStarted) {
    if (homeMode === "play") {
      return <PlayPage onCreate={() => setHomeMode("create")} onPlayGame={() => setHasStarted(true)} />;
    }

    return (
      <StartPage
        draft={startDraft}
        locale={locale}
        onLocaleToggle={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
        onDraftChange={setStartDraft}
        onPlay={() => setHomeMode("play")}
        onCreate={() => {
          const nextIdea = startDraft.idea.trim() || t.prompt.defaultIdea;
          setIdea(nextIdea);
          setSession(
            createConversationSession(nextIdea, {
              preferredTemplate: startDraft.templateFamily
            })
          );
          setHasStarted(true);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="chrome-bar">
        <div className="project-switcher">
          <div className="brand-mark">W</div>
          <button className="project-menu" title={t.brand.projectTitle}>
            <span>{project.title}</span>
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="chrome-actions">
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
          <button className="share-button">
            <Share2 size={16} />
            {t.brand.share}
          </button>
          <div className="user-orb">Z</div>
        </div>
      </header>

      <section className="creator-shell">
        <aside className="agent-panel">
          <AgentHeader project={project} messages={t} />
          <div className="agent-scroll">
            <AgentIntro project={project} messages={t} />
            <UserPrompt text={idea} />
            <ConversationPanel session={session} onSessionChange={setSession} />
            <AgentBuildLog project={project} messages={t} />
            <SuggestionCard messages={t} />
          </div>
          <PromptDock
            idea={idea}
            messages={t}
            onIdeaChange={(nextIdea) => {
              setIdea(nextIdea);
              setSession(createConversationSession(nextIdea));
            }}
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
            {activeTab === "assets" && <AssetWorkspace project={project} messages={t} />}
            {activeTab === "code" && <CodeWorkspace project={project} messages={t} />}
          </div>
        </section>
      </section>
    </main>
  );
}

function StartPage({
  draft,
  locale,
  onLocaleToggle,
  onDraftChange,
  onPlay,
  onCreate
}: {
  draft: StartGameDraft;
  locale: Locale;
  onLocaleToggle: () => void;
  onDraftChange: (draft: StartGameDraft) => void;
  onPlay: () => void;
  onCreate: () => void;
}) {
  const canCreate = draft.idea.trim().length > 0;
  const updateDraft = (patch: Partial<StartGameDraft>) => onDraftChange({ ...draft, ...patch });

  return (
    <main className="start-shell">
      <header className="start-nav">
        <div className="start-brand">
          <div className="brand-mark">W</div>
          <strong>WOW Game</strong>
        </div>
        <nav className="start-mode-tabs" aria-label="Create or play">
          <button className="active">
            <Plus size={15} />
            CREATE
          </button>
          <button onClick={onPlay}>
            <Gamepad2 size={15} />
            PLAY
          </button>
        </nav>
        <div className="start-actions">
          <button className="ghost-button">
            <Zap size={15} />
            UPGRADE
          </button>
          <button className="ghost-button">
            <Wand2 size={15} />
            MY PROJECTS
          </button>
          <button className="locale-button" onClick={onLocaleToggle}>
            {locale === "zh-CN" ? "中文" : "EN"}
          </button>
        </div>
      </header>

      <section className="start-stage">
        <div className="start-copy">
          <h1>Create from Scratch</h1>
          <p>
            Describe your game below, or <button>pick a template</button>
          </p>
        </div>

        <section className="create-dialog" aria-label="Create new game">
          <textarea
            maxLength={500}
            value={draft.idea}
            onChange={(event) => updateDraft({ idea: event.target.value })}
            placeholder="Tell us what game you want to make..."
          />

          <div className="create-dialog-row">
            <label className="field-label">
              Model
              <select
                value={draft.model}
                onChange={(event) => updateDraft({ model: event.target.value as StartModelId })}
              >
                {modelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
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
              UPLOAD FILE
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
              Create
              <Send size={17} />
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function PlayPage({
  onCreate,
  onPlayGame
}: {
  onCreate: () => void;
  onPlayGame: (game: PlayGame) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<PlayCategory>("All");
  const games = activeCategory === "All" ? getFeaturedGames() : getGamesByCategory(activeCategory).slice(0, 12);

  return (
    <main className="play-shell">
      <header className="play-nav">
        <div className="start-brand">
          <div className="brand-mark">W</div>
          <strong>WOW Game</strong>
        </div>
        <nav className="start-mode-tabs" aria-label="Create or play">
          <button onClick={onCreate}>
            <Plus size={15} />
            CREATE
          </button>
          <button className="active">
            <Gamepad2 size={15} />
            PLAY
          </button>
        </nav>
        <div className="play-actions">
          <button className="ghost-button">
            <Zap size={15} />
            UPGRADE
          </button>
          <button className="play-icon-button" title="Search">
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
          title={activeCategory === "All" ? "Featured games" : `${activeCategory} games`}
          games={games}
          onPlayGame={onPlayGame}
          compact
        />
        <GameMosaic title="Popular games" games={getPopularGames()} onPlayGame={onPlayGame} />
        <GameSection title="Casual Games" games={getGamesByCategory("Casual").slice(0, 8)} onPlayGame={onPlayGame} />
        <GameSection title="Advanced Games" games={getGamesByCategory("Advanced").slice(0, 8)} onPlayGame={onPlayGame} />
      </section>
    </main>
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
        {!compact && <button>View more</button>}
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
        <span>{formatCount(game.plays)} plays · {game.likes} likes</span>
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

function ConversationPanel({
  session,
  onSessionChange
}: {
  session: ConversationSession;
  onSessionChange: (session: ConversationSession) => void;
}) {
  const action = getNextConversationAction(session);
  return (
    <article className="chat-card conversation-card">
      <p className="thought-line">对话阶段：{session.stage}</p>
      {session.questions.map((question) => {
        const answer = session.answers.find((item) => item.questionId === question.id);
        return (
          <div className="question-card" key={question.id}>
            <div>
              <strong>{question.label}</strong>
              <span>{question.prompt}</span>
            </div>
            <button
              disabled={Boolean(answer)}
              onClick={() =>
                onSessionChange(answerDesignQuestion(session, question.id, question.defaultAnswer))
              }
            >
              {answer ? answer.value : `使用推荐：${question.defaultAnswer}`}
            </button>
          </div>
        );
      })}
      <div className="conversation-action">
        <span>{action.nextLabel}</span>
        <strong>{action.canGenerateArtifact ? "可生成标准产物" : "等待回答"}</strong>
      </div>
    </article>
  );
}

function AgentBuildLog({ project, messages }: { project: MockProject; messages: ReturnType<typeof getMessages> }) {
  const visibleArtifacts = project.artifacts.slice(0, 8);
  return (
    <article className="chat-card log-card">
      <p className="thought-line">{messages.agent.closedLoop}</p>
      <LogLine ok label={messages.agent.gdd} detail="/gdd.json" />
      <LogLine ok label={messages.agent.classified} detail={project.classification.templateFamily} />
      <LogLine ok label={`${messages.agent.generatedAssets} ${project.assetPack.assets.length}`} detail="/asset-pack.json" />
      <LogLine ok label={messages.agent.runtime} detail="build health 92" />
      <div className="artifact-stack">
        {visibleArtifacts.map((artifact) => (
          <span key={artifact.fileName}>{artifact.fileName}</span>
        ))}
      </div>
    </article>
  );
}

function SuggestionCard({ messages }: { messages: ReturnType<typeof getMessages> }) {
  return (
    <article className="chat-card suggestion-card">
      <p>{messages.agent.suggestionLabel}</p>
      <strong>"{messages.agent.suggestion}"</strong>
      <button>
        {messages.agent.continue}
        <Send size={16} />
      </button>
    </article>
  );
}

function PromptDock({
  idea,
  messages,
  onIdeaChange
}: {
  idea: string;
  messages: ReturnType<typeof getMessages>;
  onIdeaChange: (idea: string) => void;
}) {
  return (
    <div className="prompt-dock">
      <textarea
        value={idea}
        onChange={(event) => onIdeaChange(event.target.value)}
        aria-label={messages.prompt.aria}
        placeholder={messages.prompt.placeholder}
      />
      <div className="prompt-tools">
        <button className="model-select">
          deepseek-v4-flash
          <ChevronDown size={14} />
        </button>
        <div className="tool-icons">
          <ImageIcon size={16} />
          <Wand2 size={16} />
          <RefreshCcw size={16} />
        </div>
        <button className="send-button" title={messages.agent.continue}>
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
        <PhaserPreview config={project.gameConfig} />
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
  return (
    <div className="asset-workspace">
      <AssetPreview asset={project.assetPack.assets[0]} messages={messages} />
      <div className="asset-grid">
        {project.assetPack.assets.map((asset) => (
          <AssetTile key={asset.assetKey} asset={asset} />
        ))}
      </div>
    </div>
  );
}

function AssetPreview({ asset, messages }: { asset: AssetRequirement; messages: ReturnType<typeof getMessages> }) {
  return (
    <section className="asset-preview">
      <div className="generated-image">
        <span>{asset.type}</span>
      </div>
      <div className="asset-meta">
        <h3>{messages.assets.generatedAsset}: {asset.assetKey}</h3>
        <label>{messages.assets.prompt}</label>
        <p>{asset.style}</p>
        <label>{messages.assets.description}</label>
        <p>{asset.spec}</p>
        <div className="meta-table">
          <span>{messages.assets.mode}</span>
          <strong>{asset.generationMode}</strong>
          <span>{messages.assets.copyright}</span>
          <strong>{asset.copyrightStatus}</strong>
        </div>
      </div>
    </section>
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

function AssetTile({ asset }: { asset: AssetRequirement }) {
  return (
    <article className="asset-tile">
      <div className="asset-thumb">
        <Database size={18} />
      </div>
      <strong>{asset.assetKey}</strong>
      <span>{asset.type} / {asset.generationMode}</span>
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
