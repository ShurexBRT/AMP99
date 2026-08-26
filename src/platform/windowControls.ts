import { isTauri } from "@tauri-apps/api/core";
import { exit } from "@tauri-apps/plugin-process";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getPreferencesSnapshot } from "../preferences/preferencesStore";
import {
  hidePlayerWindowGroup,
  minimizeNativeWindowGroup,
} from "../windowing/nativeWindowHost";

export async function minimizeHostWindow(): Promise<void> {
  if (!isTauri()) return;
  if (await minimizeNativeWindowGroup()) return;
  await getCurrentWindow().minimize();
}

export async function hideHostWindowToTray(): Promise<void> {
  if (!isTauri()) return;
  await hidePlayerWindowGroup();
}

export async function closeHostWindow(): Promise<void> {
  if (!isTauri()) return;
  if (getPreferencesSnapshot().closeToTray) {
    await hideHostWindowToTray();
    return;
  }
  await exit(0);
}
