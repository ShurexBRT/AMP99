import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSpotifyAuthorizationTransaction,
  clearSpotifySession,
  createSpotifyAuthorizationUrl,
  getStoredSpotifySession,
  handleSpotifyAuthorizationCallback,
} from "./auth";
import {
  addSpotifyPlaylistItems,
  createCurrentUserPlaylist,
  getCurrentSpotifyUser,
  getCurrentUserPlaylists,
  getPlaylistTracks,
  getSavedTracks,
  removeSpotifyPlaylistItems,
  searchSpotifyTracks,
} from "./api";
import { SPOTIFY_DESKTOP_REDIRECT_URI } from "./config";
import {
  isTauriRuntime,
  runNativeSpotifyAuthorization,
} from "../platform/spotifyOAuth";
import {
  SpotifyApiError,
  SpotifyAuthError,
  type SpotifyPlaylist,
  type SpotifyTrack,
  type SpotifyUserProfile,
} from "./types";

const MAX_LIBRARY_ITEMS = 10_000;

export type SpotifyCreatePlaylistOptions = {
  name: string;
  isPublic: boolean;
};

function readableSpotifyError(error: unknown): string {
  if (error instanceof SpotifyApiError) {
    if (error.isPlaylistAccessRestriction) {
      return "Spotify only exposes tracks for playlists you own or collaborate on.";
    }

    if (error.status === 429) {
      return error.details.retryAfterSeconds
        ? `Spotify rate limit hit. Try again in ${error.details.retryAfterSeconds}s.`
        : "Spotify rate limit hit. Try again shortly.";
    }

    return error.details.spotifyMessage || error.message;
  }

  if (error instanceof SpotifyAuthError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Spotify request failed.";
}

function asReadableError(error: unknown): Error {
  return new Error(readableSpotifyError(error));
}

async function fetchAllPlaylists(): Promise<SpotifyPlaylist[]> {
  const result: SpotifyPlaylist[] = [];
  let offset = 0;

  while (result.length < MAX_LIBRARY_ITEMS) {
    const page = await getCurrentUserPlaylists({ limit: 50, offset });
    result.push(...page.items);

    if (page.nextOffset === null || page.items.length === 0) {
      break;
    }
    offset = page.nextOffset;
  }

  return result.slice(0, MAX_LIBRARY_ITEMS);
}

async function fetchAllSavedTracks(): Promise<SpotifyTrack[]> {
  const result: SpotifyTrack[] = [];
  let offset = 0;

  while (result.length < MAX_LIBRARY_ITEMS) {
    const page = await getSavedTracks({ limit: 50, offset });
    result.push(...page.items);

    if (page.nextOffset === null || page.items.length === 0) {
      break;
    }
    offset = page.nextOffset;
  }

  return result.slice(0, MAX_LIBRARY_ITEMS);
}

async function fetchAllPlaylistTracks(
  playlistId: string,
): Promise<{ tracks: SpotifyTrack[]; skippedNonTracks: number }> {
  const tracks: SpotifyTrack[] = [];
  let skippedNonTracks = 0;
  let offset = 0;

  while (tracks.length < MAX_LIBRARY_ITEMS) {
    const page = await getPlaylistTracks(playlistId, { limit: 50, offset });
    tracks.push(...page.items);
    skippedNonTracks += page.skippedNonTracks;

    if (page.nextOffset === null || page.items.length + page.skippedNonTracks === 0) {
      break;
    }
    offset = page.nextOffset;
  }

  return {
    tracks: tracks.slice(0, MAX_LIBRARY_ITEMS),
    skippedNonTracks,
  };
}

export function useSpotifyLibrary() {
  const initializedRef = useRef(false);
  const [authenticated, setAuthenticated] = useState(
    () => getStoredSpotifySession() !== null,
  );
  const [profile, setProfile] = useState<SpotifyUserProfile | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextProfile, nextPlaylists] = await Promise.all([
        getCurrentSpotifyUser(),
        fetchAllPlaylists(),
      ]);
      setProfile(nextProfile);
      setPlaylists(nextPlaylists);
      setAuthenticated(true);
    } catch (requestError) {
      const readable = asReadableError(requestError);
      setError(readable.message);
      throw readable;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const initialize = async () => {
      const url = new URL(window.location.href);
      const hasCallbackPayload =
        url.searchParams.has("code") || url.searchParams.has("error");
      const isCallbackPath = url.pathname.endsWith("/callback");

      try {
        if (isCallbackPath && hasCallbackPayload) {
          setLoading(true);
          await handleSpotifyAuthorizationCallback(url.toString());
          window.history.replaceState({}, document.title, "/");
          setAuthenticated(true);
        }

        if (getStoredSpotifySession()) {
          await refreshLibrary();
        }
      } catch (initializationError) {
        setError(readableSpotifyError(initializationError));
        if (!getStoredSpotifySession()) {
          setAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [refreshLibrary]);

  const connect = useCallback(async () => {
    setError(null);

    if (!isTauriRuntime()) {
      const authorizationUrl = await createSpotifyAuthorizationUrl();
      window.location.assign(authorizationUrl);
      return;
    }

    setLoading(true);
    try {
      const authorizationUrl = await createSpotifyAuthorizationUrl({
        redirectUri: SPOTIFY_DESKTOP_REDIRECT_URI,
      });
      const callbackUrl = await runNativeSpotifyAuthorization(authorizationUrl);
      await handleSpotifyAuthorizationCallback(callbackUrl);
      setAuthenticated(true);
      await refreshLibrary();
    } catch (authorizationError) {
      clearSpotifyAuthorizationTransaction();
      const readable = asReadableError(authorizationError);
      setError(readable.message);
      if (!getStoredSpotifySession()) {
        setAuthenticated(false);
      }
      throw readable;
    } finally {
      setLoading(false);
    }
  }, [refreshLibrary]);

  const disconnect = useCallback(() => {
    clearSpotifySession();
    clearSpotifyAuthorizationTransaction();
    setAuthenticated(false);
    setProfile(null);
    setPlaylists([]);
    setError(null);
  }, []);

  const loadPlaylist = useCallback(async (playlistId: string) => {
    setLoading(true);
    setError(null);

    try {
      return await fetchAllPlaylistTracks(playlistId);
    } catch (requestError) {
      const readable = asReadableError(requestError);
      setError(readable.message);
      throw readable;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLikedSongs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      return await fetchAllSavedTracks();
    } catch (requestError) {
      const readable = asReadableError(requestError);
      setError(readable.message);
      throw readable;
    } finally {
      setLoading(false);
    }
  }, []);

  const createPlaylist = useCallback(
    async ({ name, isPublic }: SpotifyCreatePlaylistOptions) => {
      setLoading(true);
      setError(null);

      try {
        const created = await createCurrentUserPlaylist({ name, isPublic });
        setPlaylists(await fetchAllPlaylists());
        return created;
      } catch (requestError) {
        const readable = asReadableError(requestError);
        setError(readable.message);
        throw readable;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const searchTracks = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      return (await searchSpotifyTracks(query, { limit: 10, offset: 0 })).items;
    } catch (requestError) {
      const readable = asReadableError(requestError);
      setError(readable.message);
      throw readable;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, uri: string) => {
    setLoading(true);
    setError(null);

    try {
      const snapshotId = await addSpotifyPlaylistItems(playlistId, [uri]);
      setPlaylists(await fetchAllPlaylists());
      return snapshotId;
    } catch (requestError) {
      const readable = asReadableError(requestError);
      setError(readable.message);
      throw readable;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, uri: string, snapshotId?: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const nextSnapshotId = await removeSpotifyPlaylistItems(
          playlistId,
          [uri],
          snapshotId,
        );
        setPlaylists(await fetchAllPlaylists());
        return nextSnapshotId;
      } catch (requestError) {
        const readable = asReadableError(requestError);
        setError(readable.message);
        throw readable;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    authenticated,
    profile,
    playlists,
    loading,
    error,
    connect,
    disconnect,
    refreshLibrary,
    loadPlaylist,
    loadLikedSongs,
    createPlaylist,
    searchTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
  };
}
