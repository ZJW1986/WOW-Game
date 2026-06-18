import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createGenerationApiHandler } from "./src/services/generationApi";
import { createDemoServerConfig } from "./src/services/demoServerConfig";
import { createPlayableStore } from "./src/services/playableStore";

export default defineConfig(({ mode }) => {
  const nodeProcess = globalThis as {
    process?: {
      cwd: () => string;
      env: Record<string, string | undefined>;
    };
  };
  const cwd = nodeProcess.process?.cwd() ?? ".";
  const processEnv = nodeProcess.process?.env ?? {};
  const fileEnv = loadEnv(mode, cwd, "");
  const serverEnv = {
    ...fileEnv,
    ...processEnv
  };

  return {
    server: createDemoServerConfig(),
    plugins: [
      react(),
      {
        name: "wow-game-generation-api",
        configureServer(server) {
          const handler = createGenerationApiHandler({ env: serverEnv });
          const store = createPlayableStore({ dataDir: serverEnv.DATA_DIR ?? "data" });
          server.middlewares.use("/uploads", async (req: any, res: any, next: () => void) => {
            const url = req.url ?? "";
            const match = url.match(/^\/([^/]+)\/([^/]+)\/files\/(.+)$/);
            if (!match) {
              next();
              return;
            }
            const bytes = await store.readUploadedPackageFile(match[1], match[2], decodeURIComponent(match[3]));
            if (!bytes) {
              next();
              return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", contentTypeForPath(match[3]));
            res.end(Buffer.from(bytes));
          });
          server.middlewares.use("/api", async (req: any, res: any, next: () => void) => {
            const url = req.url ?? "";
            if (
              !url.startsWith("/generate-playable") &&
              !url.startsWith("/guided-questions") &&
              !url.startsWith("/upload-package") &&
              !url.startsWith("/package-edit-plan") &&
              !url.startsWith("/replace-package-asset") &&
              !url.startsWith("/uploads/") &&
              !url.startsWith("/play/")
            ) {
              next();
              return;
            }
            const body = await readJsonBody(req);
            const response = await handler({
              method: req.method ?? "GET",
              path: `/api${url.split("?")[0]}`,
              body
            });
            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(response.body));
          });
        }
      }
    ],
    test: {
      environment: "jsdom",
      globals: true
    }
  };
});

async function readJsonBody(req: { on: (event: string, listener: (chunk?: unknown) => void) => void }) {
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    req.on("data", (chunk) => chunks.push(String(chunk ?? "")));
    req.on("end", () => resolve(chunks.join("")));
    req.on("error", (error) => reject(error));
  });
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function contentTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
