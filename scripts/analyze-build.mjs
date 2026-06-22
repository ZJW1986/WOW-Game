import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "assets");

try {
  const files = await readdir(assetsDir);
  const rows = [];
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const info = await stat(join(assetsDir, file));
    rows.push({ file, kb: Math.round((info.size / 1024) * 10) / 10 });
  }
  rows.sort((left, right) => right.kb - left.kb);
  console.log("Build chunk summary:");
  for (const row of rows) {
    console.log(`${String(row.kb).padStart(8)} KB  ${row.file}`);
  }
} catch (error) {
  console.error(`Build analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
