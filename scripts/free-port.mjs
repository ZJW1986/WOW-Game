import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const port = Number(process.argv[2] || 5175);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`[free-port] invalid port: ${process.argv[2]}`);
  process.exit(1);
}

const pids = await findListeningPids(port);
for (const pid of pids) {
  try {
    await execFileAsync("taskkill", ["/f", "/pid", String(pid)]);
    console.log(`[free-port] killed PID ${pid} on port ${port}`);
  } catch (error) {
    console.warn(`[free-port] failed to kill PID ${pid}: ${readError(error)}`);
  }
}

async function findListeningPids(targetPort) {
  try {
    const { stdout } = await execFileAsync("netstat", ["-ano"]);
    const pids = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes(`:${targetPort}`) || !/\bLISTENING\b/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts.at(-1));
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch (error) {
    console.warn(`[free-port] netstat unavailable: ${readError(error)}`);
    return [];
  }
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}
