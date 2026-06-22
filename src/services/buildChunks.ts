export function createManualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("/phaser/") || id.includes("\\phaser\\")) return "phaser";
  if (id.includes("/three/") || id.includes("\\three\\")) return "three";
  if (
    id.includes("/react/") ||
    id.includes("\\react\\") ||
    id.includes("/react-dom/") ||
    id.includes("\\react-dom\\")
  ) {
    return "react-vendor";
  }
  return undefined;
}
