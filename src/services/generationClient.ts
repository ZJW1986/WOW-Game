import type {
  AssetCandidate,
  AssetCandidates,
  ConfirmedAssets,
  ConfirmedThreeAssets,
  DesignBrief,
  DesignQuestion,
  EngineType,
  RevisionAnalysis,
  UserAnswer,
  TemplateFamily,
  ThreeGameGenre,
  ThreeGameBrief,
  ThreeAssetCandidates,
  ViewportMode,
  UserMaterial
} from "../core/types";
import type { StartModelId } from "../core/start";

export interface PlayableGenerationRequest {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model: StartModelId;
  referencePackageId?: string;
  referenceVersionId?: string;
  userMaterials?: UserMaterial[];
  designBrief?: DesignBrief;
  confirmedAssets?: ConfirmedAssets;
  revisionHistory?: RevisionAnalysis[];
}

export interface ThreeGameGenerationRequest {
  idea: string;
  projectId: string;
  baseUrl: string;
  engineType?: EngineType;
  viewportMode?: ViewportMode;
  gameType3d?: ThreeGameGenre;
  answers?: UserAnswer[];
  threeDesignBrief?: ThreeGameBrief;
  userMaterials?: UserMaterial[];
  confirmedThreeAssets?: ConfirmedThreeAssets;
}

export interface ThreeAssetCandidatesRequest {
  idea: string;
  projectId: string;
  baseUrl: string;
  engineType?: EngineType;
  viewportMode?: ViewportMode;
  gameType3d?: ThreeGameGenre;
  answers?: UserAnswer[];
  threeDesignBrief?: ThreeGameBrief;
  userMaterials?: UserMaterial[];
}

export interface RegenerateThreeAssetCandidateRequest {
  idea: string;
  projectId: string;
  baseUrl: string;
  engineType?: EngineType;
  viewportMode?: ViewportMode;
  gameType3d?: ThreeGameGenre;
  answers?: UserAnswer[];
  threeDesignBrief?: ThreeGameBrief;
  userMaterials?: UserMaterial[];
  threeAssetCandidates?: ThreeAssetCandidates;
  assetKey: "three.model.player" | "three.model.hazard" | "three.model.collectible";
  slotRevisionId?: string;
}

export interface UploadPlayablePackageRequest {
  packageName: string;
  packageFileName: string;
  packageBase64: string;
  description?: string;
  baseUrl?: string;
}

export interface GuidedQuestionsRequest {
  idea: string;
  engineType?: EngineType;
  templateFamily: TemplateFamily;
  gameType3d?: ThreeGameGenre;
  projectId?: string;
  model: StartModelId;
  designBrief?: DesignBrief;
  referencePackageId?: string;
  referenceVersionId?: string;
  userMaterials?: UserMaterial[];
  previousAnswers?: UserAnswer[];
}

export interface DesignBriefRequest {
  idea: string;
  engineType?: EngineType;
  templateFamily: TemplateFamily;
  gameType3d?: ThreeGameGenre;
  model: StartModelId;
  referencePackageId?: string;
  referenceVersionId?: string;
  userMaterials?: UserMaterial[];
}

export interface AssetCandidatesRequest extends DesignBriefRequest {
  designBrief?: DesignBrief;
  answers?: UserAnswer[];
  requestedSlots?: Array<"background" | "player" | "hazard" | "collectible">;
}

export interface RegenerateAssetCandidateRequest {
  idea: string;
  templateFamily: TemplateFamily;
  candidate: AssetCandidate;
  slotRevisionId?: string;
}

export interface ProcessUploadedMaterialRequest {
  idea: string;
  templateFamily: TemplateFamily;
  slot: AssetCandidate["slot"];
  assetKey: string;
  fileName: string;
  fileBase64: string;
  contentType: string;
  label?: string;
  prompt?: string;
  style?: string;
}

export interface GenerateProductionBriefRequest {
  idea: string;
  engineType?: EngineType;
  templateFamily?: TemplateFamily;
  gameType3d?: ThreeGameGenre;
}

export interface GenerateGameDevPromptBundleRequest {
  idea: string;
  engineType?: EngineType;
  profileId?: string;
}

export interface GeneratePromptPackRequest extends GenerateProductionBriefRequest {
  projectId?: string;
  baseUrl?: string;
  viewportMode?: ViewportMode;
  answers?: UserAnswer[];
  threeDesignBrief?: ThreeGameBrief;
  userMaterials?: UserMaterial[];
}

