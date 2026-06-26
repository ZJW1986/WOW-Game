import { describe, expect, it } from "vitest";
import type { QaReport } from "../src/core/types";
import { createApiRouter } from "../src/services/api";
import { createInMemoryBackend } from "../src/services/backend";
import { evaluateVerificationGate } from "../src/services/verificationGate";

function report(overrides: Partial<QaReport["scores"]> = {}): QaReport {
  return {
    scores: {
      buildHealth: 92,
      visualUsability: 88,
      intentAlignment: 84,
      ...overrides
    },
    checks: [],
    debugProtocolEntries: []
  };
}

describe("verification publish gate", () => {
  it("marks reports below any hard threshold as not publishable", () => {
    const gate = evaluateVerificationGate(report({ visualUsability: 45 }));

    expect(gate.shouldPublish).toBe(false);
    expect(gate.dimensions.find((dimension) => dimension.id === "visualUsability")).toMatchObject({
      gate: true,
      passed: false,
      threshold: 60,
      score: 45
    });
    expect(gate.reasons).toContain("visualUsability below publish threshold: 45 < 60");
  });

  it("refuses to publish a version that fails the verification gate", async () => {
    const backend = createInMemoryBackend();
    const api = createApiRouter(backend);
    const project = backend.projects.createProject("make a broken test game");
    const version = backend.pipeline.generateVersion(project.id);
    const storedProject = backend.testing.getGeneratedProject(version.id);
    storedProject.qaReport = report({ buildHealth: 40 });

    const response = await api.handle("POST", "/api/publish", {
      versionId: version.id,
      visibility: "public",
      baseUrl: "https://wow-game.example"
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Verification gate failed");
    expect(response.body.reasons).toContain("buildHealth below publish threshold: 40 < 70");
  });
});
