import { chromium } from "playwright";

const port = Number(process.env.AMP99_WEBVIEW_DEBUG_PORT || "9222");
const endpoint = `http://127.0.0.1:${port}`;
const browser = await chromium.connectOverCDP(endpoint);

try {
  const pages = browser.contexts().flatMap((context) => context.pages());
  let mainPage = null;

  for (const page of pages) {
    if ((await page.locator('[data-window-id="main"]').count()) > 0) {
      mainPage = page;
      break;
    }
  }

  if (!mainPage) {
    throw new Error("AMP99 Main WebView was not found through WebView2 CDP.");
  }

  await mainPage
    .locator('button[aria-label="Minimize AMP99"]')
    .click();
} finally {
  await browser.close();
}
