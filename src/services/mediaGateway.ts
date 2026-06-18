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
  assetLibraryProvider?: (input: MediaProviderInput) => Promise<MediaProviderResult>;
}

export function createMediaGateway(options: MediaGatewayOptions = {}) {
  return {
    generateImageAsset(projectId: string, versionId: string, requirement: AssetRequirement): AssetRequirement {
      return applyProviderResult(requirement, builtinLibraryAsset({ projectId, versionId, requirement }));
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
    if (isImageRequirement(requirement)) {
      return applyProviderResult(requirement, await selectLibraryAsset({ projectId, versionId, requirement }, options));
    }
    return proceduralAsset(projectId, versionId, requirement);
  } catch (error) {
    if (isImageRequirement(requirement)) {
      const libraryAsset = applyProviderResult(
        requirement,
        await selectLibraryAsset({ projectId, versionId, requirement }, options)
      );
      return {
        ...libraryAsset,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    return fallbackAsset(
      projectId,
      versionId,
      requirement,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function selectLibraryAsset(
  input: MediaProviderInput,
  options: MediaGatewayOptions
): Promise<MediaProviderResult> {
  if (options.assetLibraryProvider) {
    return options.assetLibraryProvider(input);
  }
  return builtinLibraryAsset(input);
}

function isImageRequirement(requirement: AssetRequirement): boolean {
  return requirement.type === "image" || requirement.type === "ui";
}

function builtinLibraryAsset(input: MediaProviderInput): MediaProviderResult {
  const { requirement, projectId, versionId } = input;
  const transparent = Boolean(requirement.transparentBackgroundRequired);
  const targetSize = requirement.targetSize ?? (transparent ? "512x512" : "1536x864");
  const fileUrl = createLibraryPngDataUrl(requirement, transparent);
  return {
    status: "generated",
    source: "library",
    fileUrl,
    previewUrl: fileUrl,
    provider: "asset-library",
    model: "builtin-library-v1",
    generationParams: {
      projectId,
      versionId,
      targetSize,
      transparentBackground: transparent,
      libraryTags: (requirement.libraryTags ?? []).join(",")
    }
  };
}

function colorForBackground(assetKey: string): string {
  if (assetKey.includes("background") || assetKey.includes("cover")) return "#10243a";
  if (assetKey.includes("tiles") || assetKey.includes("path")) return "#1f3b2f";
  return "#111827";
}

function createLibraryPngDataUrl(requirement: AssetRequirement, transparent: boolean): string {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  const fill = parseHexColor(transparent ? "#000000" : colorForBackground(requirement.assetKey));
  const primary = parseHexColor(colorForAsset(requirement.assetKey));
  const accent = parseHexColor(accentForAsset(requirement.assetKey));
  const shape = shapeForAsset(requirement.assetKey);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(pixels, size, x, y, fill, transparent ? 0 : 255);
    }
  }

  if (shape === "ship") {
    for (let y = 3; y < 29; y += 1) {
      const halfWidth = Math.max(1, Math.floor((y - 2) / 2.2));
      for (let x = 16 - halfWidth; x <= 16 + halfWidth; x += 1) {
        if (x >= 0 && x < size) setPixel(pixels, size, x, y, primary, 255);
      }
    }
    drawCircle(pixels, size, 16, 18, 4, accent, 255);
  } else if (shape === "collectible") {
    drawCircle(pixels, size, 16, 16, 10, primary, 255);
    drawCircle(pixels, size, 16, 16, 4, accent, 255);
  } else if (shape === "hazard") {
    for (let y = 5; y < 29; y += 1) {
      const halfWidth = Math.floor((y - 5) / 1.2);
      for (let x = 16 - halfWidth; x <= 16 + halfWidth; x += 1) {
        if (x >= 0 && x < size) setPixel(pixels, size, x, y, primary, 255);
      }
    }
    drawCircle(pixels, size, 16, 22, 2, accent, 255);
  } else {
    for (let y = 21; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (y > 24 - Math.sin(x / 4) * 3) setPixel(pixels, size, x, y, primary, 220);
      }
    }
    drawCircle(pixels, size, 7, 8, 1, accent, 255);
    drawCircle(pixels, size, 23, 11, 1, accent, 255);
  }

  return `data:image/png;base64,${encodeBase64(encodePng(size, size, pixels))}`;
}

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function setPixel(
  pixels: Uint8Array,
  size: number,
  x: number,
  y: number,
  color: [number, number, number],
  alpha: number
) {
  const offset = (y * size + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = alpha;
}

function drawCircle(
  pixels: Uint8Array,
  size: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: [number, number, number],
  alpha: number
) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x >= 0 && x < size && y >= 0 && y < size && (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        setPixel(pixels, size, x, y, color, alpha);
      }
    }
  }
}

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const scanlines = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }
  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", concatBytes([uint32(width), uint32(height), new Uint8Array([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", zlibStore(scanlines)),
    pngChunk("IEND", new Uint8Array())
  ]);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < data.length; offset += 65535) {
    const chunk = data.subarray(offset, offset + 65535);
    const finalBlock = offset + 65535 >= data.length ? 1 : 0;
    const header = new Uint8Array([
      finalBlock,
      chunk.length & 0xff,
      (chunk.length >> 8) & 0xff,
      (~chunk.length) & 0xff,
      ((~chunk.length) >> 8) & 0xff
    ]);
    blocks.push(header, chunk);
  }
  blocks.push(uint32(adler32(data)));
  return concatBytes(blocks);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([uint32(data.length), typeBytes, data, uint32(crc32(concatBytes([typeBytes, data])))]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function encodeBase64(bytes: Uint8Array): string {
  const bufferCtor = (globalThis as { Buffer?: { from: (bytes: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
    libraryAssetId:
      result.source === "library"
        ? `${result.provider}:${requirement.assetKey}:${requirement.targetSize ?? "auto"}`
        : requirement.libraryAssetId,
    approvalStatus: result.source === "uploaded" ? "approved" : "pending",
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
