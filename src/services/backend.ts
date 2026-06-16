import { runMockPipeline } from "../core/pipeline";
import type { AssetRequirement, MockProject, QaReport } from "../core/types";

export interface StoredProject {
  id: string;
  idea: string;
  createdAt: string;
}

export interface StoredVersion {
  id: string;
  projectId: string;
  artifactFiles: string[];
  status: "draft" | "verified" | "published";
}

export interface ModelTaskRequest {
  taskType: "llm.gdd" | "llm.classification" | "image.asset" | "audio.sfx" | "audio.bgm" | "effect.preset";
  prompt: string;
  provider: "mock" | "openai" | "deepseek" | "custom";
  model: string;
}

export interface ModelTaskResult {
  id: string;
  provider: string;
  model: string;
  taskType: ModelTaskRequest["taskType"];
  output: {
    summary: string;
    payload: Record<string, unknown>;
  };
}

interface Store {
  projects: StoredProject[];
  versions: StoredVersion[];
  generated: Map<string, MockProject>;
}

export interface BackendOptions {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
}

export interface DeepSeekChatRequest {
  url: string;
  headers: {
    "Content-Type": string;
    Authorization: string;
  };
  body: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    temperature: number;
    response_format: { type: "json_object" };
  };
}

export function createInMemoryBackend(options: BackendOptions = {}) {
  const store: Store = {
    projects: [],
    versions: [],
    generated: new Map()
  };

  return {
    projects: {
      createProject(idea: string): StoredProject {
        const project: StoredProject = {
          id: `project-${store.projects.length + 1}`,
          idea,
          createdAt: new Date("2026-06-16T00:00:00.000Z").toISOString()
        };
        store.projects.push(project);
        return project;
      },
      getProject(projectId: string): StoredProject | undefined {
        return store.projects.find((project) => project.id === projectId);
      }
    },
    pipeline: {
      generateVersion(projectId: string): StoredVersion {
        const project = requireProject(store, projectId);
        const generated = runMockPipeline(project.idea);
        const version: StoredVersion = {
          id: "v1",
          projectId,
          artifactFiles: generated.artifacts.map((artifact) => artifact.fileName),
          status: "published"
        };
        store.generated.set(versionKey(projectId, version.id), generated);
        store.versions.push(version);
        return version;
      }
    },
    assets: {
      listAssets(versionId: string): AssetRequirement[] {
        return requireGeneratedByVersion(store, versionId).assetPack.assets;
      }
    },
    verification: {
      verifyVersion(versionId: string): QaReport {
        return requireGeneratedByVersion(store, versionId).qaReport;
      }
    },
    play: {
      publish(versionId: string) {
        const generated = requireGeneratedByVersion(store, versionId);
        const storedVersion = requireVersion(store, versionId);
        storedVersion.status = "published";
        return {
          versionId,
          playUrl: `/play/${storedVersion.projectId}/${versionId}`,
          title: generated.title,
          publishedAt: new Date("2026-06-16T00:00:00.000Z").toISOString()
        };
      }
    },
    models: {
      createDeepSeekChatRequest(request: ModelTaskRequest): DeepSeekChatRequest {
        return createDeepSeekChatRequest(request, options);
      },
      async runTask(request: ModelTaskRequest): Promise<ModelTaskResult> {
        if (request.provider === "deepseek") {
          if (!options.deepseekApiKey) {
            return {
              id: `task-${request.taskType}`,
              provider: "deepseek",
              model: request.model || "deepseek-v4-flash",
              taskType: request.taskType,
              output: {
                summary:
                  "DeepSeek adapter is configured. Set DEEPSEEK_API_KEY on the backend to enable real deepseek-v4-flash calls.",
                payload: {
                  prompt: request.prompt,
                  baseUrl: options.deepseekBaseUrl ?? "https://api.deepseek.com",
                  mode: "missing-api-key"
                }
              }
            };
          }

          const deepSeekRequest = createDeepSeekChatRequest(request, options);
          return {
            id: `task-${request.taskType}`,
            provider: "deepseek",
            model: deepSeekRequest.body.model,
            taskType: request.taskType,
            output: {
              summary:
                "DeepSeek v4 flash request is ready. Network execution should run only from a trusted backend service.",
              payload: {
                url: deepSeekRequest.url,
                model: deepSeekRequest.body.model,
                messageCount: deepSeekRequest.body.messages.length
              }
            }
          };
        }

        if (request.provider !== "mock") {
          return {
            id: `task-${request.taskType}`,
            provider: request.provider,
            model: request.model,
            taskType: request.taskType,
            output: {
              summary: "Provider adapter is configured but not enabled in the MVP success path.",
              payload: { prompt: request.prompt, mode: "adapter-placeholder" }
            }
          };
        }

        return {
          id: `task-${request.taskType}`,
          provider: "mock",
          model: request.model,
          taskType: request.taskType,
          output: {
            summary: "Mock provider returned a standard artifact for the pipeline.",
            payload: { prompt: request.prompt, mode: "deterministic-mock" }
          }
        };
      }
    }
  };
}

function createDeepSeekChatRequest(
  request: ModelTaskRequest,
  options: BackendOptions
): DeepSeekChatRequest {
  const baseUrl = (options.deepseekBaseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = request.model || "deepseek-v4-flash";
  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.deepseekApiKey ?? ""}`
    },
    body: {
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are the WOW Game model adapter. Return strict JSON artifacts for the game production pipeline. Do not generate free engine lifecycle code."
        },
        {
          role: "user",
          content: request.prompt
        }
      ]
    }
  };
}

function requireProject(store: Store, projectId: string): StoredProject {
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return project;
}

function requireVersion(store: Store, versionId: string): StoredVersion {
  const version = store.versions.find((item) => item.id === versionId);
  if (!version) {
    throw new Error(`Version not found: ${versionId}`);
  }
  return version;
}

function requireGeneratedByVersion(store: Store, versionId: string): MockProject {
  const version = requireVersion(store, versionId);
  const generated = store.generated.get(versionKey(version.projectId, version.id));
  if (!generated) {
    throw new Error(`Generated project not found: ${version.id}`);
  }
  return generated;
}

function versionKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}
