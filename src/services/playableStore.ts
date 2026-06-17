import type { MockProject, PlayFeedback, PublishRecord } from "../core/types";

export interface PlayableStoreRecord {
  project: MockProject;
  publishRecord: PublishRecord;
  feedback: PlayFeedback[];
}

export interface PlayableStoreOptions {
  dataDir: string;
  writeText?: (filePath: string, content: string) => Promise<void>;
  readText?: (filePath: string) => Promise<string | null>;
  ensureDir?: (dirPath: string) => Promise<void>;
}

export function createPlayableStore(options: PlayableStoreOptions) {
  const io = {
    writeText: options.writeText ?? defaultWriteText,
    readText: options.readText ?? defaultReadText,
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
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as PlayableStoreRecord;
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
      const nextRecord: PlayableStoreRecord = {
        ...current,
        feedback: [...current.feedback, nextFeedback]
      };
      await this.savePlayable(nextRecord);
      return nextFeedback;
    }
  };
}

function projectJsonPath(dataDir: string, projectId: string, versionId: string): string {
  return [dataDir, "projects", projectId, "versions", versionId, "project.json"].join("/");
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

async function defaultEnsureDir(dirPath: string): Promise<void> {
  const { mkdir } = await loadFsPromises();
  await mkdir(dirPath, { recursive: true });
}

function dirname(filePath: string): string {
  return filePath.split("/").slice(0, -1).join("/");
}

async function loadFsPromises(): Promise<{
  mkdir: (path: string, options: { recursive: boolean }) => Promise<unknown>;
  readFile: (path: string, encoding: "utf8") => Promise<string>;
  writeFile: (path: string, content: string, encoding: "utf8") => Promise<unknown>;
}> {
  const load = new Function("return import('fs/promises')");
  return (await load()) as {
    mkdir: (path: string, options: { recursive: boolean }) => Promise<unknown>;
    readFile: (path: string, encoding: "utf8") => Promise<string>;
    writeFile: (path: string, content: string, encoding: "utf8") => Promise<unknown>;
  };
}
