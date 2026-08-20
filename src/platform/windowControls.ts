import { isTauri } from "@tauri-apps/api/core";
import { getAllWindows, getCurrentWindow } from "@tauri-apps/api/window";

async function hideAuxiliaryWindows(): Promise<void> {
  for (const window of await getAllWindows()) {
    if (window.label === "equalizer" || window.label === "playlist") {
      await window.hide().catch(() => undefined);
    }
  }
}

export async function minimizeHostWindow(): Promise<void> {
  if (!isTauri()) return;
  await hideAuxiliaryWindows();
  await getCurrentWindow().minimize();
}

export async function hideHostWindowToTray(): Promise<void> {
  if (!isTauri()) return;
  for (const window of await getAllWindows()) {
    await window.hide().catch(() => undefined);
  }
}
