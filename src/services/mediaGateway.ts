import { validateProjectAssetUpload } from "../core/schemas";
import type { AssetRequirement, AssetSource, AssetStatus, AssetType } from "../core/types";

export interface MediaProviderInput {
  projectId: string;
  versionId: string;
  requirement: AssetRequirement;
}

export interface MediaProviderResult {
  status: Extract<AssetStatus, "generated" | "mock" | "uploaded">;
  source: AssetSource;
  fileUrl: string;
  previewUrl?: string;
  provider: string;
  model: string;
  generationParams?: Record<string, string | number | boolean>;
  error?: string;
}

export interface UploadProjectAssetInput {
  fileName: string;
  fileUrl?: string;
  previewUrl?: string;
}

export interface MediaGatewayOptions {
  imageProvider?: (input: MediaProviderInput) => Promise<MediaProviderResult>;
  audioProvider?: (input: MediaProviderInput) => Promise<MediaProviderResult>;
  effectProvider?: (input: MediaProviderInput) => Promise<MediaProviderResult>;
}

export function createMediaGateway(options: MediaGatewayOptions = {}) {
  return {
    generateImageAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return proceduralAsset(projectId, versionId, requirement);
    },

    generateSfxAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return proceduralAsset(projectId, versionId, requirement);
    },

    generateBgmAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return proceduralAsset(projectId, versionId, requirement);
    },

    generateEffectAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return proceduralAsset(projectId, versionId, requirement);
    },

    generateProceduralAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return proceduralAsset(projectId, versionId, requirement);
    },

    async generateProjectAsset(
      projectId: string,
      versionId: string,
      requirement: AssetRequirement
    ): Promise<AssetRequirement> {
      return generateWithProvider(projectId, versionId, requirement, options);
    },

    async regenerateProjectAsset(
      projectId: string,
      versionId: string,
      requirement: AssetRequirement
    ): Promise<AssetRequirement> {
      return generateWithProvider(projectId, versionId, requirement, options);
    },

    uploadProjectAsset(
      projectId: string,
      versionId: string,
      requirement: AssetRequirement,
      file: UploadProjectAssetInput
    ): AssetRequirement {
      const validation = validateProjectAssetUpload(requirement, file.fileName);
      if (!validation.success) {
        return {
          ...requirement,
          status: "failed",
          error: validation.error
        };
      }
      const fileUrl =
        file.fileUrl ?? `/projects/${projectId}/${versionId}/uploads/${encodeURIComponent(file.fileName)}`;
      return {
        ...requirement,
        status: "uploaded",
        source: "uploaded",
        generationMode: "uploaded",
        copyrightStatus: "user_provided",
        fileUrl,
        previewUrl: file.previewUrl ?? fileUrl,
        provider: "uploaded",
        model: "user-file",
        generationParams: {
          ...requirement.generationParams,
          fileName: file.fileName
        },
        error: undefined
      };
    }
  };
}

async function generateWithProvider(
  projectId: string,
  versionId: string,
  requirement: AssetRequirement,
  options: MediaGatewayOptions
): Promise<AssetRequirement> {
  const provider = selectProvider(requirement.type, options);
  try {
    if (provider) {
      const result = await provider({ projectId, versionId, requirement });
      return applyProviderResult(requirement, result);
    }
    return proceduralAsset(projectId, versionId, requirement);
  } catch (error) {
    return fallbackAsset(
      projectId,
      versionId,
      requirement,
      error instanceof Error ? error.message : String(error)
    );
  }
}

function proceduralAsset(
  projectId: string,
  versionId: string,
  requirement: AssetRequirement
): AssetRequirement {
  const payload = proceduralPayload(requirement);
  return {
    ...requirement,
    status: "generated",
    source: "generated",
    generationMode: "model",
    copyrightStatus: "generated",
    fileUrl: payload.fileUrl,
    previewUrl: payload.previewUrl,
    provider: "procedural",
    model: "procedural-media-v1",
    generationParams: {
      ...requirement.generationParams,
      ...payload.params,
      projectId,
      versionId
    },
    error: undefined
  };
}

function proceduralPayload(requirement: AssetRequirement): {
  fileUrl: string;
  previewUrl: string;
  params: Record<string, string | number | boolean>;
} {
  if (requirement.type === "sfx") {
    const params = soundParams(requirement.assetKey);
    const fileUrl = jsonDataUrl({ kind: "sfx", assetKey: requirement.assetKey, ...params });
    return { fileUrl, previewUrl: fileUrl, params };
  }
  if (requirement.type === "bgm") {
    const params = { pattern: "loop", tempo: 96, notes: "196,247,294,247", wave: "sine" };
    const fileUrl = jsonDataUrl({ kind: "bgm", assetKey: requirement.assetKey, ...params });
    return { fileUrl, previewUrl: fileUrl, params };
  }
  if (requirement.type === "effect") {
    const preset = effectPreset(requirement.assetKey);
    const params = { preset, particles: preset === "collect-burst" ? 16 : 24, durationMs: 460 };
    const fileUrl = jsonDataUrl({ kind: "effect", assetKey: requirement.assetKey, ...params });
    return { fileUrl, previewUrl: fileUrl, params };
  }
  const svg = createSvgAsset(requirement);
  const fileUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return {
    fileUrl,
    previewUrl: fileUrl,
    params: {
      format: "svg",
      dominantColor: colorForAsset(requirement.assetKey),
      proceduralShape: shapeForAsset(requirement.assetKey)
    }
  };
}

