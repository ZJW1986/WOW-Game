import type { QaReport } from "../core/types";

export type VerificationGate = NonNullable<QaReport["gate"]>;

const publishThresholds = {
  buildHealth: 70,
  visualUsability: 60,
  intentAlignment: 60,
  coherence: 0.6
} as const;

export function evaluateVerificationGate(report: QaReport): VerificationGate {
  const coherenceScore = extractCoherenceScore(report);
  const dimensions = [
    {
      id: "buildHealth",
      score: report.scores.buildHealth,
      threshold: publishThresholds.buildHealth,
      gate: true,
      passed: report.scores.buildHealth >= publishThresholds.buildHealth
    },
    {
      id: "visualUsability",
      score: report.scores.visualUsability,
      threshold: publishThresholds.visualUsability,
      gate: true,
      passed: report.scores.visualUsability >= publishThresholds.visualUsability
    },
    {
      id: "intentAlignment",
      score: report.scores.intentAlignment,
      threshold: publishThresholds.intentAlignment,
      gate: true,
      passed: report.scores.intentAlignment >= publishThresholds.intentAlignment
    },
    {
      id: "coherence",
      score: coherenceScore,
      threshold: publishThresholds.coherence,
      gate: true,
      passed: coherenceScore >= publishThresholds.coherence
    }
  ];
  const reasons = dimensions
    .filter((dimension) => !dimension.passed)
    .map((dimension) => `${dimension.id} below publish threshold: ${dimension.score} < ${dimension.threshold}`);
  return {
    shouldPublish: reasons.length === 0,
    reasons,
    dimensions
  };
}

function extractCoherenceScore(report: QaReport): number {
  const coherenceEntry = report.debugProtocolEntries.find((entry) => entry.startsWith("visual-coherence:"));
  const score = coherenceEntry?.match(/score=([0-9.]+)/)?.[1];
  return score ? Number(score) : 1;
}
