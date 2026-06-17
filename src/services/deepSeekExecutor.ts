import type { ModelTaskRequest } from "./backend";

export interface DeepSeekExecutorOptions {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: (request: {
    url: string;
    init: {
      method: "POST";
      headers: Record<string, string>;
      body: string;
    };
  }) => Promise<string>;
}

export interface DeepSeekJsonTask {
  taskType: ModelTaskRequest["taskType"];
  prompt: string;
  model: string;
}

export interface DeepSeekJsonResult {
  status: "success" | "missing-api-key" | "error";
  rawJson: string;
  error?: string;
}

export function createDeepSeekExecutor(options: DeepSeekExecutorOptions = {}) {
  return {
    async runJsonTask(task: DeepSeekJsonTask): Promise<DeepSeekJsonResult> {
      if (!options.apiKey) {
        return {
          status: "missing-api-key",
          rawJson: "",
          error: "DEEPSEEK_API_KEY is required for real model execution"
        };
      }

      const baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
      const request = {
        url: `${baseUrl}/chat/completions`,
        init: {
          method: "POST" as const,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`
          },
          body: JSON.stringify({
            model: task.model,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Return strict JSON artifacts for WOW Game. Do not generate Phaser lifecycle code."
              },
              { role: "user", content: task.prompt }
            ]
          })
        }
      };

      try {
        const raw = options.fetcher
          ? await options.fetcher(request)
          : await defaultFetch(request.url, request.init);
        const parsed = JSON.parse(raw) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = parsed.choices?.[0]?.message?.content;
        if (!content) {
          return { status: "error", rawJson: raw, error: "DeepSeek response missing choices[0].message.content" };
        }
        const jsonContent = extractJsonContent(content);
        JSON.parse(jsonContent);
        return { status: "success", rawJson: jsonContent };
      } catch (error) {
        return {
          status: "error",
          rawJson: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

async function defaultFetch(
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string }
): Promise<string> {
  const response = await fetch(url, init);
  return response.text();
}

function extractJsonContent(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return trimmed;
}
