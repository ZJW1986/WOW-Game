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
import { PhaserPreview } from "./PhaserPreview";

const defaultIdea = "Create a neon spaceship dodge game where the player avoids asteroids and collects stars.";

const rightTabs = [
  { id: "preview", label: "Preview", icon: Gamepad2 },
  { id: "assets", label: "Assets", icon: Library },
  { id: "code", label: "Code", icon: Code2 }
] as const;

type RightTab = (typeof rightTabs)[number]["id"];

export function App() {
  const [idea, setIdea] = useState(defaultIdea);
  const [activeTab, setActiveTab] = useState<RightTab>("preview");
  const project = useMemo(() => runMockPipeline(idea), [idea]);

  return (
    <main className="app-shell">
      <header className="chrome-bar">
        <div className="project-switcher">
          <div className="brand-mark">W</div>
          <button className="project-menu" title="Current project">
            <span>{project.title}</span>
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="chrome-actions">
          <button className="ghost-button">
            <Zap size={15} />
            Upgrade
          </button>
          <button className="share-button">
            <Share2 size={16} />
            Share
          </button>
          <div className="user-orb">Z</div>
        </div>
      </header>

      <section className="creator-shell">
        <aside className="agent-panel">
          <AgentHeader project={project} />
          <div className="agent-scroll">
            <AgentIntro project={project} />
            <UserPrompt text={idea} />
            <AgentBuildLog project={project} />
            <SuggestionCard />
          </div>
          <PromptDock idea={idea} onIdeaChange={setIdea} />
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
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="stage-toolbar">
            <div className="toolbar-left">
              <button title="Refresh">
                <RefreshCcw size={16} />
              </button>
              <button title="Open runtime console">
                <FileCode2 size={16} />
              </button>
            </div>
            <div className="toolbar-right">
              <span className="live-dot" />
              <button title="Fullscreen">
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div className="stage-content">
            {activeTab === "preview" && <PreviewWorkspace project={project} />}
            {activeTab === "assets" && <AssetWorkspace project={project} />}
            {activeTab === "code" && <CodeWorkspace project={project} />}
          </div>
        </section>
      </section>
    </main>
  );
}

function AgentHeader({ project }: { project: MockProject }) {
  return (
    <div className="agent-header">
      <div className="agent-avatar">
        <Bot size={18} />
      </div>
      <div>
        <strong>WOW Game Agent</strong>
        <span>{project.classification.templateFamily} template pipeline</span>
      </div>
    </div>
  );
}

function AgentIntro({ project }: { project: MockProject }) {
  return (
    <article className="chat-card agent-card">
      <p className="thought-line">Mulling it over...</p>
      <h2>{project.title} is ready to play</h2>
      <p>
        I classified the idea with a physics-first pass, generated standard artifacts, attached a
        mock asset pack, and assembled a Phaser playable build.
      </p>
      <div className="quick-actions">
        <span>Make hazards more dramatic</span>
        <span>Add checkpoints between sections</span>
        <span>Give every pickup a brighter cue</span>
      </div>
    </article>
  );
}

function UserPrompt({ text }: { text: string }) {
  return <div className="user-prompt">{text}</div>;
}

function AgentBuildLog({ project }: { project: MockProject }) {
  const visibleArtifacts = project.artifacts.slice(0, 8);
  return (
    <article className="chat-card log-card">
      <p className="thought-line">Created the first closed loop...</p>
      <LogLine ok label="Generated standard GDD" detail="/gdd.json" />
      <LogLine ok label="Classified template" detail={project.classification.templateFamily} />
      <LogLine ok label={`Generated ${project.assetPack.assets.length} assets`} detail="/asset-pack.json" />
      <LogLine ok label="Runtime check completed" detail="build health 92" />
      <div className="artifact-stack">
        {visibleArtifacts.map((artifact) => (
          <span key={artifact.fileName}>{artifact.fileName}</span>
        ))}
      </div>
    </article>
  );
}

function SuggestionCard() {
  return (
    <article className="chat-card suggestion-card">
      <p>Suggested next step prompt:</p>
      <strong>"Add a second level with stronger neon feedback and one new reward mechanic"</strong>
      <button>
        Continue with next step
        <Send size={16} />
      </button>
    </article>
  );
}

function PromptDock({
  idea,
  onIdeaChange
}: {
  idea: string;
  onIdeaChange: (idea: string) => void;
}) {
  return (
    <div className="prompt-dock">
      <textarea
        value={idea}
        onChange={(event) => onIdeaChange(event.target.value)}
        aria-label="Ask WOW Game Agent"
        placeholder="Ask WOW Game... or drag, drop, or paste an image"
      />
      <div className="prompt-tools">
        <button className="model-select">
          gemini-flash
          <ChevronDown size={14} />
        </button>
        <div className="tool-icons">
          <ImageIcon size={16} />
          <Wand2 size={16} />
          <RefreshCcw size={16} />
        </div>
        <button className="send-button" title="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function PreviewWorkspace({ project }: { project: MockProject }) {
  return (
    <div className="preview-workspace">
      <div className="preview-canvas-shell">
        <PhaserPreview config={project.gameConfig} />
      </div>
      <div className="floating-status">
        <CheckCircle2 size={16} />
        <span>Generated playable v1</span>
      </div>
      <VerificationRail project={project} />
    </div>
  );
}

function VerificationRail({ project }: { project: MockProject }) {
  return (
    <aside className="verification-rail">
      <h3>Verification</h3>
      <Score label="Build" value={project.qaReport.scores.buildHealth} />
      <Score label="Visual" value={project.qaReport.scores.visualUsability} />
      <Score label="Intent" value={project.qaReport.scores.intentAlignment} />
      <div className="protocol-list">
        {project.qaReport.debugProtocolEntries.map((entry) => (
          <span key={entry}>{entry}</span>
        ))}
      </div>
    </aside>
  );
}

function AssetWorkspace({ project }: { project: MockProject }) {
  return (
    <div className="asset-workspace">
      <AssetPreview asset={project.assetPack.assets[0]} />
      <div className="asset-grid">
        {project.assetPack.assets.map((asset) => (
          <AssetTile key={asset.assetKey} asset={asset} />
        ))}
      </div>
    </div>
  );
}

function AssetPreview({ asset }: { asset: AssetRequirement }) {
  return (
    <section className="asset-preview">
      <div className="generated-image">
        <span>{asset.type}</span>
      </div>
      <div className="asset-meta">
        <h3>Generated asset: {asset.assetKey}</h3>
        <label>Prompt</label>
        <p>{asset.style}</p>
        <label>Description</label>
        <p>{asset.spec}</p>
        <div className="meta-table">
          <span>Mode</span>
          <strong>{asset.generationMode}</strong>
          <span>Copyright</span>
          <strong>{asset.copyrightStatus}</strong>
        </div>
      </div>
    </section>
  );
}

function CodeWorkspace({ project }: { project: MockProject }) {
  return (
    <div className="code-workspace">
      <section className="code-panel">
        <h3>Standard Artifacts</h3>
        <div className="artifact-grid">
          {project.artifacts.map((artifact) => (
            <ArtifactCard key={artifact.fileName} artifact={artifact} />
          ))}
        </div>
      </section>
      <section className="code-panel">
        <h3>Game Config</h3>
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
