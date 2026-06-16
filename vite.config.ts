import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createGenerationApiHandler } from "./src/services/generationApi";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "wow-game-generation-api",
      configureServer(server) {
        const handler = createGenerationApiHandler();
        server.middlewares.use("/api/generate-playable", async (req: any, res: any) => {
          const body = await readJsonBody(req);
          const response = await handler({
            method: req.method ?? "GET",
            path: "/api/generate-playable",
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
