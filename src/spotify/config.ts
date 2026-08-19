const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-library-read",
  "user-read-private",
] as const;

export type SpotifyScope = (typeof SPOTIFY_SCOPES)[number];

export type SpotifyConfig = {
  clientId: string;
  redirectUri: string;
  scopes: readonly SpotifyScope[];
};

export function getSpotifyConfig(): SpotifyConfig {
  const clientId = env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? "";
  const redirectUri =
    env.VITE_SPOTIFY_REDIRECT_URI?.trim() ||
    "http://127.0.0.1:5173/callback";

  if (!clientId) {
    throw new Error(
      "Spotify is not configured. Set VITE_SPOTIFY_CLIENT_ID in your local .env file.",
    );
  }

  return {
    clientId,
    redirectUri,
    scopes: SPOTIFY_SCOPES,
  };
}
