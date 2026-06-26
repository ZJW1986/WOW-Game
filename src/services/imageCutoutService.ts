import sharp from "sharp";
import type { RuntimeAssetSlotName } from "../core/types";

export interface CutoutInput {
  slot: string;
  assetKey: string;
  bytes: Uint8Array;
  contentType?: string;
}

export interface SpriteValidation {
  validationStatus: "passed" | "failed";
  validationErrors: string[];
  alphaCoverage: number;
  subjectBounds: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  hasAlpha: boolean;
  chromaKeyColor?: string;
  chromaTolerance?: number;
  edgeResidueScore?: number;
  spillScore?: number;
  subjectCoverage?: number;
  checkerboardResidueScore?: number;
}

export interface CutoutResult {
  outputBytes: Uint8Array;
  outputExtension: string;
  cutoutApplied: boolean;
  cutoutMethod?: string;
  validation: SpriteValidation;
}

const spriteSlots = new Set(["player", "hazard", "collectible"]);
const transparentThreshold = 38;
const spriteCanvasSize = 128;
const chromaTolerance = 42;
const chromaSoftTolerance = 92;
const chromaKeys: Array<{ hex: string; color: [number, number, number] }> = [
  { hex: "#00ff00", color: [0, 255, 0] },
  { hex: "#ff00ff", color: [255, 0, 255] },
  { hex: "#0066ff", color: [0, 102, 255] }
];

