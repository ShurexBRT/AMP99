const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

// Spotify Client IDs are public application identifiers, not secrets. Keep the
// environment override so contributors can test against a separate dev app.
export const AMP99_SPOTIFY_CLIENT_ID = "7a375f111fbc4d2f8357b8430f180806";
export const SPOTIFY_BROWSER_REDIRECT_URI = "http://127.0.0.1:5173/callback";
export const SPOTIFY_DESKTOP_REDIRECT_URI = "http://127.0.0.1:43821/callback";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-library-read",
  "user-read-private",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
] as const;

export type SpotifyScope = (typeof SPOTIFY_SCOPES)[number];

export type SpotifyConfig = {
  clientId: string;
  redirectUri: string;
  scopes: readonly SpotifyScope[];
};

export function getSpotifyConfig(): SpotifyConfig {
  const clientId = env.VITE_SPOTIFY_CLIENT_ID?.trim() || AMP99_SPOTIFY_CLIENT_ID;
  const redirectUri =
    env.VITE_SPOTIFY_REDIRECT_URI?.trim() || SPOTIFY_BROWSER_REDIRECT_URI;

  return {
    clientId,
    redirectUri,
    scopes: SPOTIFY_SCOPES,
  };
}
