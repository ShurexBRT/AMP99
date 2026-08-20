import { invoke, isTauri } from "@tauri-apps/api/core";
import { isOfficialAmp99ReleaseUrl } from "./githubUpdates";

export async function openOfficialAmp99Release(url: string): Promise<void> {
  if (!isOfficialAmp99ReleaseUrl(url)) {
    throw new Error("AMP99 refused to open a non-official release URL.");
  }

  if (isTauri()) {
    await invoke("open_official_amp99_release", { url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
