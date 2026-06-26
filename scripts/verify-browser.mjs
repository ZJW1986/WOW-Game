import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const baseUrl = process.env.WOW_VERIFY_URL || "http://localhost:5176/";
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || ".playwright-browsers";
const required = process.env.WOW_VERIFY_REQUIRED === "1";
const genre = readGenreArg(process.argv.slice(2));
const verificationProfile = createVerificationProfile(genre);
const startedAt = Date.now();

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    const message = "[verify:browser] skipped: Playwright is not installed. Run `$env:PLAYWRIGHT_BROWSERS_PATH='.playwright-browsers'; npx playwright install chromium` before full browser acceptance.";
    if (required) throw new Error(message);
    console.log(message);
    return;
  }

  const browser = await launchAvailableBrowser(chromium);
  if (!browser) {
    if (required) throw new Error("No browser could be launched while WOW_VERIFY_REQUIRED=1.");
    return;
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
    const ideaInput = page.locator("textarea").first();
    await ideaInput.fill(verificationProfile.idea);
    await ideaInput.fill("手机竖屏太空飞船躲避陨石收集能量");
    await ideaInput.fill(verificationProfile.idea);
    await clickFirst(page, [
      page.getByTestId("start-engine-threejs3d"),
      page.getByRole("button", { name: /3D 游戏|3D Three\.js/i })
    ]);
    await clickFirst(page, [
      page.getByTestId("start-create"),
      page.getByRole("button", { name: /创建|开始创作|Create/i })
    ]);
    await answerGuidedQuestions(page);

    const canvas = page.locator(".three-preview-canvas canvas").first();
    if ((await canvas.count()) === 0) {
      await clickFirst(page, [
        page.getByTestId("engine-threejs3d"),
        page.getByRole("button", { name: /3D 游戏|3D Three\.js/i })
      ]);
      await ensureActiveButton(page.getByTestId("viewport-app-9-16"), [
        page.getByRole("button", { name: /APP 9:16/i })
      ]);

      await clickFirst(page, [
        page.getByTestId("generate-three-mvp"),
        page.getByRole("button", { name: /生成 3D MVP|Create/i })
      ]);
    }
    await canvas.waitFor({ state: "visible", timeout: 20000 });
    const shell = page.locator(".three-preview-shell").first();
    await assertPreviewAspectRatio(shell, "app_9_16");
    await canvasSizeMatchesShell(canvas, shell);

    const startButton = page.getByTestId("three-preview-start").first();
    if (await startButton.isVisible()) await startButton.click();

    for (const key of verificationProfile.keys) {
      await page.keyboard.down(key);
      await page.waitForTimeout(verificationProfile.keyHoldMs);
      await page.keyboard.up(key);
    }
    await page.waitForTimeout(250);

    const moved = await page.locator("[data-player-moved='true']").first().count();
    const hudVisible = await page.locator(".three-preview-hud").first().isVisible();
    const canvasBox = await canvas.boundingBox();
    const mobileViewportChecked = canvasBox ? canvasBox.height > canvasBox.width : false;
    const canvasNonEmpty = await canvas.evaluate((node) => {
      const canvasElement = node;
      const context = canvasElement.getContext("2d");
      if (!context) return true;
      const { data } = context.getImageData(0, 0, Math.min(32, canvasElement.width), Math.min(32, canvasElement.height));
      return data.some((value) => value !== 0);
    });

    if (!hudVisible) throw new Error("3D HUD is not visible.");
    if (!canvasBox || canvasBox.width < 100 || canvasBox.height < 100) throw new Error("3D canvas is not measurable.");
    if (!canvasNonEmpty) throw new Error("3D canvas is blank.");
    if (!moved) throw new Error("Keyboard input did not move the 3D player.");
    if (!mobileViewportChecked) throw new Error("APP 9:16 viewport did not render as portrait.");

    await ensureActiveButton(page.getByTestId("viewport-web-16-9"), [
      page.getByRole("button", { name: /Web 16:9/i })
    ]);
    await page.waitForTimeout(350);
    await assertPreviewAspectRatio(shell, "web_16_9");
    await canvasSizeMatchesShell(canvas, shell);

    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(100);
    const movedAfterResize = await page.locator("[data-player-moved='true']").first().count();
    if (!movedAfterResize) throw new Error("Keyboard input did not work after switching to Web 16:9.");

    if (consoleErrors.length > 0) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
    const perfSample = await collectPerfSample(page, genre, startedAt);
    await writePerfBaseline("data/perf-baseline.json", perfSample);

    console.log(`[verify:browser] passed ${genre}: 3D canvas, HUD, APP/Web aspect ratios, and keyboard movement verified.`);
  } finally {
    await browser.close();
  }
}

function readGenreArg(args) {
  const raw = args.find((arg) => arg.startsWith("--genre="))?.slice("--genre=".length) || "flight";
  const aliases = {
    flight: "flight",
    flight_shooter: "flight",
    runner: "runner",
    td: "td",
    tower_defense: "td",
    futuristic_tower_defense: "td",
    topdown: "topdown",
    top_down: "topdown",
    platformer: "platformer",
    grid: "grid",
    grid_logic: "grid"
  };
  const genre = aliases[raw];
  if (!genre) {
    throw new Error(`Unsupported --genre=${raw}. Expected flight, runner, td, topdown, platformer, or grid.`);
  }
  return genre;
}

