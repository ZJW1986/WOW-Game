import type { z } from "zod";
import type { ModelTaskRequest } from "./backend";

export interface GatewayTask<T> extends ModelTaskRequest {
  schema: z.ZodType<T>;
  fallback: T;
}

export interface GatewayResult<T> {
  id: string;
  status: "success" | "fallback";
  provider: string;
  model: string;
  taskType: ModelTaskRequest["taskType"];
  output: T;
  error?: string;
  costEstimate: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelGatewayOptions {
  provider?: (request: ModelTaskRequest) => Promise<string>;
}

export function createModelGateway(options: ModelGatewayOptions = {}) {
  return {
    async runModelTask<T>(task: GatewayTask<T>): Promise<GatewayResult<T>> {
      try {
        const raw = options.provider
          ? await options.provider(task)
          : JSON.stringify(task.fallback);
        const parsed = JSON.parse(raw) as unknown;
        const output = task.schema.parse(parsed);
        return {
          id: `model-${task.taskType}`,
          status: "success",
          provider: task.provider,
          model: task.model,
          taskType: task.taskType,
          output,
          costEstimate: estimateCost(task.prompt, raw)
        };
      } catch (error) {
        return {
          id: `model-${task.taskType}`,
          status: "fallback",
          provider: "mock",
          model: "schema-fallback",
          taskType: task.taskType,
          output: task.fallback,
          error: error instanceof Error ? error.message : String(error),
          costEstimate: estimateCost(task.prompt, JSON.stringify(task.fallback))
        };
      }
    }
  };
}

function estimateCost(input: string, output: string) {
  return {
    inputTokens: Math.ceil(input.length / 4),
    outputTokens: Math.ceil(output.length / 4)
  };
}
