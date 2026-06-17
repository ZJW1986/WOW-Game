import type { UserAnswer, TemplateFamily } from "../core/types";
import type { StartModelId } from "../core/start";

export interface PlayableGenerationRequest {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model: StartModelId;
}

type BrowserFetcher = typeof fetch;

export async function requestPlayableGeneration(
  input: PlayableGenerationRequest,
  fetcher: BrowserFetcher = fetch
) {
  const response = await fetcher("/api/generate-playable", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
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
