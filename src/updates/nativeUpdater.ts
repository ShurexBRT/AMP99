import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "@tauri-apps/api/core";

type NativeUpdateListener = (update: Update | null) => void;

let lastNativeUpdate: Update | null = null;
let activeCheck: Promise<Update | null> | null = null;
const nativeUpdateListeners = new Set<NativeUpdateListener>();

function publishNativeUpdate(update: Update | null): void {
  lastNativeUpdate = update;
  nativeUpdateListeners.forEach((listener) => listener(update));
}

export async function checkForNativeAmp99Update(): Promise<Update | null> {
  if (!isTauri()) return null;
  if (activeCheck) return activeCheck;

  activeCheck = check()
    .then((update) => {
      publishNativeUpdate(update);
      return update;
    })
    .finally(() => {
      activeCheck = null;
    });

  return activeCheck;
}

export function getLastNativeAmp99Update(): Update | null {
  return lastNativeUpdate;
}

export function subscribeNativeAmp99Updates(
  listener: NativeUpdateListener,
): () => void {
  nativeUpdateListeners.add(listener);
  return () => nativeUpdateListeners.delete(listener);
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
