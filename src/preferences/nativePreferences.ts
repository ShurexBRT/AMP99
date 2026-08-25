import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState } from "react";
import {
  getPreferencesSnapshot,
  setPreference,
  usePreferences,
} from "./preferencesStore";

const ALWAYS_ON_TOP_EVENT = "amp99://always-on-top-changed";

export async function showPreferencesWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_preferences_window");
}

export async function hidePreferencesWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWebviewWindow().hide();
}

export async function startPreferencesWindowDrag(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWebviewWindow().startDragging();
}

export async function setNativeAlwaysOnTop(value: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_group_always_on_top_preference", { value });
}

export function useApplyNativePreferences(): void {
  const preferences = usePreferences();

  useEffect(() => {
    if (!isTauri()) return;
    void setNativeAlwaysOnTop(preferences.alwaysOnTop).catch((error) => {
      console.error("AMP99 could not apply Always on Top preference:", error);
    });
  }, [preferences.alwaysOnTop]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<boolean>(ALWAYS_ON_TOP_EVENT, (event) => {
      if (!disposed) setPreference("alwaysOnTop", Boolean(event.payload));
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}

export function useAmp99Version(): string {
  const [version, setVersion] = useState("0.2.0-alpha.5");

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    void getVersion()
      .then((value) => {
        if (!disposed) setVersion(value);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  return version;
}

export function currentPreferences(): ReturnType<typeof getPreferencesSnapshot> {
  return getPreferencesSnapshot();
}
