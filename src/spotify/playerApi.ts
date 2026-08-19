import { getSpotifyAccessToken } from "./auth";
import { SPOTIFY_API_BASE_URL } from "./config";
import { SpotifyApiError } from "./types";

async function playerRequest(
  path: string,
  init: RequestInit,
  allowAuthRetry = true,
): Promise<void> {
  const token = await getSpotifyAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${SPOTIFY_API_BASE_URL}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && allowAuthRetry) {
    await getSpotifyAccessToken({ forceRefresh: true });
    return playerRequest(path, init, false);
  }

  if (!response.ok) {
    let spotifyMessage: string | null = null;

    try {
      const payload = (await response.json()) as {
        error?: { message?: string; reason?: string } | string;
      };
      spotifyMessage =
        typeof payload.error === "object" ? payload.error?.message ?? null : null;
    } catch {
      // Keep the generic status message when Spotify returns no JSON body.
    }

    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;

    throw new SpotifyApiError(
      spotifyMessage || `Spotify Player API request failed with HTTP ${response.status}.`,
      {
        status: response.status,
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
        spotifyMessage,
        code: null,
      },
    );
  }
}

export async function transferSpotifyPlayback(
  deviceId: string,
  play = false,
): Promise<void> {
  await playerRequest("me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });
}

export async function startSpotifyTrack(
  deviceId: string,
  uri: string,
  positionMs = 0,
): Promise<void> {
  if (!uri.startsWith("spotify:track:")) {
    throw new Error("AMP99 can only start Spotify track URIs in this playback mode.");
  }

  const query = new URLSearchParams({ device_id: deviceId });
  await playerRequest(`me/player/play?${query.toString()}`, {
    method: "PUT",
    body: JSON.stringify({
      uris: [uri],
      position_ms: Math.max(0, Math.floor(positionMs)),
    }),
  });
}

export async function setSpotifyShuffle(
  deviceId: string,
  enabled: boolean,
): Promise<void> {
  const query = new URLSearchParams({
    device_id: deviceId,
    state: String(enabled),
  });
  await playerRequest(`me/player/shuffle?${query.toString()}`, { method: "PUT" });
}

export async function setSpotifyRepeat(
  deviceId: string,
  enabled: boolean,
): Promise<void> {
  const query = new URLSearchParams({
    device_id: deviceId,
    state: enabled ? "track" : "off",
  });
  await playerRequest(`me/player/repeat?${query.toString()}`, { method: "PUT" });
}
