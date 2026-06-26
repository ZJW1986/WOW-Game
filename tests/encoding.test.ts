import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "tests"];
const extensions = new Set([".ts", ".tsx"]);
const mojibakeMarkers = ["锟", "閿", "濡", "闁", "濞", "鑶"];

describe("source encoding", () => {
  it("keeps TypeScript sources free of common mojibake markers", () => {
    const offenders: string[] = [];
    for (const file of walkFiles(roots)) {
      if (file.endsWith("encoding.test.ts")) continue;
      const content = readFileSync(file, "utf8");
      if (mojibakeMarkers.some((marker) => content.includes(marker))) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});

function walkFiles(paths: string[]): string[] {
  const files: string[] = [];
  for (const path of paths) collect(path, files);
  return files;
}

function collect(path: string, files: string[]) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) collect(join(path, entry), files);
    return;
  }
  const dot = path.lastIndexOf(".");
  if (dot >= 0 && extensions.has(path.slice(dot))) files.push(path);
}