export async function processGeneratedImageForSlot(input: CutoutInput): Promise<CutoutResult> {
  if (!spriteSlots.has(input.slot)) {
    return {
      outputBytes: input.bytes,
      outputExtension: extensionForContentType(input.contentType),
      cutoutApplied: false,
      validation: emptyValidation()
    };
  }

  const image = sharp(Buffer.from(input.bytes)).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) {
    return failedResult(input.bytes, "png", "Image dimensions could not be read.");
  }

  const raw = await image.raw().toBuffer();
  const pixels = new Uint8Array(raw);
  const background = inferBorderColor(pixels, width, height);
  const chromaKey = inferChromaKeyColor(pixels, width, height);
  const checkerboardColors = inferCheckerboardColors(pixels, width, height);
  if (!background) {
    return failedResult(input.bytes, "png", "Sprite background could not be inferred for cutout.");
  }

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    if (
      (chromaKey && applyChromaAlpha(pixels, index, chromaKey.color)) ||
      (!chromaKey && isBackgroundPixel(pixels, index, background, checkerboardColors))
    ) {
      pixels[index + 3] = 0;
    } else if (chromaKey) {
      reduceChromaSpill(pixels, index, chromaKey.color);
    }
  }

  const bounds = findSubjectBounds(pixels, width, height);
  if (!bounds) {
    return failedResult(input.bytes, "png", "No visible subject remained after cutout.");
  }
  const sourceEdgeResidueScore = measureSourceEdgeResidue(bounds, width, height);

  const extractArea = clampBounds(bounds, width, height);
  const trimmed = await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 }
  })
    .extract(extractArea)
    .resize({
      width: Math.round(spriteCanvasSize * 0.72),
      height: Math.round(spriteCanvasSize * 0.72),
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();
  const png = await sharp({
    create: {
      width: spriteCanvasSize,
      height: spriteCanvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: trimmed, gravity: "center" }])
    .png()
    .toBuffer();
  const outputBytes = new Uint8Array(png);
  const validation = await validateProcessedSprite(outputBytes);
  const spillScore = chromaKey ? measureChromaSpill(pixels, chromaKey.color) : 0;
  const validationErrors = [
    ...validation.validationErrors,
    ...(sourceEdgeResidueScore > 0 ? ["Sprite has edge residue or subject touches the image edge after cutout."] : []),
    ...(chromaKey && spillScore > 0.015 ? ["Sprite has chroma spill residue after cutout."] : [])
  ];
  return {
    outputBytes,
    outputExtension: "png",
    cutoutApplied: true,
    cutoutMethod: chromaKey ? "chroma-key-v1" : "edge-color-alpha-v1",
    validation: {
      ...validation,
      validationStatus: validationErrors.length > 0 ? "failed" : validation.validationStatus,
      validationErrors,
      chromaKeyColor: chromaKey?.hex,
      chromaTolerance: chromaKey ? chromaTolerance : undefined,
      edgeResidueScore: Math.max(validation.edgeResidueScore ?? 0, sourceEdgeResidueScore),
      spillScore: chromaKey ? spillScore : undefined
    }
  };
}

export async function validateProcessedSprite(bytes: Uint8Array): Promise<SpriteValidation> {
  try {
    const image = sharp(Buffer.from(bytes)).ensureAlpha();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const raw = await image.raw().toBuffer();
    const pixels = new Uint8Array(raw);
    const bounds = findSubjectBounds(pixels, width, height);
    const opaquePixels = countOpaquePixels(pixels);
    const alphaCoverage = width > 0 && height > 0 ? opaquePixels / (width * height) : 0;
    const edgeResidueScore = measureCanvasEdgeResidue(pixels, width, height);
    const checkerboardResidueScore = measureCheckerboardResidue(pixels, width, height);
    const errors: string[] = [];
    if (!bounds) errors.push("Sprite PNG must contain a visible subject.");
    if (alphaCoverage < 0.05) errors.push("Sprite subject is too small after cutout.");
    if (alphaCoverage > 0.7) errors.push("Sprite background is not transparent enough.");
    if (edgeResidueScore > 0.005) errors.push("Sprite has edge residue after cutout.");
    if (checkerboardResidueScore > 0.04) errors.push("Sprite has checkerboard residue after cutout.");
    return {
      validationStatus: errors.length > 0 ? "failed" : "passed",
      validationErrors: errors,
      alphaCoverage,
      subjectBounds: bounds ?? { x: 0, y: 0, width: 0, height: 0 },
      width,
      height,
      hasAlpha: true,
      edgeResidueScore,
      subjectCoverage: alphaCoverage,
      checkerboardResidueScore
    };
  } catch (error) {
    return {
      validationStatus: "failed",
      validationErrors: [error instanceof Error ? error.message : String(error)],
      alphaCoverage: 0,
      subjectBounds: { x: 0, y: 0, width: 0, height: 0 },
      width: 0,
      height: 0,
      hasAlpha: false,
      edgeResidueScore: 0,
      subjectCoverage: 0,
      checkerboardResidueScore: 0
    };
  }
}

function failedResult(bytes: Uint8Array, outputExtension: string, message: string): CutoutResult {
  return {
    outputBytes: bytes,
    outputExtension,
    cutoutApplied: false,
    validation: {
      validationStatus: "failed",
      validationErrors: [message],
      alphaCoverage: 0,
      subjectBounds: { x: 0, y: 0, width: 0, height: 0 },
      width: 0,
      height: 0,
      hasAlpha: false,
      edgeResidueScore: 0,
      subjectCoverage: 0,
      checkerboardResidueScore: 0
    }
  };
}

function emptyValidation(): SpriteValidation {
  return {
    validationStatus: "passed",
    validationErrors: [],
    alphaCoverage: 0,
    subjectBounds: { x: 0, y: 0, width: 0, height: 0 },
    width: 0,
    height: 0,
    hasAlpha: false,
    edgeResidueScore: 0,
    subjectCoverage: 0,
    checkerboardResidueScore: 0
  };
}

function inferChromaKeyColor(
  pixels: Uint8Array,
  width: number,
  height: number
): { hex: string; color: [number, number, number] } | null {
  const samples = borderSamples(pixels, width, height);
  if (samples.length === 0) return null;
  let best: { key: { hex: string; color: [number, number, number] }; score: number } | null = null;
  for (const key of chromaKeys) {
    const hits = samples.filter((sample) => colorDistance(sample, key.color) <= 42).length;
    const score = hits / samples.length;
    if (!best || score > best.score) best = { key, score };
  }
  return best && best.score >= 0.25 ? best.key : null;
}

function borderSamples(pixels: Uint8Array, width: number, height: number): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];
  for (let x = 0; x < width; x += 1) {
    addOpaqueSample(samples, pixels, x * 4);
    addOpaqueSample(samples, pixels, ((height - 1) * width + x) * 4);
  }
  for (let y = 0; y < height; y += 1) {
    addOpaqueSample(samples, pixels, (y * width) * 4);
    addOpaqueSample(samples, pixels, (y * width + width - 1) * 4);
  }
  return samples;
}

