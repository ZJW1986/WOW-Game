const baseUrl = process.env.WOW_VERIFY_URL || "http://localhost:5176/";
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || ".playwright-browsers";

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log(
      "[verify:browser] skipped: Playwright is not installed. Run `$env:PLAYWRIGHT_BROWSERS_PATH='.playwright-browsers'; npx playwright install chromium` before full browser acceptance."
    );
    return;
  }

  const browser = await launchAvailableBrowser(chromium);
  if (!browser) return;
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
    await ideaInput.fill("手机竖屏太空飞船躲避陨石收集能量");
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

    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowRight");
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

    console.log("[verify:browser] passed: 3D canvas, HUD, APP/Web aspect ratios, and keyboard movement verified.");
  } finally {
    await browser.close();
  }
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
