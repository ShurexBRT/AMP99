import { SPOTIFY_API_BASE_URL } from "./config";
import { getSpotifyAccessToken } from "./auth";
import {
  SpotifyApiError,
  type SpotifyPage,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrackPage,
  type SpotifyTrack,
  type SpotifyUserProfile,
} from "./types";

const DEFAULT_PAGE_LIMIT = 50;

type RawSpotifyImage = {
  url?: string;
};

type RawSpotifyArtist = {
  name?: string;
};

type RawSpotifyTrack = {
  id?: string | null;
  uri?: string;
  name?: string;
  type?: string;
  duration_ms?: number;
  is_local?: boolean;
  external_urls?: { spotify?: string };
  artists?: RawSpotifyArtist[];
  album?: {
    id?: string | null;
    name?: string;
    images?: RawSpotifyImage[];
  };
};

type RawSpotifyPlaylist = {
  id?: string;
  name?: string;
  description?: string;
  public?: boolean | null;
  collaborative?: boolean;
  uri?: string;
  snapshot_id?: string;
  external_urls?: { spotify?: string };
  images?: RawSpotifyImage[];
  owner?: {
    id?: string;
    display_name?: string | null;
  };
  items?: { total?: number };
  tracks?: { total?: number };
};

type RawSpotifyPage<T> = {
  items?: T[];
  limit?: number;
  offset?: number;
  total?: number;
  next?: string | null;
};

type RawSavedTrack = {
  track?: RawSpotifyTrack | null;
};

type RawPlaylistItem = {
  item?: RawSpotifyTrack | null;
  track?: RawSpotifyTrack | null;
};

type RawUserProfile = {
  id?: string;
  display_name?: string | null;
  product?: string;
  country?: string;
  external_urls?: { spotify?: string };
};

type PageOptions = {
  limit?: number;
  offset?: number;
};

export type CreateSpotifyPlaylistInput = {
  name: string;
  isPublic?: boolean;
  description?: string;
};

function normalizePageOptions(options?: PageOptions): Required<PageOptions> {
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(options?.limit ?? DEFAULT_PAGE_LIMIT)),
  );
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));

  return { limit, offset };
}

function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    const base = new URL(SPOTIFY_API_BASE_URL);

    if (url.origin !== base.origin) {
      throw new Error("Refusing to send a Spotify token to a non-Spotify API origin.");
    }

    return url.toString();
  }

  const normalizedPath = pathOrUrl.replace(/^\/+/, "");
  return `${SPOTIFY_API_BASE_URL}/${normalizedPath}`;
}

