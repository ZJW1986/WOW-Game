export function isWowGameApiPath(url: string): boolean {
  return (
    url.startsWith("/generate-playable") ||
    url.startsWith("/generate-three-game") ||
    url.startsWith("/three-asset-candidates") ||
    url.startsWith("/verify-three-game") ||
    url.startsWith("/tripo/") ||
    url.startsWith("/guided-questions") ||
    url.startsWith("/provider-health") ||
    url.startsWith("/design-brief") ||
    url.startsWith("/asset-candidates") ||
    url.startsWith("/generate-production-brief") ||
    url.startsWith("/generate-game-dev-prompt-bundle") ||
    url.startsWith("/generate-ui-asset-kit") ||
    url.startsWith("/generate-audio-prompt-pack") ||
    url.startsWith("/generate-model-prompt-pack") ||
    url.startsWith("/cellcog/") ||
    url.startsWith("/replace-asset-candidate") ||
    url.startsWith("/regenerate-asset-candidate") ||
    url.startsWith("/regenerate-three-asset-candidate") ||
    url.startsWith("/process-uploaded-material") ||
    url.startsWith("/revision-analysis") ||
    url.startsWith("/upload-package") ||
    url.startsWith("/package-edit-plan") ||
    url.startsWith("/replace-package-asset") ||
    url.startsWith("/uploads/") ||
    url.startsWith("/play/")
  );
}
