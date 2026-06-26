import type { MediaProviderInput, MediaProviderResult } from "./mediaGateway";

export interface AgnesImageProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  endpoint?: string;
  model?: string;
  authHeader?: string;
  responseImagePath?: string;
  timeoutMs?: number;
  fetcher?: (request: {
    url: string;
    init: {
      method: "POST";
      headers: Record<string, string>;
      body: string;
    };
  }) => Promise<string>;
}

export function createAgnesImageProvider(options: AgnesImageProviderOptions = {}) {
  const batchReferences = new Map<string, string>();
  return async function agnesImageProvider(input: MediaProviderInput): Promise<MediaProviderResult> {
    if (!options.apiKey) {
      throw new Error("IMAGE_API_KEY is required for Agnes image generation");
    }

    const { requirement, projectId, versionId } = input;
    const baseUrl = (options.baseUrl ?? "https://agnes-ai.com").replace(/\/$/, "");
    const endpoint = options.endpoint ?? "/v1/images/generations";
    const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const model = options.model ?? "agnes-image-2.1-flash";
    const transparentBackground = Boolean(requirement.transparentBackgroundRequired);
    const size = normalizeAgnesSize(requirement.targetSize, transparentBackground);
    const prompt = buildAgnesPrompt(requirement, transparentBackground);
    const authHeader = options.authHeader ?? "Authorization";
    const authValue = authHeader.toLowerCase() === "authorization" ? `Bearer ${options.apiKey}` : options.apiKey;
    const isChatCompletions = endpoint.includes("/chat/completions");
    const batchKey = `${projectId}:${versionId}`;
    const referenceImage = batchReferences.get(batchKey);
    const generationBody = {
      model,
      prompt,
      size,
      ...(referenceImage && !isBackgroundRequirement(requirement) ? { reference_image: referenceImage } : {})
    };
    const request = {
      url,
      init: {
        method: "POST" as const,
        headers: {
          "Content-Type": "application/json",
          [authHeader]: authValue
        },
        body: JSON.stringify(
          isChatCompletions
            ? {
                model,
                messages: [{ role: "user", content: prompt }]
              }
            : generationBody
        )
      }
    };

    const raw = await withTimeout(
      options.fetcher ? options.fetcher(request) : defaultFetch(request.url, request.init),
      options.timeoutMs ?? 30000,
      "Agnes image request timed out"
    );
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fileUrl = readImageUrl(parsed, options.responseImagePath);
    if (isBackgroundRequirement(requirement)) {
      batchReferences.set(batchKey, fileUrl);
    }

    return {
      status: "generated",
      source: "generated",
      fileUrl,
      previewUrl: fileUrl,
      provider: "agnes",
      model,
      generationParams: {
        projectId,
        versionId,
        size,
        ...(generationBody.reference_image ? { referenceImage: generationBody.reference_image } : {}),
        transparentBackground,
        endpoint
      }
    };
  };
}

function isBackgroundRequirement(requirement: MediaProviderInput["requirement"]): boolean {
  const text = `${requirement.assetKey} ${requirement.purpose} ${requirement.targetSize ?? ""}`.toLowerCase();
  return requirement.assetKey.startsWith("world.") || text.includes("background") || text.includes("path");
}

function normalizeAgnesSize(size: string | undefined, transparentBackground: boolean): string {
  if (size && /^(1024x1024|1024x1536|1536x1024)$/i.test(size)) return size.toLowerCase();
  return transparentBackground ? "1024x1024" : "1536x1024";
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

function buildAgnesPrompt(
  requirement: MediaProviderInput["requirement"],
  transparentBackground: boolean
): string {
  const constraints = transparentBackground
    ? "Solid chroma green background (#00ff00), isolated centered game sprite, readable silhouette, no shadow, no glow, no ground, no border, no checkerboard, no text. If the subject itself is green, use solid chroma magenta background (#ff00ff) instead."
    : "Wide 16:9 game environment background, readable gameplay space, no text.";
  return [requirement.prompt, constraints].filter(Boolean).join("\n");
}

function readImageUrl(payload: Record<string, unknown>, responseImagePath?: string): string {
  const configured = responseImagePath ? readPath(payload, responseImagePath) : undefined;
  const value =
    configured ??
    readPath(payload, "data.0.b64_json") ??
    readPath(payload, "data.0.url") ??
    readPath(payload, "b64_json") ??
    readPath(payload, "url") ??
    readPath(payload, "image") ??
    readPath(payload, "output.0") ??
    extractImageFromText(readPath(payload, "choices.0.message.content"));
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Agnes response missing image url or base64 payload");
  }
  if (value.startsWith("http") || value.startsWith("data:image")) {
    return value;
  }
  return `data:image/png;base64,${value}`;
}

function extractImageFromText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const dataUrl = value.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i)?.[0];
  if (dataUrl) return dataUrl;
  const imageUrl = value.match(/https?:\/\/\S+\.(?:png|jpe?g|webp)(?:\?\S*)?/i)?.[0];
  if (imageUrl) return imageUrl.replace(/[),.;]+$/, "");
  const base64 = value.match(/\b[A-Za-z0-9+/]{80,}={0,2}\b/)?.[0];
  return base64;
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    if (typeof current === "object") return (current as Record<string, unknown>)[segment];
    return undefined;
  }, value);
}

async function defaultFetch(
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string }
): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Agnes image request failed: HTTP ${response.status}${text ? ` ${text.slice(0, 500)}` : ""}`);
  }
  return response.text();
}
