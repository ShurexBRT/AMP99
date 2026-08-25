import { invoke, isTauri } from "@tauri-apps/api/core";

const BROWSER_SESSION_STORAGE_KEY = "amp99.spotify.session.v1";

export async function readSpotifySessionRaw(): Promise<string | null> {
  if (isTauri()) {
    const protectedSession = await invoke<string | null>("read_secure_spotify_session");
    if (protectedSession) return protectedSession;

    // Migrate the alpha-era WebView token once, then remove the plaintext copy.
    const legacySession = window.localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
    if (legacySession) {
      await invoke("write_secure_spotify_session", { session: legacySession });
      window.localStorage.removeItem(BROWSER_SESSION_STORAGE_KEY);
      return legacySession;
    }

    return null;
  }

  return window.localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
}

export async function writeSpotifySessionRaw(session: string): Promise<void> {
  if (isTauri()) {
    await invoke("write_secure_spotify_session", { session });
    return;
  }

  window.localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, session);
}

export async function deleteSpotifySessionRaw(): Promise<void> {
  if (isTauri()) {
    await invoke("delete_secure_spotify_session");
    return;
  }

  window.localStorage.removeItem(BROWSER_SESSION_STORAGE_KEY);
}
