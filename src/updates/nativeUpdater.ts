import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "@tauri-apps/api/core";

export async function checkForNativeAmp99Update(): Promise<Update | null> {
  if (!isTauri()) return null;
  return check();
}

export async function installNativeAmp99Update(
  update: Update,
  onProgress?: (downloadedBytes: number, contentLength: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
    }
    onProgress?.(downloaded, contentLength);
  });

  await relaunch();
}
