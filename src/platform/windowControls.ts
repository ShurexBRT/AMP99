import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function minimizeHostWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().minimize();
}

export async function hideHostWindowToTray(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().hide();
}
