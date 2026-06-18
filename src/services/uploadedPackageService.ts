import { strFromU8, unzipSync } from "fflate";
import type {
  AiPackageEditPlan,
  PackageHealthReport,
  RuntimeEntry,
  UploadedAssetIndex,
  UploadedPackageArtifacts,
  UploadedPackageFile,
  UploadedPackageManifest
} from "../core/types";

const MAX_FILE_COUNT = 300;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

export interface ParseUploadedPackageInput {
  packageName: string;
  packageFileName: string;
  packageBase64: string;
  projectId: string;
  versionId: string;
}

export interface ParsedUploadedPackage extends UploadedPackageArtifacts {
  extractedFiles: Array<{ path: string; bytes: Uint8Array }>;
}

export async function parseUploadedPackage(input: ParseUploadedPackageInput): Promise<ParsedUploadedPackage> {
  if (!input.packageFileName.toLowerCase().endsWith(".zip")) {
    throw new Error("Uploaded package must be a .zip file");
  }

  const entries = unzipSync(decodeBase64(input.packageBase64));
  const extractedFiles = Object.entries(entries)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, bytes]) => ({ path: normalizePackagePath(path), bytes }));

  if (extractedFiles.length === 0) {
    throw new Error("Uploaded package is empty");
  }
  if (extractedFiles.length > MAX_FILE_COUNT) {
    throw new Error(`Uploaded package has too many files: ${extractedFiles.length}`);
  }

  const totalSize = extractedFiles.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error("Uploaded package exceeds 20MB limit");
  }

  const files = extractedFiles.map(({ path, bytes }) => ({
    path,
    size: bytes.byteLength,
    type: classifyPackageFile(path)
  }));
  const entryFile = files.find((file) => file.path.toLowerCase() === "index.html");
  if (!entryFile) {
    throw new Error("Uploaded package must include index.html");
  }

  const indexHtml = strFromU8(extractedFiles.find((file) => file.path === entryFile.path)?.bytes ?? new Uint8Array());
  const assetIndex = createAssetIndex(files);
  const runtimeEntry = createRuntimeEntry({
    indexHtml,
    projectId: input.projectId,
    versionId: input.versionId,
    assetIndex
  });
  const healthReport = createHealthReport(files, runtimeEntry);
  const packageManifest: UploadedPackageManifest = {
    packageName: input.packageName,
    packageFileName: input.packageFileName,
    projectId: input.projectId,
    versionId: input.versionId,
    entry: "index.html",
    fileCount: files.length,
    totalSize,
    playable: healthReport.status !== "fail",
    files
  };

  return {
    extractedFiles,
    packageManifest,
    assetIndex,
    runtimeEntry,
    healthReport,
    aiEditPlan: createFallbackEditPlan(input.packageName, assetIndex, healthReport)
  };
}

export function createFallbackEditPlan(
  packageName: string,
  assetIndex: UploadedAssetIndex,
  healthReport: PackageHealthReport,
  userGoal = "优化上传游戏的第一版体验"
): AiPackageEditPlan {
  const editableAssets = [...assetIndex.images, ...assetIndex.audio];
  return {
    summary: `${packageName} 已完成本地解析。${userGoal}`,
    editableAssets,
    suggestedEdits:
      editableAssets.length > 0
        ? ["优先替换主角、背景、道具和 BGM/SFX 资源。", "保留入口文件和脚本结构，修改后重新运行健康检查。"]
        : ["当前包体没有可安全替换的图片或音频资源，建议先补充素材。"],
    risks: [...healthReport.errors, ...healthReport.warnings]
  };
}

function normalizePackagePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.length === 0 ||
    normalized.includes("../") ||
    normalized.startsWith("..") ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error(`Unsafe package path: ${path}`);
  }
  return normalized;
}

function classifyPackageFile(path: string): UploadedPackageFile["type"] {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "script";
  if (lower.endsWith(".css")) return "style";
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return "image";
  if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return "audio";
  if (/\.(woff2?|ttf|otf)$/.test(lower)) return "font";
  if (/\.(json|xml|csv|tmj|tsx)$/.test(lower)) return "data";
  return "other";
}

function createAssetIndex(files: UploadedPackageFile[]): UploadedAssetIndex {
  return {
    images: files.filter((file) => file.type === "image"),
    audio: files.filter((file) => file.type === "audio"),
    fonts: files.filter((file) => file.type === "font"),
    data: files.filter((file) => file.type === "data"),
    scripts: files.filter((file) => file.type === "script"),
    styles: files.filter((file) => file.type === "style")
  };
}

function createRuntimeEntry(input: {
  indexHtml: string;
  projectId: string;
  versionId: string;
  assetIndex: UploadedAssetIndex;
}): RuntimeEntry {
  return {
    entry: "index.html",
    entryUrl: `/uploads/${encodeURIComponent(input.projectId)}/${encodeURIComponent(input.versionId)}/files/index.html`,
    scripts: extractRefs(input.indexHtml, /<script[^>]+src=["']([^"']+)["']/gi),
    styles: extractRefs(input.indexHtml, /<link[^>]+href=["']([^"']+)["']/gi),
    images: extractRefs(input.indexHtml, /<(?:img|source)[^>]+src=["']([^"']+)["']/gi).filter((path) =>
      input.assetIndex.images.some((asset) => asset.path === path)
    ),
    audio: extractRefs(input.indexHtml, /<(?:audio|source)[^>]+src=["']([^"']+)["']/gi).filter((path) =>
      input.assetIndex.audio.some((asset) => asset.path === path)
    )
  };
}

function extractRefs(html: string, pattern: RegExp): string[] {
  const refs = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    if (match[1] && !/^https?:\/\//i.test(match[1]) && !match[1].startsWith("data:")) {
      refs.add(normalizePackagePath(match[1].split("?")[0].split("#")[0]));
    }
  }
  return [...refs];
}

function createHealthReport(files: UploadedPackageFile[], runtimeEntry: RuntimeEntry): PackageHealthReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filePaths = new Set(files.map((file) => file.path));

  if (!filePaths.has("index.html")) {
    errors.push("Missing index.html entry file");
  }
  for (const ref of [...runtimeEntry.scripts, ...runtimeEntry.styles, ...runtimeEntry.images, ...runtimeEntry.audio]) {
    if (!filePaths.has(ref)) {
      errors.push(`Referenced file is missing: ${ref}`);
    }
  }
  if (runtimeEntry.scripts.length === 0) {
    warnings.push("No script reference found in index.html");
  }

  return {
    status: errors.length > 0 ? "fail" : warnings.length > 0 ? "warning" : "pass",
    checks: ["index.html exists", "relative references checked", "asset files indexed"],
    errors,
    warnings
  };
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const bufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) return bufferCtor.from(normalized, "base64");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
