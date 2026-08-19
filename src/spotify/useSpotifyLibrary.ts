import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSpotifySession,
  createSpotifyAuthorizationUrl,
  getStoredSpotifySession,
  handleSpotifyAuthorizationCallback,
} from "./auth";
import {
  createCurrentUserPlaylist,
  getCurrentSpotifyUser,
  getCurrentUserPlaylists,
  getPlaylistTracks,
  getSavedTracks,
} from "./api";
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
      const message = readableSpotifyError(requestError);
      setError(message);
      throw requestError;
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
    const authorizationUrl = await createSpotifyAuthorizationUrl();
    window.location.assign(authorizationUrl);
  }, []);

  const disconnect = useCallback(() => {
    clearSpotifySession();
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
      setError(readableSpotifyError(requestError));
      throw requestError;
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
      setError(readableSpotifyError(requestError));
      throw requestError;
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
        const nextPlaylists = await fetchAllPlaylists();
        setPlaylists(nextPlaylists);
        return created;
      } catch (requestError) {
        setError(readableSpotifyError(requestError));
        throw requestError;
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
  };
}
