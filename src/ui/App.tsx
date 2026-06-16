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
  RefreshCcw,
  Send,
  Share2,
  Wand2,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { runMockPipeline } from "../core/pipeline";
import type { AssetRequirement, MockProject, PipelineArtifact } from "../core/types";
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
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const project = useMemo(() => runMockPipeline(idea), [idea]);

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
            <AgentBuildLog project={project} messages={t} />
            <SuggestionCard messages={t} />
          </div>
          <PromptDock idea={idea} messages={t} onIdeaChange={setIdea} />
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