function createVerificationProfile(genre) {
  const profiles = {
    flight: {
      idea: "3D flight shooter: dodge asteroids, collect energy cores, avoid frontal hazards",
      keys: ["ArrowRight"],
      keyHoldMs: 500
    },
    runner: {
      idea: "3D runner: three-lane futuristic track, collect coins, jump gates and roadblocks",
      keys: ["ArrowRight", "Space"],
      keyHoldMs: 300
    },
    td: {
      idea: "3D futuristic tower defense: build laser towers and missile towers to defend the base",
      keys: ["ArrowRight"],
      keyHoldMs: 250
    },
    topdown: {
      idea: "2D top-down spaceship game: dodge asteroids and collect energy",
      keys: ["ArrowRight"],
      keyHoldMs: 350
    },
    platformer: {
      idea: "2D ninja platformer: jump over spikes, collect scrolls, reach the checkpoint",
      keys: ["ArrowRight", "Space"],
      keyHoldMs: 300
    },
    grid: {
      idea: "2D grid puzzle: push energy blocks onto target tiles with limited moves",
      keys: ["ArrowRight"],
      keyHoldMs: 350
    }
  };
  return profiles[genre] || profiles.flight;
}

async function collectPerfSample(page, genre, startedAtMs) {
  const browserPerf = await page.evaluate(() => {
    const paintEntries = performance.getEntriesByType("paint").map((entry) => ({
      name: entry.name,
      startTime: entry.startTime
    }));
    return {
      paintEntries,
      now: performance.now()
    };
  });
  const elapsedMs = Math.max(1, Date.now() - startedAtMs);
  const estimatedFps = Math.max(1, Math.min(60, Math.round(1000 / Math.max(16, browserPerf.now / 300))));
  return {
    genre,
    checkedAt: new Date().toISOString(),
    elapsedMs,
    estimatedFps,
    paintEntries: browserPerf.paintEntries
  };
}

async function writePerfBaseline(filePath, sample) {
  let previous = {};
  try {
    previous = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    previous = {};
  }
  const existing = previous[sample.genre];
  if (existing?.estimatedFps && sample.estimatedFps < existing.estimatedFps * 0.8) {
    throw new Error(
      `Performance regression for ${sample.genre}: fps ${sample.estimatedFps} is below baseline ${existing.estimatedFps}.`
    );
  }
  const next = {
    ...previous,
    [sample.genre]: {
      ...sample,
      baselineFps: Math.max(sample.estimatedFps, existing?.baselineFps ?? 0)
    }
  };
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function launchAvailableBrowser(chromium) {
  const attempts = [
    {
      name: "Playwright Chromium runtime",
      options: { headless: true }
    },
    {
      name: "system Microsoft Edge",
      options: { headless: true, channel: "msedge" }
    },
    {
      name: "system Google Chrome",
      options: { headless: true, channel: "chrome" }
    }
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.options);
      console.log(`[verify:browser] using ${attempt.name}.`);
      return browser;
    } catch (error) {
      failures.push(`${attempt.name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  console.log(
    "[verify:browser] skipped: no Playwright Chromium runtime, system Edge, or system Chrome could be launched."
  );
  console.log("[verify:browser] launch attempts:");
  for (const failure of failures) console.log(`  - ${failure}`);
  return null;
}

async function clickFirst(page, locators) {
  for (const locator of locators) {
    if ((await locator.count()) > 0) {
      await locator.first().click();
      return;
    }
  }
  throw new Error(`No matching clickable element found at ${page.url()}`);
}

async function ensureActiveButton(primaryLocator, fallbackLocators = []) {
  const locators = [primaryLocator, ...fallbackLocators];
  for (const locator of locators) {
    if ((await locator.count()) === 0) continue;
    const button = locator.first();
    const className = (await button.getAttribute("class")) || "";
    if (className.includes("active")) return;
    await button.click();
    return;
  }
  throw new Error("No matching button found.");
}

async function assertPreviewAspectRatio(shell, mode) {
  await shell.waitFor({ state: "visible", timeout: 5000 });
  const box = await readElementRect(shell);
  if (!box || box.width < 100 || box.height < 100) {
    throw new Error(`3D preview shell is not measurable in ${mode}: ${box ? `${box.width}x${box.height}` : "no box"}.`);
  }
  const actual = mode === "web_16_9" ? box.width / box.height : box.height / box.width;
  const expected = 16 / 9;
  if (Math.abs(actual - expected) > 0.08) {
    throw new Error(`3D preview ${mode} aspect ratio is ${actual.toFixed(2)}, expected ${expected.toFixed(2)}.`);
  }
}

async function canvasSizeMatchesShell(canvas, shell) {
  const canvasBox = await readElementRect(canvas);
  const shellBox = await readElementRect(shell);
  if (!canvasBox || !shellBox) throw new Error("Cannot compare 3D canvas and shell sizes.");
  const widthDelta = Math.abs(canvasBox.width - shellBox.width);
  const heightDelta = Math.abs(canvasBox.height - shellBox.height);
  if (widthDelta > 2 || heightDelta > 2) {
    throw new Error(
      `3D canvas size does not match shell: canvas ${canvasBox.width}x${canvasBox.height}, shell ${shellBox.width}x${shellBox.height}.`
    );
  }
}

async function readElementRect(locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    };
  });
}

async function answerGuidedQuestions(page) {
  for (let index = 0; index < 6; index += 1) {
    if ((await page.getByTestId("generate-three-mvp").count()) > 0) return;
    const pickForMe = page.getByTestId("idea-pick-for-me").first();
    if ((await pickForMe.count()) === 0) break;
    if (await pickForMe.isDisabled()) {
      await page.waitForTimeout(500);
      continue;
    }
    await pickForMe.click();
    await page.waitForTimeout(300);
  }
  const primaryAction = page.getByTestId("idea-primary-action").first();
  if ((await primaryAction.count()) > 0 && !(await primaryAction.isDisabled())) {
    await primaryAction.click();
    await page.waitForTimeout(1000);
  }
}

main().catch((error) => {
  console.error(`[verify:browser] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
