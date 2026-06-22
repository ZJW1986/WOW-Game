import type {
  AssetCandidate,
  AssetCandidates,
  ConfirmedAssets,
  DesignBrief,
  DesignQuestion,
  EngineType,
  RevisionAnalysis,
  UserAnswer,
  TemplateFamily,
  ThreeGameGenre,
  ThreeGameBrief,
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
}

export interface RegenerateAssetCandidateRequest {
  idea: string;
  templateFamily: TemplateFamily;
  candidate: AssetCandidate;
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
