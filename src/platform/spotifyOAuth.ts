import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const SPOTIFY_OAUTH_CALLBACK_EVENT = "amp99://spotify-oauth-callback";
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as TauriWindow).__TAURI_INTERNALS__)
  );
}

export async function runNativeSpotifyAuthorization(
  authorizationUrl: string,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Native Spotify authorization requires the AMP99 desktop app.");
  }

  let unlisten: UnlistenFn | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return new Promise<string>(async (resolve, reject) => {
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      unlisten?.();
      unlisten = null;
    };

    try {
      // Subscribe before opening the system browser so an unusually fast callback
      // cannot race past the webview listener.
      unlisten = await listen<string>(SPOTIFY_OAUTH_CALLBACK_EVENT, (event) => {
        cleanup();
        resolve(event.payload);
      });

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Spotify sign-in timed out. Start the connection again."));
      }, CALLBACK_TIMEOUT_MS);

      await invoke("start_spotify_oauth", { authorizationUrl });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
