import { getSpotifyAccessToken } from "./auth";
import { SPOTIFY_API_BASE_URL } from "./config";
import { SpotifyApiError } from "./types";

export type ReorderSpotifyPlaylistItemInput = {
  playlistId: string;
  rangeStart: number;
  insertBefore: number;
  rangeLength?: number;
  snapshotId?: string | null;
};

type SnapshotResponse = {
  snapshot_id?: string;
};

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

async function readSpotifyError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
    };
    return typeof payload.error === "object"
      ? payload.error?.message ?? null
      : null;
  } catch {
    return null;
  }
}

export async function reorderSpotifyPlaylistItem(
  input: ReorderSpotifyPlaylistItemInput,
  allowAuthRetry = true,
): Promise<string | null> {
  const playlistId = input.playlistId.trim();
  if (!playlistId) {
    throw new Error("playlistId is required.");
  }

  const rangeStart = nonNegativeInteger(input.rangeStart, "rangeStart");
  const insertBefore = nonNegativeInteger(input.insertBefore, "insertBefore");
  const rangeLength = nonNegativeInteger(input.rangeLength ?? 1, "rangeLength");
  if (rangeLength < 1) {
    throw new Error("rangeLength must be at least 1.");
  }

  const token = await getSpotifyAccessToken();
  const body: {
    range_start: number;
    insert_before: number;
    range_length: number;
    snapshot_id?: string;
  } = {
    range_start: rangeStart,
    insert_before: insertBefore,
    range_length: rangeLength,
  };

  if (input.snapshotId) {
    body.snapshot_id = input.snapshotId;
  }

  const response = await fetch(
    `${SPOTIFY_API_BASE_URL}/playlists/${encodeURIComponent(playlistId)}/items`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (response.status === 401 && allowAuthRetry) {
    await getSpotifyAccessToken({ forceRefresh: true });
    return reorderSpotifyPlaylistItem(input, false);
  }

  if (!response.ok) {
    const spotifyMessage = await readSpotifyError(response);
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;

    throw new SpotifyApiError(
      spotifyMessage || `Spotify playlist reorder failed with HTTP ${response.status}.`,
      {
        status: response.status,
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
        spotifyMessage,
        code: null,
      },
    );
  }

  const payload = (await response.json()) as SnapshotResponse;
  return payload.snapshot_id ?? null;
}