function inferBorderColor(pixels: Uint8Array, width: number, height: number): [number, number, number] | null {
  const samples: Array<[number, number, number]> = [];
  for (let x = 0; x < width; x += 1) {
    addOpaqueSample(samples, pixels, (x * 4));
    addOpaqueSample(samples, pixels, ((height - 1) * width + x) * 4);
  }
  for (let y = 0; y < height; y += 1) {
    addOpaqueSample(samples, pixels, (y * width) * 4);
    addOpaqueSample(samples, pixels, (y * width + width - 1) * 4);
  }
  if (samples.length === 0) return [255, 255, 255];
  const total = samples.reduce(
    (sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]] as [number, number, number],
    [0, 0, 0] as [number, number, number]
  );
  return [
    Math.round(total[0] / samples.length),
    Math.round(total[1] / samples.length),
    Math.round(total[2] / samples.length)
  ];
}

function addOpaqueSample(samples: Array<[number, number, number]>, pixels: Uint8Array, offset: number) {
  if (pixels[offset + 3] < 200) return;
  samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
}

function inferCheckerboardColors(pixels: Uint8Array, width: number, height: number): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];
  const samplePoints = [
    [0, 0],
    [Math.max(0, width - 1), 0],
    [0, Math.max(0, height - 1)],
    [Math.max(0, width - 1), Math.max(0, height - 1)],
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
    [Math.max(0, width - 1), Math.floor(height / 2)]
  ];
  for (const [x, y] of samplePoints) {
    const offset = (y * width + x) * 4;
    if (pixels[offset + 3] < 200) continue;
    const color: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    if (!samples.some((item) => colorDistance(item, color) < 18)) samples.push(color);
  }
  return samples.slice(0, 4);
}

function isBackgroundPixel(
  pixels: Uint8Array,
  offset: number,
  background: [number, number, number],
  checkerboardColors: Array<[number, number, number]>
): boolean {
  const pixel: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  const distance = colorDistance(pixel, background);
  const checkerDistance = checkerboardColors.some((color) => colorDistance(pixel, color) <= 28);
  const isNeutral = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2]) < 12;
  const isNearWhite = pixel[0] > 235 && pixel[1] > 235 && pixel[2] > 235;
  const isNearBlack = pixel[0] < 18 && pixel[1] < 18 && pixel[2] < 18;
  return distance <= transparentThreshold || checkerDistance || (isNeutral && (isNearWhite || isNearBlack));
}

function applyChromaAlpha(pixels: Uint8Array, offset: number, chroma: [number, number, number]): boolean {
  const pixel: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  const distance = colorDistance(pixel, chroma);
  if (distance <= chromaTolerance) return true;
  if (distance > chromaSoftTolerance) return false;

  const dominantChannel = chroma[1] > chroma[0] && chroma[1] > chroma[2] ? 1 : chroma[0] > chroma[2] ? 0 : 2;
  const values = [pixel[0], pixel[1], pixel[2]];
  const otherMax = Math.max(...values.filter((_, index) => index !== dominantChannel));
  const chromaDominance = values[dominantChannel] - otherMax;
  if (chromaDominance < 24) return false;

  const fade = (distance - chromaTolerance) / (chromaSoftTolerance - chromaTolerance);
  pixels[offset + 3] = Math.min(pixels[offset + 3], Math.round(255 * fade));
  reduceChromaSpill(pixels, offset, chroma);
  return false;
}