export interface CellCogGenerateAssetRequest {
  promptPackId: string;
  slot: string;
  prompt: string;
  requestedOutput: "png" | "webp" | "glb" | "mp3" | "html" | "pdf";
}

export interface ReplaceAssetCandidateRequest {
  projectId?: string;
  assetKey: string;
  previousFileUrl?: string;
  candidateFileUrl: string;
  reason?: string;
}

export interface RevisionAnalysisRequest extends DesignBriefRequest {
  followup: string;
  designBrief?: DesignBrief;
  previousAnswers?: UserAnswer[];
}

type BrowserFetcher = typeof fetch;
interface RequestClientOptions {
  timeoutMs?: number;
}

export async function requestPlayableGeneration(
  input: PlayableGenerationRequest,
  fetcher: BrowserFetcher = fetch,
  options: RequestClientOptions = {}
) {
  const response = await withTimeout(
    fetcher("/api/generate-playable", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }),
    options.timeoutMs ?? 90000,
    "Generation request timed out"
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : response.statusText || `HTTP ${response.status}`;
    throw new Error(`Generation request failed: ${message}`);
  }
  return payload;
}

export async function requestThreeGameGeneration(
  input: ThreeGameGenerationRequest,
  fetcher: BrowserFetcher = fetch,
  options: RequestClientOptions = {}
) {
  const response = await withTimeout(
    fetcher("/api/generate-three-game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }),
    options.timeoutMs ?? 60000,
    "Three.js generation request timed out"
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Three.js generation request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function requestThreeAssetCandidates(
  input: ThreeAssetCandidatesRequest,
  fetcher: BrowserFetcher = fetch,
  options: RequestClientOptions = {}
): Promise<{
  threeAssetCandidates: ThreeAssetCandidates;
  threeDesignBrief: ThreeGameBrief;
  threeSceneDirector: Record<string, any>;
}> {
  const response = await withTimeout(
    fetcher("/api/three-asset-candidates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }),
    options.timeoutMs ?? 180000,
    "Three.js asset candidate request timed out"
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Three.js asset candidate request failed: ${readError(payload, response)}`);
  }
  return payload as {
    threeAssetCandidates: ThreeAssetCandidates;
    threeDesignBrief: ThreeGameBrief;
    threeSceneDirector: Record<string, any>;
  };
}

export async function requestRegenerateThreeAssetCandidate(
  input: RegenerateThreeAssetCandidateRequest,
  fetcher: BrowserFetcher = fetch,
  options: RequestClientOptions = {}
): Promise<{
  threeAssetCandidates: ThreeAssetCandidates;
  threeDesignBrief: ThreeGameBrief;
  threeSceneDirector: Record<string, any>;
}> {
  const response = await withTimeout(
    fetcher("/api/regenerate-three-asset-candidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }),
    options.timeoutMs ?? 180000,
    "Three.js asset regeneration request timed out"
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Three.js asset regeneration request failed: ${readError(payload, response)}`);
  }
  return payload as {
    threeAssetCandidates: ThreeAssetCandidates;
    threeDesignBrief: ThreeGameBrief;
    threeSceneDirector: Record<string, any>;
  };
}

export async function requestProductionBrief(
  input: GenerateProductionBriefRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/generate-production-brief", input, "Production brief request failed", fetcher);
}

export async function requestGameDevPromptBundle(
  input: GenerateGameDevPromptBundleRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/generate-game-dev-prompt-bundle", input, "Game dev prompt bundle request failed", fetcher);
}

export async function requestUiAssetKit(
  input: GeneratePromptPackRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/generate-ui-asset-kit", input, "UI asset kit request failed", fetcher);
}

export async function requestAudioPromptPack(
  input: GeneratePromptPackRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/generate-audio-prompt-pack", input, "Audio prompt pack request failed", fetcher);
}

export async function requestModelPromptPack(
  input: GeneratePromptPackRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/generate-model-prompt-pack", input, "Model prompt pack request failed", fetcher);
}

export async function requestCellCogAssetGeneration(
  input: CellCogGenerateAssetRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/cellcog/generate-asset", input, "CellCog asset request failed", fetcher);
}

export async function requestAssetCandidateReplacement(
  input: ReplaceAssetCandidateRequest,
  fetcher: BrowserFetcher = fetch
) {
  return postJson("/api/replace-asset-candidate", input, "Asset replacement request failed", fetcher);
}

export async function requestTripoBalance(fetcher: BrowserFetcher = fetch) {
  const response = await fetcher("/api/tripo/balance", {
    method: "GET"
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Tripo balance request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function requestTripoTextToModel(prompt: string, fetcher: BrowserFetcher = fetch) {
  const response = await fetcher("/api/tripo/text-to-model", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt })
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Tripo text-to-model request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function requestTripoTask(taskId: string, fetcher: BrowserFetcher = fetch) {
  const response = await fetcher(`/api/tripo/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET"
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Tripo task request failed: ${readError(payload, response)}`);
  }
  return payload;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (timeoutMs <= 0) return promise;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function requestGuidedQuestions(
  input: GuidedQuestionsRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  questions: DesignQuestion[];
  modelTask: Record<string, any>;
  fallbackUsed: boolean;
}> {
  const response = await fetcher("/api/guided-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Guided questions request failed: ${readError(payload, response)}`);
  }
  return payload as {
    questions: DesignQuestion[];
    modelTask: Record<string, any>;
    fallbackUsed: boolean;
  };
}

export async function requestPlayableProject(
  projectId: string,
  versionId: string,
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher(`/api/play/${encodeURIComponent(projectId)}/${encodeURIComponent(versionId)}`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Playable request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function submitPlayableFeedback(
  projectId: string,
  versionId: string,
  input: { rating: number; comment: string; playerName: string },
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher(
    `/api/play/${encodeURIComponent(projectId)}/${encodeURIComponent(versionId)}/feedback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Feedback request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function uploadPlayablePackage(
  input: UploadPlayablePackageRequest,
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher("/api/upload-package", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Upload request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function requestDesignBrief(
  input: DesignBriefRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  designBrief: DesignBrief;
  modelTask: Record<string, any>;
  fallbackUsed: boolean;
}> {
  const response = await fetcher("/api/design-brief", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Design brief request failed: ${readError(payload, response)}`);
  }
  return payload as {
    designBrief: DesignBrief;
    modelTask: Record<string, any>;
    fallbackUsed: boolean;
  };
}

export async function requestAssetCandidates(
  input: AssetCandidatesRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  assetCandidates: AssetCandidates;
  confirmedAssets: ConfirmedAssets;
  modelTask: Record<string, any>;
  fallbackUsed: boolean;
}> {
  const response = await fetcher("/api/asset-candidates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Asset candidates request failed: ${readError(payload, response)}`);
  }
  return payload as {
    assetCandidates: AssetCandidates;
    confirmedAssets: ConfirmedAssets;
    modelTask: Record<string, any>;
    fallbackUsed: boolean;
  };
}

export async function requestRegenerateAssetCandidate(
  input: RegenerateAssetCandidateRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  assetCandidate: AssetCandidate;
}> {
  const response = await fetcher("/api/regenerate-asset-candidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Regenerate asset candidate request failed: ${readError(payload, response)}`);
  }
  return payload as {
    assetCandidate: AssetCandidate;
  };
}

export async function requestProcessUploadedMaterial(
  input: ProcessUploadedMaterialRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  assetCandidate: AssetCandidate;
}> {
  const response = await fetcher("/api/process-uploaded-material", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Process uploaded material request failed: ${readError(payload, response)}`);
  }
  return payload as {
    assetCandidate: AssetCandidate;
  };
}

export async function requestRevisionAnalysis(
  input: RevisionAnalysisRequest,
  fetcher: BrowserFetcher = fetch
): Promise<{
  revisionAnalysis: RevisionAnalysis;
  modelTask: Record<string, any>;
  fallbackUsed: boolean;
}> {
  const response = await fetcher("/api/revision-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Revision analysis request failed: ${readError(payload, response)}`);
  }
  return payload as {
    revisionAnalysis: RevisionAnalysis;
    modelTask: Record<string, any>;
    fallbackUsed: boolean;
  };
}

export async function requestPackageEditPlan(
  input: { projectId: string; versionId: string; userGoal: string },
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher("/api/package-edit-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Package edit plan request failed: ${readError(payload, response)}`);
  }
  return payload;
}

export async function replacePackageAsset(
  input: { projectId: string; versionId: string; assetPath: string; fileBase64: string; fileName: string },
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher("/api/replace-package-asset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`Package asset replacement failed: ${readError(payload, response)}`);
  }
  return payload;
}

async function postJson(
  path: string,
  input: Record<string, any>,
  errorPrefix: string,
  fetcher: BrowserFetcher
) {
  const response = await fetcher(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(`${errorPrefix}: ${readError(payload, response)}`);
  }
  return payload;
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    throw new Error("Generation request failed: invalid JSON response");
  }
}

function readError(payload: Record<string, any>, response: Response): string {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : response.statusText || `HTTP ${response.status}`;
}