function extractErrorDetails(payload: unknown): {
  message: string | null;
  code: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { message: null, code: null };
  }

  const record = payload as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;

  const message =
    (nested && typeof nested.message === "string" && nested.message) ||
    (typeof record.message === "string" && record.message) ||
    null;

  const code =
    (nested && typeof nested.reason === "string" && nested.reason) ||
    (typeof record.error === "string" && record.error) ||
    null;

  return { message, code };
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function requestSpotify<T>(
  pathOrUrl: string,
  init: RequestInit = {},
  allowAuthRetry = true,
): Promise<T> {
  const token = await getSpotifyAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiUrl(pathOrUrl), {
    ...init,
    headers,
  });

  if (response.status === 401 && allowAuthRetry) {
    await getSpotifyAccessToken({ forceRefresh: true });
    return requestSpotify<T>(pathOrUrl, init, false);
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const details = extractErrorDetails(payload);
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;

    throw new SpotifyApiError(
      details.message || `Spotify API request failed with HTTP ${response.status}.`,
      {
        status: response.status,
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
        spotifyMessage: details.message,
        code: details.code,
      },
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapTrack(raw: RawSpotifyTrack): SpotifyTrack | null {
  if (!raw.id || !raw.uri || !raw.name || raw.type === "episode") {
    return null;
  }

  const artists = (raw.artists ?? [])
    .map((artist) => artist.name?.trim())
    .filter((name): name is string => Boolean(name));
  const durationMs = Math.max(0, raw.duration_ms ?? 0);

  return {
    id: raw.id,
    uri: raw.uri,
    title: raw.name,
    artist: artists.join(", ") || "Unknown artist",
    artists,
    durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    albumId: raw.album?.id ?? null,
    albumName: raw.album?.name?.trim() || "Unknown album",
    albumArtUrl: raw.album?.images?.[0]?.url ?? null,
    externalUrl: raw.external_urls?.spotify ?? null,
    isLocal: raw.is_local === true,
  };
}

function mapPlaylist(raw: RawSpotifyPlaylist): SpotifyPlaylist | null {
  if (!raw.id || !raw.name || !raw.uri) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    ownerId: raw.owner?.id ?? "",
    ownerName: raw.owner?.display_name?.trim() || raw.owner?.id || "Unknown owner",
    isPublic: typeof raw.public === "boolean" ? raw.public : null,
    isCollaborative: raw.collaborative === true,
    totalItems: Math.max(0, raw.items?.total ?? raw.tracks?.total ?? 0),
    imageUrl: raw.images?.[0]?.url ?? null,
    externalUrl: raw.external_urls?.spotify ?? null,
    uri: raw.uri,
    snapshotId: raw.snapshot_id ?? null,
  };
}

function createPage<T, R>(
  raw: RawSpotifyPage<R>,
  items: T[],
): SpotifyPage<T> {
  const limit = Math.max(1, raw.limit ?? DEFAULT_PAGE_LIMIT);
  const offset = Math.max(0, raw.offset ?? 0);

  return {
    items,
    limit,
    offset,
    total: Math.max(0, raw.total ?? items.length),
    nextOffset: raw.next ? offset + limit : null,
  };
}

export async function getCurrentSpotifyUser(): Promise<SpotifyUserProfile> {
  const raw = await requestSpotify<RawUserProfile>("me");

  if (!raw.id) {
    throw new SpotifyApiError("Spotify profile response did not include a user ID.", {
      status: 502,
      retryAfterSeconds: null,
      spotifyMessage: null,
      code: "invalid_profile_response",
    });
  }

  return {
    id: raw.id,
    displayName: raw.display_name?.trim() || raw.id,
    product: raw.product ?? null,
    country: raw.country ?? null,
    externalUrl: raw.external_urls?.spotify ?? null,
  };
}

export async function getCurrentUserPlaylists(
  options?: PageOptions,
): Promise<SpotifyPage<SpotifyPlaylist>> {
  const { limit, offset } = normalizePageOptions(options);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const raw = await requestSpotify<RawSpotifyPage<RawSpotifyPlaylist>>(
    `me/playlists?${params.toString()}`,
  );
  const items = (raw.items ?? [])
    .map(mapPlaylist)
    .filter((item): item is SpotifyPlaylist => item !== null);

  return createPage(raw, items);
}

export async function getSavedTracks(
  options?: PageOptions,
): Promise<SpotifyPage<SpotifyTrack>> {
  const { limit, offset } = normalizePageOptions(options);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const raw = await requestSpotify<RawSpotifyPage<RawSavedTrack>>(
    `me/tracks?${params.toString()}`,
  );
  const items = (raw.items ?? [])
    .map((item) => (item.track ? mapTrack(item.track) : null))
    .filter((item): item is SpotifyTrack => item !== null);

  return createPage(raw, items);
}

export async function getPlaylistTracks(
  playlistId: string,
  options?: PageOptions,
): Promise<SpotifyPlaylistTrackPage> {
  if (!playlistId.trim()) {
    throw new Error("playlistId is required.");
  }

  const { limit, offset } = normalizePageOptions(options);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const raw = await requestSpotify<RawSpotifyPage<RawPlaylistItem>>(
    `playlists/${encodeURIComponent(playlistId)}/items?${params.toString()}`,
  );
  const rawItems = raw.items ?? [];
  const items = rawItems
    .map((entry) => mapTrack(entry.item ?? entry.track ?? {}))
    .filter((item): item is SpotifyTrack => item !== null);
  const page = createPage(raw, items);

  return {
    ...page,
    skippedNonTracks: Math.max(0, rawItems.length - items.length),
  };
}

export async function createCurrentUserPlaylist(
  input: CreateSpotifyPlaylistInput,
): Promise<SpotifyPlaylist> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Playlist name is required.");
  }

  if (name.length > 100) {
    throw new Error("Playlist name must be 100 characters or fewer.");
  }

  const raw = await requestSpotify<RawSpotifyPlaylist>("me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name,
      public: input.isPublic ?? false,
      description: input.description?.trim() || "Created with AMP99",
    }),
  });
  const playlist = mapPlaylist(raw);

  if (!playlist) {
    throw new SpotifyApiError("Spotify returned an invalid playlist response.", {
      status: 502,
      retryAfterSeconds: null,
      spotifyMessage: null,
      code: "invalid_playlist_response",
    });
  }

  return playlist;
}
