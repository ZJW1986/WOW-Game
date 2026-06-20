import type { AssetPack, SandboxPlugin, SandboxValidationResult } from "../core/types";
import { sandboxPluginSchema } from "../core/schemas";

const FORBIDDEN_PATTERNS = [
  /\bwindow\b/,
  /\bdocument\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/,
  /\bnew\s+Worker\b/
];

const DEFAULT_ALLOWED_APIS = new Set([
  "spawnEnemy",
  "spawnCollectible",
  "playEffect",
  "shakeCamera",
  "setStage",
  "emitProjectile",
  "showMessage"
]);

export function validateSandboxPlugin(payload: unknown, assetPack: AssetPack): SandboxValidationResult {
  const parsed = sandboxPluginSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      accepted: false,
      errors: parsed.error.issues.map((issue) => issue.message),
      referencedAssetKeys: [],
      fallbackLayer: "gameplay-dsl"
    };
  }

  const plugin = parsed.data;
  const errors = [
    ...forbiddenCodeErrors(plugin.code),
    ...disallowedApiErrors(plugin),
    ...missingAssetErrors(plugin, assetPack)
  ];

  return {
    accepted: errors.length === 0,
    errors,
    referencedAssetKeys: plugin.referencedAssetKeys,
    fallbackLayer: plugin.fallbackLayer
  };
}

function forbiddenCodeErrors(code: string): string[] {
  return FORBIDDEN_PATTERNS
    .filter((pattern) => pattern.test(code))
    .map((pattern) => `Forbidden sandbox code pattern: ${pattern.source}`);
}

function disallowedApiErrors(plugin: SandboxPlugin): string[] {
  return plugin.allowedApis
    .filter((api) => !DEFAULT_ALLOWED_APIS.has(api))
    .map((api) => `Disallowed sandbox API: ${api}`);
}

function missingAssetErrors(plugin: SandboxPlugin, assetPack: AssetPack): string[] {
  const assetKeys = new Set(assetPack.assets.map((asset) => asset.assetKey));
  return plugin.referencedAssetKeys
    .filter((assetKey) => !assetKeys.has(assetKey))
    .map((assetKey) => `Unknown sandbox assetKey: ${assetKey}`);
}