function jsonDataUrl(payload: Record<string, unknown>): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
}

function createSvgAsset(requirement: AssetRequirement): string {
  const color = colorForAsset(requirement.assetKey);
  const accent = accentForAsset(requirement.assetKey);
  const shape = shapeForAsset(requirement.assetKey);
  const label = requirement.assetKey.split(".").at(-1)?.slice(0, 8) ?? "asset";
  const body =
    shape === "ship"
      ? `<polygon points="64,14 110,112 64,92 18,112" fill="${color}"/><circle cx="64" cy="76" r="13" fill="${accent}"/>`
      : shape === "collectible"
        ? `<circle cx="64" cy="64" r="34" fill="${color}"/><path d="M64 28l9 24 26 1-20 16 7 25-22-14-22 14 7-25-20-16 26-1z" fill="${accent}"/>`
        : shape === "hazard"
          ? `<polygon points="64,12 118,112 10,112" fill="${color}"/><circle cx="64" cy="82" r="8" fill="${accent}"/>`
          : shape === "background"
            ? `<rect width="128" height="128" fill="${color}"/><circle cx="24" cy="28" r="3" fill="${accent}"/><circle cx="96" cy="42" r="2" fill="${accent}"/><circle cx="70" cy="94" r="4" fill="${accent}"/>`
            : `<rect x="18" y="28" width="92" height="72" rx="14" fill="${color}"/><rect x="30" y="44" width="68" height="12" rx="6" fill="${accent}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="18" fill="#111827"/>${body}<text x="64" y="122" text-anchor="middle" font-family="Arial" font-size="10" fill="#f8fafc">${escapeXml(label)}</text></svg>`;
}

function colorForAsset(assetKey: string): string {
  if (assetKey.includes("player")) return "#22d3ee";
  if (assetKey.includes("collectible") || assetKey.includes("cover")) return "#facc15";
  if (assetKey.includes("hazard")) return "#fb7185";
  if (assetKey.includes("world")) return "#334155";
  if (assetKey.includes("button") || assetKey.includes("ui")) return "#8b5cf6";
  return "#5eead4";
}

function accentForAsset(assetKey: string): string {
  if (assetKey.includes("hazard")) return "#fecdd3";
  if (assetKey.includes("world")) return "#22d3ee";
  return "#ffffff";
}

function shapeForAsset(assetKey: string): string {
  if (assetKey.includes("ship") || assetKey.includes("hero") || assetKey.includes("player")) return "ship";
  if (assetKey.includes("collectible")) return "collectible";
  if (assetKey.includes("hazard") || assetKey.includes("spike") || assetKey.includes("enemy")) return "hazard";
  if (assetKey.includes("background") || assetKey.includes("tiles") || assetKey.includes("path")) return "background";
  return "panel";
}

function soundParams(assetKey: string): Record<string, string | number | boolean> {
  if (assetKey.includes("collect")) return { frequency: 720, durationMs: 140, wave: "triangle" };
  if (assetKey.includes("hit")) return { frequency: 132, durationMs: 180, wave: "sawtooth" };
  if (assetKey.includes("win")) return { frequency: 880, durationMs: 420, wave: "triangle" };
  if (assetKey.includes("lose")) return { frequency: 196, durationMs: 420, wave: "sawtooth" };
  return { frequency: 420, durationMs: 80, wave: "square" };
}

function effectPreset(assetKey: string): string {
  if (assetKey.includes("collect")) return "collect-burst";
  if (assetKey.includes("win")) return "win-bloom";
  if (assetKey.includes("lose")) return "lose-fade";
  return "hit-spark";
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => {
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "&") return "&amp;";
    if (char === "'") return "&apos;";
    return "&quot;";
  });
}

function selectProvider(type: AssetType, options: MediaGatewayOptions) {
  if (type === "image" || type === "ui") return options.imageProvider;
  if (type === "sfx" || type === "bgm") return options.audioProvider;
  if (type === "effect") return options.effectProvider;
  return undefined;
}

function applyProviderResult(
  requirement: AssetRequirement,
  result: MediaProviderResult
): AssetRequirement {
  return {
    ...requirement,
    status: result.status,
    source: result.source,
    generationMode: result.source === "uploaded" ? "uploaded" : "model",
    copyrightStatus: result.source === "uploaded" ? "user_provided" : "generated",
    fileUrl: result.fileUrl,
    previewUrl: result.previewUrl ?? result.fileUrl,
    provider: result.provider,
    model: result.model,
    generationParams: {
      ...requirement.generationParams,
      ...(result.generationParams ?? {})
    },
    error: result.error
  };
}

function fallbackAsset(
  projectId: string,
  versionId: string,
  requirement: AssetRequirement,
  error?: string
): AssetRequirement {
  const source = requirement.generationMode === "preset" ? "preset" : "mock";
  const status = source === "preset" ? "generated" : "mock";
  const fileUrl = `/projects/${projectId}/${versionId}/assets/${source}/${requirement.assetKey}.${extensionFor(
    requirement.type
  )}`;
  return {
    ...requirement,
    status,
    source,
    fileUrl,
    previewUrl: requirement.previewUrl || fileUrl,
    provider: source,
    model: source === "preset" ? "preset-v1" : "mock-media-v1",
    generationParams: {
      ...requirement.generationParams,
      fallback: Boolean(error)
    },
    error
  };
}

function extensionFor(type: AssetType): string {
  if (type === "sfx" || type === "bgm") return "mp3";
  if (type === "effect") return "json";
  return "png";
}
