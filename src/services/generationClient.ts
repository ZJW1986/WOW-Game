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

async function parseJson(response: Response) {
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    throw new Error("Generation request failed: invalid JSON response");
  }
}