function reduceChromaSpill(pixels: Uint8Array, offset: number, chroma: [number, number, number]): void {
  const dominantChannel = chroma[1] > chroma[0] && chroma[1] > chroma[2] ? 1 : chroma[0] > chroma[2] ? 0 : 2;
  const a = pixels[offset];
  const b = pixels[offset + 1];
  const c = pixels[offset + 2];
  const values = [a, b, c];
  const otherMax = Math.max(...values.filter((_, index) => index !== dominantChannel));
  if (values[dominantChannel] > otherMax + 36) {
    pixels[offset + dominantChannel] = Math.max(otherMax, values[dominantChannel] - 46);
  }
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function clampBounds(
  bounds: { left: number; top: number; width: number; height: number },
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(width - 1, bounds.left));
  const top = Math.max(0, Math.min(height - 1, bounds.top));
  return {
    left,
    top,
    width: Math.max(1, Math.min(bounds.width, width - left)),
    height: Math.max(1, Math.min(bounds.height, height - top))
  };
}

function findSubjectBounds(
  pixels: Uint8Array,
  width: number,
  height: number
): { left: number; top: number; width: number; height: number; x: number; y: number } | null {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

function countOpaquePixels(pixels: Uint8Array): number {
  let count = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 16) count += 1;
  }
  return count;
}

function measureSourceEdgeResidue(
  bounds: { left: number; top: number; width: number; height: number },
  width: number,
  height: number
): number {
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  const touches = bounds.left <= 1 || bounds.top <= 1 || right >= width - 1 || bottom >= height - 1;
  return touches ? 1 : 0;
}

function measureCanvasEdgeResidue(pixels: Uint8Array, width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  let edgePixels = 0;
  let opaqueEdgePixels = 0;
  const band = Math.min(3, Math.floor(Math.min(width, height) / 4));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= band && x < width - band && y >= band && y < height - band) continue;
      edgePixels += 1;
      if (pixels[(y * width + x) * 4 + 3] > 16) opaqueEdgePixels += 1;
    }
  }
  return edgePixels > 0 ? opaqueEdgePixels / edgePixels : 0;
}

function measureChromaSpill(pixels: Uint8Array, chroma: [number, number, number]): number {
  const dominantChannel = chroma[1] > chroma[0] && chroma[1] > chroma[2] ? 1 : chroma[0] > chroma[2] ? 0 : 2;
  let opaque = 0;
  let spill = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] <= 16) continue;
    opaque += 1;
    const pixel: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    const values = [pixel[0], pixel[1], pixel[2]];
    const otherMax = Math.max(...values.filter((_, index) => index !== dominantChannel));
    const chromaDominance = values[dominantChannel] - otherMax;
    if (values[dominantChannel] >= 150 && chromaDominance >= 38) spill += 1;
  }
  return opaque > 0 ? spill / opaque : 0;
}

function measureCheckerboardResidue(pixels: Uint8Array, width: number, height: number): number {
  let opaque = 0;
  let suspicious = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] <= 16) continue;
      opaque += 1;
      const pixel: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
      if (!isNeutralCheckerColor(pixel)) continue;
      if (hasNearbyCheckerContrast(pixels, width, height, x, y, pixel)) suspicious += 1;
    }
  }
  return opaque > 0 ? suspicious / opaque : 0;
}

function isNeutralCheckerColor(pixel: [number, number, number]): boolean {
  const max = Math.max(pixel[0], pixel[1], pixel[2]);
  const min = Math.min(pixel[0], pixel[1], pixel[2]);
  return max - min <= 18 && max >= 70 && max <= 225;
}

function hasNearbyCheckerContrast(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  pixel: [number, number, number]
): boolean {
  const neighbors = [
    [x + 4, y],
    [x - 4, y],
    [x, y + 4],
    [x, y - 4],
    [x + 8, y + 8],
    [x - 8, y - 8]
  ];
  return neighbors.some(([nx, ny]) => {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
    const offset = (ny * width + nx) * 4;
    if (pixels[offset + 3] <= 16) return false;
    const other: [number, number, number] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    return isNeutralCheckerColor(other) && colorDistance(pixel, other) >= 70;
  });
}

function extensionForContentType(contentType = ""): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "png";
}
