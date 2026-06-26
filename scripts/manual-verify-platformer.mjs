// One-shot manual E2E for stage A platformer.
// Run: node scripts/manual-verify-platformer.mjs <seed>
// Captures: data/manual-verify/<seed>-*.png + a summary JSON.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const seedId = Number(process.argv[2] ?? "1");
const baseUrl = process.env.WOW_VERIFY_URL || "http://localhost:5175/";
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || ".playwright-browsers";
const outDir = `data/manual-verify/seed-${seedId}`;
const seeds = [
  "做一个跳跃收集金币到终点的森林游戏",
  "make a forest platformer with hidden coins and spike traps",
  "做一个霓虹城市的横版跑酷收集发光道具"
];
const seedText = seeds[seedId - 1];
if (!seedText) {
  console.error(`Unknown seed id ${seedId}. Available: 1..${seeds.length}`);
  process.exit(2);
}

const log = (msg) => console.log(`[seed-${seedId}] ${msg}`);
const summary = { seedId, seedText, baseUrl, steps: [], startedAt: new Date().toISOString() };
const record = (name, ok, detail = "") => {
  summary.steps.push({ name, ok, detail, at: new Date().toISOString() });
  log(`${ok ? "OK" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
};

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function snap(page, name) {
  const path = `${outDir}/${name}.png`;
  await ensureDir(path);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function launchBrowser(chromium) {
  const attempts = [
    { name: "Playwright Chromium", options: { headless: true } },
    { name: "system Edge", options: { headless: true, channel: "msedge" } },
    { name: "system Chrome", options: { headless: true, channel: "chrome" } }
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.options);
      log(`using ${attempt.name}`);
      return browser;
    } catch (e) {
      failures.push(`${attempt.name}: ${e.message?.split("\n")[0]}`);
    }
  }
  console.error("no browser available:");
  for (const f of failures) console.error("  - " + f);
  return null;
}

async function clickFirst(page, locators, label) {
  for (const l of locators) {
    if ((await l.count()) > 0) {
      await l.first().click();
      return true;
    }
  }
  throw new Error(`No clickable element found for ${label} at ${page.url()}`);
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    record("import-playwright", false, "playwright module not installed");
    return;
  }
  const browser = await launchBrowser(chromium);
  if (!browser) {
    record("launch-browser", false, "no chromium / edge / chrome available");
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
    record("goto", true, baseUrl);
    await snap(page, "01-loaded");

    // Step 1: textarea -> fill idea
    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    await textarea.fill(seedText);
    record("fill-idea", true, seedText);

    // Step 2: choose 2D Phaser engine via stable testId
    const phaser2dButton = page.getByTestId("start-engine-phaser2d").first();
    try {
      await phaser2dButton.waitFor({ state: "visible", timeout: 5000 });
      await phaser2dButton.click();
      record("select-engine-2d", true);
    } catch (e) {
      record("select-engine-2d", false, e.message);
    }
    await snap(page, "02-after-engine");

    // Step 3: click create / 开始创作
    try {
      await clickFirst(page, [
        page.getByTestId("start-create"),
        page.getByRole("button", { name: /创建|开始创作|Create|生成/i })
      ], "start-create");
      record("start-create", true);
    } catch (e) {
      record("start-create", false, e.message);
      await snap(page, "03-create-failed");
      return;
    }

    // Step 4: drive the whole Studio flow with a state-machine loop.
    let iterations = 0;
    let actions = { pick: 0, primary: 0, confirm: 0, idle: 0 };
    let lastConfirmLabel = "";
    let lastConfirmAt = 0;
    const maxIterations = 200;
    for (let i = 0; i < maxIterations; i += 1) {
      iterations += 1;
      if ((await page.locator(".game-frame").count()) > 0) break;

      const confirmBtn = page
        .locator(".asset-candidate-header button")
        .filter({ hasText: /确认/ })
        .first();
      if ((await confirmBtn.count()) > 0 && !(await confirmBtn.isDisabled())) {
        const label = ((await confirmBtn.textContent()) || "").trim();
        // If we just clicked the same label seconds ago, give the backend longer to refresh
        if (label === lastConfirmLabel && Date.now() - lastConfirmAt < 4000) {
          await page.waitForTimeout(3000);
          continue;
        }
        await confirmBtn.click();
        actions.confirm += 1;
        lastConfirmLabel = label;
        lastConfirmAt = Date.now();
        log(`[iter ${i}] confirm clicked (${label})`);
        await page.waitForTimeout(6000);
        continue;
      }

      const pick = page.getByTestId("idea-pick-for-me").first();
      const primary = page.getByTestId("idea-primary-action").first();
      const pickReady = (await pick.count()) > 0 && !(await pick.isDisabled());
      const primaryReady = (await primary.count()) > 0 && !(await primary.isDisabled());

      if (actions.pick < 6 && pickReady) {
        await pick.click();
        actions.pick += 1;
        await page.waitForTimeout(500);
        continue;
      }
      if (primaryReady) {
        const label = ((await primary.textContent()) || "").trim();
        await primary.click();
        actions.primary += 1;
        log(`[iter ${i}] primary clicked (${label})`);
        await page.waitForTimeout(4500);
        continue;
      }
      actions.idle += 1;
      if (i === 20 || i === 50 || i === 100 || i === 150) {
        const debug = await page.evaluate(() => ({
          confirmButtonText: document.querySelector(".asset-candidate-header button")?.textContent?.trim() ?? null,
          confirmDisabled: document.querySelector(".asset-candidate-header button")?.disabled ?? null,
          pickDisabled: document.querySelector('[data-testid="idea-pick-for-me"]')?.disabled,
          primaryDisabled: document.querySelector('[data-testid="idea-primary-action"]')?.disabled,
          primaryLabel: document.querySelector('[data-testid="idea-primary-action"]')?.textContent?.trim() ?? null,
          bodyHead: document.body.innerText.slice(0, 240).replace(/\s+/g, " ")
        }));
        log(`[iter ${i}] debug: ${JSON.stringify(debug)}`);
      }
      await page.waitForTimeout(1500);
    }
    record("studio-flow-loop", true, `iterations=${iterations}, actions=${JSON.stringify(actions)}`);
    await snap(page, "04-after-flow");

    // Step 6: wait for game-frame to appear
    const gameFrame = page.locator(".game-frame").first();
    try {
      await gameFrame.waitFor({ state: "visible", timeout: 60000 });
      const phase = await gameFrame.getAttribute("data-runtime-phase");
      record("game-frame-rendered", true, `phase=${phase}`);
    } catch (e) {
      record("game-frame-rendered", false, e.message);
      await snap(page, "05-no-game-frame");
      // dump for debugging
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      await writeFile(`${outDir}/dom-snapshot.txt`, bodyText, "utf8");
      return;
    }
    await snap(page, "05-game-frame-idle");

    // Step 7: start the game
    await gameFrame.click();
    await page.waitForTimeout(500);
    const phaseAfter = await gameFrame.getAttribute("data-runtime-phase");
    record("game-frame-after-click", phaseAfter === "playing", `phase=${phaseAfter}`);

    // Step 8: simulate keyboard input for 90 seconds; check phase transitions
    const startedAt = Date.now();
    let endPhase = phaseAfter;
    let stagePhaseLog = [];
    while (Date.now() - startedAt < 90000) {
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(180);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.press("Space");
      await page.waitForTimeout(160);
      endPhase = await gameFrame.getAttribute("data-runtime-phase");
      if (endPhase === "won" || endPhase === "lost") break;
      if (stagePhaseLog.length === 0 || Date.now() - stagePhaseLog[stagePhaseLog.length - 1].at > 5000) {
        stagePhaseLog.push({ at: Date.now(), phase: endPhase, elapsedMs: Date.now() - startedAt });
      }
    }
    record("game-reached-terminal", endPhase === "won" || endPhase === "lost", `final=${endPhase}, duration=${Date.now() - startedAt}ms`);
    await snap(page, "06-after-play");

    // Step 9: check for ScoreTierOverlay
    const overlay = page.locator(".score-tier-overlay").first();
    const overlayCount = await overlay.count();
    if (overlayCount === 0) {
      record("score-tier-overlay-visible", false, "no .score-tier-overlay element");
    } else {
      const award = await overlay.getAttribute("data-award");
      const filledStars = await overlay.locator(".score-tier-star.is-filled").count();
      const stats = await overlay.locator(".score-tier-stats dd").allTextContents();
      record("score-tier-overlay-visible", true, `award=${award}, stars=${filledStars}, stats=[${stats.join(", ")}]`);
      await snap(page, "07-overlay");

      // Step 10: try restart
      const restartButton = overlay.locator("button.is-primary").first();
      if ((await restartButton.count()) > 0) {
        await restartButton.click();
        await page.waitForTimeout(800);
        const afterRestart = await gameFrame.getAttribute("data-runtime-phase");
        record("restart-button", afterRestart === "playing" || afterRestart === "idle", `phase after restart=${afterRestart}`);
      } else {
        record("restart-button", false, "no primary button");
      }
      await snap(page, "08-after-restart");
    }

    if (consoleErrors.length > 0) {
      record("console-errors", false, consoleErrors.slice(0, 3).join(" | "));
    } else {
      record("console-errors", true, "0");
    }
  } catch (e) {
    record("uncaught", false, e.message);
    await snap(page, "99-error");
  } finally {
    summary.endedAt = new Date().toISOString();
    await ensureDir(`${outDir}/summary.json`);
    await writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
    await browser.close();
    log(`done. summary -> ${outDir}/summary.json`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
