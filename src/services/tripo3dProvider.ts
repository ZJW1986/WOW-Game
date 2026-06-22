export interface Tripo3dOptions {
  apiKey?: string;
  baseUrl?: string;
  textModel?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export type TripoFetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface TripoTaskData {
  status: "queued" | "running" | "success" | "failed" | "cancelled" | string;
  progress?: number;
  output?: {
    model_url?: string;
    rendered_image_url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function createTripoOptions(env: Record<string, string | undefined>): Tripo3dOptions {
  return {
    apiKey: env.TRIPO_API_KEY,
    baseUrl: env.TRIPO_BASE_URL ?? "https://openapi.tripo3d.com",
    textModel: env.TRIPO_TEXT_MODEL ?? "v3.1-20260211",
    pollIntervalMs: parsePositiveInt(env.TRIPO_POLL_INTERVAL_MS, 2000),
    timeoutMs: parsePositiveInt(env.TRIPO_TIMEOUT_MS, 180000)
  };
}

export async function getTripoBalance(
  options: Tripo3dOptions,
  fetcher: TripoFetcher = fetch
): Promise<Record<string, unknown>> {
  const response = await fetcher(`${baseUrl(options)}/v3/account/balance`, {
    method: "GET",
    headers: tripoAuthHeaders(options)
  });
  return readTripoJson(response, "Tripo balance request failed");
}

export async function createTripoTextToModelTask(
  options: Tripo3dOptions,
  prompt: string,
  fetcher: TripoFetcher = fetch
): Promise<string> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) throw new Error("Tripo prompt is required");
  const response = await fetcher(`${baseUrl(options)}/v3/generation/text-to-model`, {
    method: "POST",
    headers: tripoJsonHeaders(options),
    body: JSON.stringify({
      prompt: normalizedPrompt,
      model: options.textModel ?? "v3.1-20260211"
    })
  });
  const payload = await readTripoJson(response, "Tripo text-to-model task creation failed");
  const taskId = readPath(payload, "data.task_id");
  if (typeof taskId !== "string" || !taskId) {
    throw new Error(`Tripo response missing task_id: ${JSON.stringify(payload)}`);
  }
  return taskId;
}

export async function getTripoTask(
  options: Tripo3dOptions,
  taskId: string,
  fetcher: TripoFetcher = fetch
): Promise<TripoTaskData> {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) throw new Error("Tripo taskId is required");
  const response = await fetcher(`${baseUrl(options)}/v3/tasks/${encodeURIComponent(normalizedTaskId)}`, {
    method: "GET",
    headers: tripoAuthHeaders(options)
  });
  const payload = await readTripoJson(response, "Tripo task request failed");
  const data = readPath(payload, "data");
  if (!isRecord(data)) {
    throw new Error(`Tripo response missing task data: ${JSON.stringify(payload)}`);
  }
  return data as TripoTaskData;
}

export async function pollTripoTask(
  options: Tripo3dOptions,
  taskId: string,
  fetcher: TripoFetcher = fetch
): Promise<TripoTaskData> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 180000;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  while (Date.now() - startedAt <= timeoutMs) {
    const task = await getTripoTask(options, taskId, fetcher);
    if (task.status === "success") return task;
    if (task.status === "failed" || task.status === "cancelled") {
      throw new Error(`Tripo task failed: ${JSON.stringify(task)}`);
    }
    if (pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
  throw new Error(`Tripo task timed out: ${taskId}`);
}

function baseUrl(options: Tripo3dOptions): string {
  return (options.baseUrl ?? "https://openapi.tripo3d.com").replace(/\/$/, "");
}

function tripoAuthHeaders(options: Tripo3dOptions): Record<string, string> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error("TRIPO_API_KEY is not configured");
  return { Authorization: `Bearer ${apiKey}` };
}

function tripoJsonHeaders(options: Tripo3dOptions): Record<string, string> {
  return {
    ...tripoAuthHeaders(options),
    "Content-Type": "application/json"
  };
}

async function readTripoJson(response: Response, errorPrefix: string): Promise<Record<string, unknown>> {
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload)) {
    throw new Error(`${errorPrefix}: invalid JSON response`);
  }
  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(`${errorPrefix}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
