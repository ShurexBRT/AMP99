import { expect, test } from "@playwright/test";

const latestRelease = {
  tag_name: "v0.2.0-alpha.21",
  html_url: "https://github.com/ShurexBRT/AMP99/releases/tag/v0.2.0-alpha.21",
  prerelease: true,
  draft: false,
  published_at: "2026-08-31T00:00:00Z",
};

test.beforeEach(async ({ page }) => {
  await page.route("https://api.github.com/repos/ShurexBRT/AMP99/releases**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([latestRelease]),
    });
  });

  await page.goto("/");
});

test("browser fallback renders Main, Playlist and Equalizer controls", async ({ page }) => {
  const main = page.locator('[data-window-id="main"]');
  await expect(page.getByRole("region", { name: "AMP99 PLAYLIST EDITOR" })).toBeVisible();
  await expect(page.getByText("LOCAL DEMO QUEUE", { exact: false })).toBeVisible();
  await expect(main.getByRole("button", { name: "Playlist", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Equalizer", exact: true })).toBeVisible();

  const playlist = page.getByRole("region", { name: "AMP99 PLAYLIST EDITOR" });
  await expect(playlist).toBeVisible();
  await main.getByRole("button", { name: "Playlist", exact: true }).click();
  await expect(playlist).toBeHidden();
  await main.getByRole("button", { name: "Playlist", exact: true }).click();
  await expect(playlist).toBeVisible();
});

test("time display toggles between elapsed and remaining time", async ({ page }) => {
  const time = page.getByRole("button", { name: /Elapsed/ });
  await expect(time).toBeVisible();
  await time.click();
  await expect(page.getByRole("button", { name: /Remaining/ })).toBeVisible();
});

test("player state controls keep their rendered native-window contract", async ({ page }) => {
  const main = page.locator('[data-window-id="main"]');
  const desktop = page.locator(".desktop");

  await expect(desktop).toHaveAttribute("data-double-size", "false");
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await expect(desktop).toHaveAttribute("data-double-size", "true");

  await main.locator(".amp-titlebar").dblclick();
  await expect(main).toHaveAttribute("data-shaded", "true");
  await main.locator(".amp-titlebar").dblclick();
  await expect(main).toHaveAttribute("data-shaded", "false");
});

test("Main seek control follows the expanded player body", async ({ page }) => {
  const main = page.locator('[data-window-id="main"]');
  const seek = main.getByLabel("Seek");
  const initial = await seek.boundingBox();

  await main.evaluate((element) => {
    element.style.height = "320px";
  });

  const expanded = await seek.boundingBox();
  expect(initial).not.toBeNull();
  expect(expanded).not.toBeNull();
  expect(expanded!.y).toBeGreaterThan(initial!.y + 40);
});

test("Main display and outside volume follow the expanded player", async ({ page }) => {
  const main = page.locator('[data-window-id="main"]');
  const display = main.locator(".display-panel");
  const displayContent = main.locator(".display-content");
  const trackMarquee = main.locator(".track-marquee");
  const spectrum = main.locator(".fake-spectrum");
  const time = main.locator(".time-display");
  const volume = main.getByLabel("Volume");
  const initialDisplay = await display.boundingBox();
  const initialDisplayContent = await displayContent.boundingBox();
  const initialTrackMarquee = await trackMarquee.boundingBox();
  const initialSpectrum = await spectrum.boundingBox();
  const initialTimeFontSize = await time.evaluate((element) => getComputedStyle(element).fontSize);
  const initialVolume = await volume.boundingBox();

  await main.evaluate((element) => {
    element.style.width = "660px";
    element.style.height = "320px";
  });

  const expandedDisplay = await display.boundingBox();
  const expandedDisplayContent = await displayContent.boundingBox();
  const expandedTrackMarquee = await trackMarquee.boundingBox();
  const expandedSpectrum = await spectrum.boundingBox();
  const expandedTimeFontSize = await time.evaluate((element) => getComputedStyle(element).fontSize);
  const expandedVolume = await volume.boundingBox();
  const expandedMainBox = await main.boundingBox();
  expect(initialDisplay).not.toBeNull();
  expect(initialDisplayContent).not.toBeNull();
  expect(initialTrackMarquee).not.toBeNull();
  expect(initialSpectrum).not.toBeNull();
  expect(initialTimeFontSize).toBeTruthy();
  expect(initialVolume).not.toBeNull();
  expect(expandedDisplay).not.toBeNull();
  expect(expandedDisplayContent).not.toBeNull();
  expect(expandedTrackMarquee).not.toBeNull();
  expect(expandedSpectrum).not.toBeNull();
  expect(expandedTimeFontSize).toBe(initialTimeFontSize);
  expect(expandedVolume).not.toBeNull();
  expect(expandedDisplay!.width).toBeGreaterThan(initialDisplay!.width + 200);
  expect(expandedDisplay!.height).toBeGreaterThan(initialDisplay!.height + 50);

  const expandedDisplayCenterY = expandedDisplay!.y + expandedDisplay!.height / 2;
  const expandedContentCenterY = expandedDisplayContent!.y + expandedDisplayContent!.height / 2;
  expect(Math.abs(expandedContentCenterY - expandedDisplayCenterY)).toBeLessThan(2);
  expect(expandedDisplayContent!.y).toBeGreaterThan(initialDisplayContent!.y + 20);
  expect(expandedTrackMarquee!.x + expandedTrackMarquee!.width).toBeLessThanOrEqual(expandedSpectrum!.x + 1);
  expect(expandedTrackMarquee!.width).toBeGreaterThan(initialTrackMarquee!.width + 100);

  const displayCenterY = expandedDisplay!.y + expandedDisplay!.height / 2;
  const volumeCenterY = expandedVolume!.y + expandedVolume!.height / 2;
  expect(Math.abs(volumeCenterY - displayCenterY)).toBeLessThan(12);
  expect(expandedVolume!.x).toBeGreaterThan(expandedDisplay!.x);
  expect(expandedVolume!.width).toBeGreaterThan(initialVolume!.width + 50);
  expect(expandedMainBox).not.toBeNull();
  expect(expandedVolume!.x).toBeGreaterThan(expandedDisplay!.x + expandedDisplay!.width);
  expect(expandedVolume!.x + expandedVolume!.width).toBeLessThan(expandedMainBox!.x + expandedMainBox!.width - 8);
});

test("playlist filter and Preferences sections expose the designed states", async ({ page }) => {
  const playlist = page.getByRole("region", { name: "AMP99 PLAYLIST EDITOR" });
  const filter = page.getByLabel("Filter playlist", { exact: true });

  await filter.fill("debug");
  await expect(playlist.locator(".playlist-row")).toHaveCount(1);
  await expect(playlist.locator(".playlist-row").first()).toContainText("The Debuggers");

  await page.getByRole("button", { name: "LIST OPTS", exact: true }).click();
  await page.getByRole("button", { name: "Preferences...", exact: true }).click();
  await page.getByRole("button", { name: /^Appearance / }).click();
  await expect(page.locator(".preferences-pane-heading h1")).toHaveText("Appearance");
  await page.getByRole("button", { name: /^Spotify / }).click();
  await expect(page.locator(".preferences-pane-heading h1")).toHaveText("Spotify");
});

test("Preferences can be opened from the browser fallback and update check is user initiated", async ({ page }) => {
  await page.getByRole("button", { name: "LIST OPTS" }).click();
  await page.getByRole("button", { name: "Preferences..." }).click();

  await expect(page.getByRole("region", { name: "AMP99 Preferences" })).toBeVisible();
  await expect(page.getByText("AMP99 0.2.0-alpha.20", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "CHECK FOR UPDATES" }).click();
  await expect(page.getByText("UPDATE AVAILABLE: 0.2.0-ALPHA.21", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN RELEASE PAGE" })).toBeVisible();
  await expect(page.getByText("Updates are never downloaded or installed automatically in browser mode.")).toBeVisible();

  await page.getByRole("button", { name: "Close Preferences" }).click();
  await expect(page.getByRole("region", { name: "AMP99 PLAYLIST EDITOR" })).toBeVisible();
});
