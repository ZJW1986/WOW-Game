import { createConversationSession } from "../core/conversation";
import type { PublishRecord } from "../core/types";
import { VerificationGateError, type createInMemoryBackend } from "./backend";

type Backend = ReturnType<typeof createInMemoryBackend>;

export interface ApiResponse<TBody = Record<string, any>> {
  status: number;
  body: TBody;
}

export function createApiRouter(backend: Backend) {
  return {
    async handle(method: string, path: string, body: Record<string, unknown>): Promise<ApiResponse> {
      if (method === "POST" && path === "/api/projects") {
        const project = backend.projects.createProject(requireString(body.idea, "idea"));
        return { status: 201, body: { project } };
      }

      if (method === "POST" && path === "/api/sessions") {
        const session = createConversationSession(requireString(body.idea, "idea"));
        return { status: 201, body: { session } };
      }

      const versionMatch = path.match(/^\/api\/projects\/([^/]+)\/versions$/);
      if (method === "POST" && versionMatch) {
        const version = backend.pipeline.generateVersion(versionMatch[1]);
        return { status: 201, body: { version } };
      }

      if (method === "POST" && path === "/api/publish") {
        try {
          const publishRecord = backend.play.publish(requireString(body.versionId, "versionId"), {
            visibility: optionalVisibility(body.visibility),
            baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined
          });
          return { status: 200, body: { publishRecord } };
        } catch (error) {
          if (error instanceof VerificationGateError) {
            return { status: 409, body: { error: "Verification gate failed", reasons: error.reasons } };
          }
          throw error;
        }
      }

      if (method === "POST" && path === "/api/feedback") {
        const feedback = backend.play.submitFeedback(requireString(body.versionId, "versionId"), {
          rating: requireNumber(body.rating, "rating"),
          comment: requireString(body.comment, "comment"),
          playerName: requireString(body.playerName, "playerName")
        });
        return { status: 201, body: { feedback } };
      }

      return {
        status: 404,
        body: { error: `No route for ${method} ${path}` }
      };
    }
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required string field: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing required number field: ${field}`);
  }
  return value;
}

function optionalVisibility(value: unknown): PublishRecord["visibility"] | undefined {
  if (value === "private" || value === "unlisted" || value === "public") {
    return value;
  }
  return undefined;
}
