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
    return fallbackAsset(projectId, versionId, requirement);
  } catch (error) {
    return fallbackAsset(
      projectId,
      versionId,
      requirement,
      error instanceof Error ? error.message : String(error)
    );
  }
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
