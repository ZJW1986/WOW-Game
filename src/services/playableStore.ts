import type { MockProject, PlayFeedback, PublishRecord, UploadedPackageArtifacts } from "../core/types";

export interface PlayableStoreRecord {
  project: MockProject;
  publishRecord: PublishRecord;
  feedback: PlayFeedback[];
  uploadedPackage?: UploadedPackageArtifacts;
}

export interface PlayableStoreOptions {
  dataDir: string;
  writeText?: (filePath: string, content: string) => Promise<void>;
  readText?: (filePath: string) => Promise<string | null>;
  writeBytes?: (filePath: string, content: Uint8Array) => Promise<void>;
  readBytes?: (filePath: string) => Promise<Uint8Array | null>;
  ensureDir?: (dirPath: string) => Promise<void>;
}

export function createPlayableStore(options: PlayableStoreOptions) {
  const io = {
    writeText: options.writeText ?? defaultWriteText,
    readText: options.readText ?? defaultReadText,
    writeBytes: options.writeBytes ?? defaultWriteBytes,
    readBytes: options.readBytes ?? defaultReadBytes,
    ensureDir: options.ensureDir ?? defaultEnsureDir
  };

  return {
    async savePlayable(record: PlayableStoreRecord): Promise<void> {
      const filePath = projectJsonPath(options.dataDir, record.project.id, record.project.version.id);
      await io.ensureDir(dirname(filePath));
      await io.writeText(filePath, JSON.stringify(record, null, 2));
    },

    async readPlayable(projectId: string, versionId: string): Promise<PlayableStoreRecord | null> {
      const filePath = projectJsonPath(options.dataDir, projectId, versionId);
      const raw = await io.readText(filePath);
      return raw ? (JSON.parse(raw) as PlayableStoreRecord) : null;
    },

    async addFeedback(
      projectId: string,
      versionId: string,
      feedback: Omit<PlayFeedback, "createdAt" | "iterationSuggestion">
    ): Promise<PlayFeedback> {
      const current = await this.readPlayable(projectId, versionId);
      if (!current) {
        throw new Error(`Playable version not found: ${projectId}/${versionId}`);
      }
      const nextFeedback: PlayFeedback = {
        ...feedback,
        createdAt: new Date("2026-06-17T00:00:00.000Z").toISOString(),
        iterationSuggestion: `下一版可以根据“${feedback.comment}”优化节奏、数值和反馈。`
      };
      await this.savePlayable({
        ...current,
        feedback: [...current.feedback, nextFeedback]
      });
      return nextFeedback;
    },

    async saveUploadedPackageFiles(
      projectId: string,
      versionId: string,
      files: Array<{ path: string; bytes: Uint8Array }>
    ): Promise<void> {
      for (const file of files) {
        const filePath = uploadFilePath(options.dataDir, projectId, versionId, file.path);
        await io.ensureDir(dirname(filePath));
        await io.writeBytes(filePath, file.bytes);
      }
    },

    async readUploadedPackageFile(
      projectId: string,
      versionId: string,
      filePath: string
    ): Promise<Uint8Array | null> {
      return io.readBytes(uploadFilePath(options.dataDir, projectId, versionId, filePath));
    },

    async saveProjectAsset(
      projectId: string,
      versionId: string,
      assetPath: string,
      bytes: Uint8Array
    ): Promise<void> {
      const filePath = projectAssetPath(options.dataDir, projectId, versionId, assetPath);
      await io.ensureDir(dirname(filePath));
      await io.writeBytes(filePath, bytes);
    },

    async readProjectAsset(
      projectId: string,
      versionId: string,
      assetPath: string
    ): Promise<Uint8Array | null> {
      return io.readBytes(projectAssetPath(options.dataDir, projectId, versionId, assetPath));
    },

    async saveLibraryAsset(assetPath: string, bytes: Uint8Array): Promise<void> {
      const filePath = assetLibraryAssetPath(options.dataDir, assetPath);
      await io.ensureDir(dirname(filePath));
      await io.writeBytes(filePath, bytes);
    },

    async readLibraryAsset(assetPath: string): Promise<Uint8Array | null> {
      return io.readBytes(assetLibraryAssetPath(options.dataDir, assetPath));
    },

    async readAssetLibraryIndex(): Promise<unknown[]> {
      const raw = await io.readText(assetLibraryIndexPath(options.dataDir));
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    async saveAssetLibraryIndex(index: unknown[]): Promise<void> {
      const filePath = assetLibraryIndexPath(options.dataDir);
      await io.ensureDir(dirname(filePath));
      await io.writeText(filePath, JSON.stringify(index, null, 2));
    }
  };
}

function projectJsonPath(dataDir: string, projectId: string, versionId: string): string {
  return [dataDir, "projects", projectId, "versions", versionId, "project.json"].join("/");
}

function uploadFilePath(dataDir: string, projectId: string, versionId: string, filePath: string): string {
  return [dataDir, "uploads", projectId, versionId, "files", filePath].join("/");
}

function projectAssetPath(dataDir: string, projectId: string, versionId: string, assetPath: string): string {
  return [dataDir, "projects", projectId, "versions", versionId, "assets", assetPath].join("/");
}

function assetLibraryAssetPath(dataDir: string, assetPath: string): string {
  return [dataDir, "asset-library", "assets", assetPath].join("/");
}

function assetLibraryIndexPath(dataDir: string): string {
  return [dataDir, "asset-library", "asset-library-index.json"].join("/");
}

async function defaultWriteText(filePath: string, content: string): Promise<void> {
  const { mkdir, writeFile } = await loadFsPromises();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function defaultReadText(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await loadFsPromises();
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function defaultWriteBytes(filePath: string, content: Uint8Array): Promise<void> {
  const { mkdir, writeFile } = await loadFsPromises();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function defaultReadBytes(filePath: string): Promise<Uint8Array | null> {
  try {
    const { readFile } = await loadFsPromises();
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function defaultEnsureDir(dirPath: string): Promise<void> {
  const { mkdir } = await loadFsPromises();
  await mkdir(dirPath, { recursive: true });
}

function dirname(filePath: string): string {
  return filePath.split("/").slice(0, -1).join("/");
}

async function loadFsPromises(): Promise<{
  mkdir: (path: string, options: { recursive: boolean }) => Promise<unknown>;
  readFile: {
    (path: string, encoding: "utf8"): Promise<string>;
    (path: string): Promise<Uint8Array>;
  };
  writeFile: {
    (path: string, content: string, encoding: "utf8"): Promise<unknown>;
    (path: string, content: Uint8Array): Promise<unknown>;
  };
}> {
  const load = new Function("return import('fs/promises')");
  return (await load()) as {
    mkdir: (path: string, options: { recursive: boolean }) => Promise<unknown>;
    readFile: {
      (path: string, encoding: "utf8"): Promise<string>;
      (path: string): Promise<Uint8Array>;
    };
    writeFile: {
      (path: string, content: string, encoding: "utf8"): Promise<unknown>;
      (path: string, content: Uint8Array): Promise<unknown>;
    };
  };
}
