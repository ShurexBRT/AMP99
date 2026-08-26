import { useSyncExternalStore } from "react";

export type Amp99Preferences = {
  alwaysOnTop: boolean;
  closeToTray: boolean;
  startMinimized: boolean;
  rememberWindowPositions: boolean;
  restoreEqualizerOnStartup: boolean;
  restorePlaylistOnStartup: boolean;
  resumeLastQueue: boolean;
};

const STORAGE_KEY = "amp99.preferences.v1";
const CHANNEL_NAME = "amp99-preferences-v1";

export const DEFAULT_PREFERENCES: Amp99Preferences = {
  alwaysOnTop: false,
  closeToTray: false,
  startMinimized: false,
  rememberWindowPositions: true,
  restoreEqualizerOnStartup: true,
  restorePlaylistOnStartup: true,
  resumeLastQueue: false,
};

function normalizePreferences(value: unknown): Amp99Preferences {
  const candidate =
    value && typeof value === "object" ? (value as Partial<Amp99Preferences>) : {};

  return {
    alwaysOnTop:
      typeof candidate.alwaysOnTop === "boolean"
        ? candidate.alwaysOnTop
        : DEFAULT_PREFERENCES.alwaysOnTop,
    closeToTray:
      typeof candidate.closeToTray === "boolean"
        ? candidate.closeToTray
        : DEFAULT_PREFERENCES.closeToTray,
    startMinimized:
      typeof candidate.startMinimized === "boolean"
        ? candidate.startMinimized
        : DEFAULT_PREFERENCES.startMinimized,
    rememberWindowPositions:
      typeof candidate.rememberWindowPositions === "boolean"
        ? candidate.rememberWindowPositions
        : DEFAULT_PREFERENCES.rememberWindowPositions,
    restoreEqualizerOnStartup:
      typeof candidate.restoreEqualizerOnStartup === "boolean"
        ? candidate.restoreEqualizerOnStartup
        : DEFAULT_PREFERENCES.restoreEqualizerOnStartup,
    restorePlaylistOnStartup:
      typeof candidate.restorePlaylistOnStartup === "boolean"
        ? candidate.restorePlaylistOnStartup
        : DEFAULT_PREFERENCES.restorePlaylistOnStartup,
    resumeLastQueue:
      typeof candidate.resumeLastQueue === "boolean"
        ? candidate.resumeLastQueue
        : DEFAULT_PREFERENCES.resumeLastQueue,
  };
}

function parsePreferences(raw: string | null): Amp99Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readPreferences(): Amp99Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    return parsePreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let snapshot = readPreferences();
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

function notify() {
  for (const listener of listeners) listener();
}

function commit(next: Amp99Preferences, broadcast = true) {
  snapshot = normalizePreferences(next);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Preferences persistence must never make AMP99 unusable.
  }

  if (broadcast) channel?.postMessage(snapshot);
  notify();
}

channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
  const next = normalizePreferences(event.data);
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  commit(next, false);
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = parsePreferences(event.newValue);
    notify();
  });
}

export function getPreferencesSnapshot(): Amp99Preferences {
  return snapshot;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPreference<K extends keyof Amp99Preferences>(
  key: K,
  value: Amp99Preferences[K],
): void {
  if (snapshot[key] === value) return;
  commit({ ...snapshot, [key]: value });
}

export function replacePreferences(next: Amp99Preferences): void {
  commit(next);
}

export function resetPreferences(): void {
  commit(DEFAULT_PREFERENCES);
}

export function usePreferences(): Amp99Preferences {
  return useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    () => DEFAULT_PREFERENCES,
  );
}
