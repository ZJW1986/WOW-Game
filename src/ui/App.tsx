import {
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Gamepad2,
  GitBranch,
  Library,
  Play,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import { runMockPipeline } from "../core/pipeline";
import type { MockProject, PipelineArtifact } from "../core/types";
import { PhaserPreview } from "./PhaserPreview";

const defaultIdea = "做一个太空船躲避陨石并收集星星的小游戏";

const navigation = [
  { id: "studio", label: "Studio", icon: BrainCircuit },
  { id: "pipeline", label: "Pipeline", icon: ClipboardList },
  { id: "assets", label: "Assets", icon: Library },
  { id: "preview", label: "Preview", icon: Gamepad2 },
  { id: "play", label: "Play", icon: Play },
  { id: "iterate", label: "Iterate", icon: GitBranch }
] as const;

type TabId = (typeof navigation)[number]["id"];

export function App() {
  const [idea, setIdea] = useState(defaultIdea);
  const [activeTab, setActiveTab] = useState<TabId>("studio");
  const project = useMemo(() => runMockPipeline(idea), [idea]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>GameForge</h1>
            <p>OpenGame-style MVP</p>
          </div>
        </div>
        <nav className="nav-list" aria-label="Product modules">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeTab === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="model-card">
          <Sparkles size={18} />
          <div>
            <strong>Mock Provider</strong>
            <span>LLM / image / audio / VFX adapters ready</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Phase 1 Closed Loop</p>
            <h2>{project.title}</h2>
          </div>
          <div className="status-pill">
            <CheckCircle2 size={16} />
            {project.version.status}
          </div>
        </header>

        {activeTab === "studio" && (
          <StudioPanel idea={idea} project={project} onIdeaChange={setIdea} />
        )}
        {activeTab === "pipeline" && <PipelinePanel project={project} />}
        {activeTab === "assets" && <AssetPanel project={project} />}
        {activeTab === "preview" && <PreviewPanel project={project} />}
        {activeTab === "play" && <PlayPanel project={project} />}
        {activeTab === "iterate" && <IterationPanel project={project} />}
      </section>
    </main>
  );
}

function StudioPanel({
  idea,
  project,
  onIdeaChange
}: {
  idea: string;
  project: MockProject;
  onIdeaChange: (idea: string) => void;
}) {
  return (
    <div className="panel-grid two">
      <section className="surface">
        <div className="section-title">
          <BrainCircuit size={18} />
          <h3>Studio</h3>
        </div>
        <textarea
          value={idea}
          onChange={(event) => onIdeaChange(event.target.value)}
          aria-label="Game idea"
          className="idea-input"
        />
        <div className="question-list">
          <PromptQuestion label="操作方式" value={project.gameConfig.controls.join(" / ")} />
          <PromptQuestion label="失败条件" value="撞到危险物或时间耗尽" />
          <PromptQuestion label="视觉风格" value="明亮 2D 街机，占位资源可替换" />
          <PromptQuestion label="目标时长" value="单局 60-90 秒" />
        </div>
      </section>

      <section className="surface">
        <div className="section-title">
          <Boxes size={18} />
          <h3>Physics-First Classification</h3>
        </div>
        <div className="classification-card">
          <span>Template</span>
          <strong>{project.classification.templateFamily}</strong>
        </div>
        <ul className="compact-list">
          {project.classification.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="risk-box">
          {project.classification.risks.map((risk) => (
            <span key={risk}>{risk}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function PipelinePanel({ project }: { project: MockProject }) {
  return (
    <section className="surface full">
      <div className="section-title">
        <ClipboardList size={18} />
        <h3>Pipeline Console</h3>
      </div>
      <div className="artifact-grid">
        {project.artifacts.map((artifact) => (
          <ArtifactCard key={artifact.fileName} artifact={artifact} />
        ))}
      </div>
    </section>
  );
}

function AssetPanel({ project }: { project: MockProject }) {
  return (
    <section className="surface full">
      <div className="section-title">
        <Library size={18} />
        <h3>Asset Hub</h3>
      </div>
      <div className="asset-table">
        <div className="asset-row header">
          <span>Key</span>
          <span>Type</span>
          <span>Mode</span>
          <span>Purpose</span>
        </div>
        {project.assetPack.assets.map((asset) => (
          <div className="asset-row" key={asset.assetKey}>
            <strong>{asset.assetKey}</strong>
            <span>{asset.type}</span>
            <span>{asset.generationMode}</span>
            <span>{asset.purpose}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewPanel({ project }: { project: MockProject }) {
  return (
    <div className="panel-grid two preview-layout">
      <section className="surface">
        <div className="section-title">
          <Gamepad2 size={18} />
          <h3>Playable Build</h3>
        </div>
        <PhaserPreview config={project.gameConfig} />
      </section>
      <section className="surface">
        <div className="section-title">
          <CheckCircle2 size={18} />
          <h3>Verification</h3>
        </div>
        <Score label="Build Health" value={project.qaReport.scores.buildHealth} />
        <Score label="Visual Usability" value={project.qaReport.scores.visualUsability} />
        <Score label="Intent Alignment" value={project.qaReport.scores.intentAlignment} />
        <ul className="compact-list">
          {project.qaReport.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlayPanel({ project }: { project: MockProject }) {
  return (
    <div className="play-page">
      <section className="play-hero">
        <div>
          <p className="eyebrow">Published Game</p>
          <h3>{project.title}</h3>
          <p>{project.gameConfig.playerGoal}</p>
        </div>
        <button className="primary-button">
          <Play size={18} />
          Play v1
        </button>
      </section>
      <section className="surface">
        <div className="section-title">
          <Gamepad2 size={18} />
          <h3>Player Experience</h3>
        </div>
        <PhaserPreview config={project.gameConfig} compact />
        <div className="feedback-strip">
          <span>Rating: {project.feedback.rating}/5</span>
          <span>{project.feedback.comment}</span>
        </div>
      </section>
    </div>
  );
}

function IterationPanel({ project }: { project: MockProject }) {
  return (
    <section className="surface full">
      <div className="section-title">
        <RotateCcw size={18} />
        <h3>Iteration Center</h3>
      </div>
      <div className="iteration-card">
        <strong>Next Version Suggestion</strong>
        <p>{project.feedback.iterationSuggestion}</p>
      </div>
      <div className="debug-log">
        {project.qaReport.debugProtocolEntries.map((entry) => (
          <span key={entry}>{entry}</span>
        ))}
      </div>
    </section>
  );
}

function PromptQuestion({ label, value }: { label: string; value: string }) {
  return (
    <div className="prompt-question">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
