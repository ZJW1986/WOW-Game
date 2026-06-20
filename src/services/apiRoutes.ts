export function isWowGameApiPath(url: string): boolean {
  return (
    url.startsWith("/generate-playable") ||
    url.startsWith("/guided-questions") ||
    url.startsWith("/design-brief") ||
    url.startsWith("/asset-candidates") ||
    url.startsWith("/regenerate-asset-candidate") ||
    url.startsWith("/process-uploaded-material") ||
    url.startsWith("/revision-analysis") ||
    url.startsWith("/upload-package") ||
    url.startsWith("/package-edit-plan") ||
    url.startsWith("/replace-package-asset") ||
    url.startsWith("/uploads/") ||
    url.startsWith("/play/")
  );
}
