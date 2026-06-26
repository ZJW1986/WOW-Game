import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

loadEnvFile(".env");
loadEnvFile(".env.local");

const outputPath = process.env.PROVIDER_HEALTH_PATH || "data/provider-health.json";
const now = new Date().toISOString();
const shouldPing = process.env.PROVIDER_HEALTH_PING === "1";

const report = {
  checkedAt: now,
  providers: {
    deepseek: await providerStatus({
      envKey: "DEEPSEEK_API_KEY",
      url: `${trimSlash(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com")}/models`
    }),
    agnes: await providerStatus({
      envKey: "IMAGE_API_KEY",
      url: `${trimSlash(process.env.IMAGE_BASE_URL || "")}${process.env.IMAGE_HEALTH_ENDPOINT || ""}`
    }),
    tripo: await providerStatus({
      envKey: "TRIPO_API_KEY",
      url: `${trimSlash(process.env.TRIPO_BASE_URL || "https://openapi.tripo3d.com")}/v3/account/balance`
    }),
    cellcog: await providerStatus({
      envKey: "CELLCOG_API_KEY",
      url: process.env.CELLCOG_HEALTH_URL || ""
    })
  }
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`[check-providers] wrote ${outputPath}`);

async function providerStatus({ envKey, url }) {
  const configured = Boolean(process.env[envKey]);
  const base = {
    configured,
    status: configured ? "configured" : "missing_key",
    checkedAt: now
  };
  if (!configured || !shouldPing) return base;
  if (!url) return { ...base, status: "configured", detail: "No health URL configured." };
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env[envKey]}` }
    });
    return {
      ...base,
      status: response.ok ? "ok" : "unhealthy",
      httpStatus: response.status
    };
  } catch (error) {
    return {
      ...base,
      status: "unreachable",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function trimSlash(value) {
  return value.replace(/\/$/, "");
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (process.env[key]) continue;
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}
