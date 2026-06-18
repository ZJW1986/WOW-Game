import type { TemplateFamily } from "../core/types";

const FIXED_TIME = "2026-06-18T00:00:00.000Z";

export interface DebugProtocolEntry {
  errorSignature: string;
  templateFamily: TemplateFamily;
  failedStage: string;
  rootCause: string;
  verifiedFix: string;
  detectionRule: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hitCount: number;
}

export interface DebugProtocol {
  entries: DebugProtocolEntry[];
}

export interface DebugProtocolInput {
  errorSignature: string;
  templateFamily: TemplateFamily;
  failedStage: string;
  rootCause: string;
  verifiedFix: string;
  detectionRule: string;
}

export function createDebugProtocol(entries: DebugProtocolEntry[] = []): DebugProtocol {
  return { entries };
}

export function recordDebugProtocolEntry(
  protocol: DebugProtocol,
  input: DebugProtocolInput
): DebugProtocol {
  const existing = protocol.entries.find((entry) => entry.errorSignature === input.errorSignature);
  if (existing) {
    return {
      entries: protocol.entries.map((entry) =>
        entry.errorSignature === input.errorSignature
          ? {
              ...entry,
              ...input,
              firstSeenAt: entry.firstSeenAt,
              lastSeenAt: FIXED_TIME,
              hitCount: entry.hitCount + 1
            }
          : entry
      )
    };
  }
  return {
    entries: [
      ...protocol.entries,
      {
        ...input,
        firstSeenAt: FIXED_TIME,
        lastSeenAt: FIXED_TIME,
        hitCount: 1
      }
    ]
  };
}

export function summarizeDebugProtocol(protocol: DebugProtocol): string[] {
  return protocol.entries.map(
    (entry) => `${entry.errorSignature}: ${entry.verifiedFix} (${entry.hitCount}x)`
  );
}
