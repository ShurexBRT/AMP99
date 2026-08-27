import { expect, test } from "@playwright/test";

const latestRelease = {
  tag_name: "v0.2.0-alpha.17",
  html_url: "https://github.com/ShurexBRT/AMP99/releases/tag/v0.2.0-alpha.17",
  prerelease: true,
  draft: false,
  published_at: "2026-08-28T00:00:00Z",
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
  await expect(page.getByText("AMP99 0.2.0-alpha.16", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "CHECK FOR UPDATES" }).click();
  await expect(page.getByText("UPDATE AVAILABLE: 0.2.0-ALPHA.17", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN RELEASE PAGE" })).toBeVisible();
  await expect(page.getByText("Updates are never downloaded or installed automatically in browser mode.")).toBeVisible();

  await page.getByRole("button", { name: "Close Preferences" }).click();
  await expect(page.getByRole("region", { name: "AMP99 PLAYLIST EDITOR" })).toBeVisible();
});
