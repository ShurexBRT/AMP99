export {
  clearSpotifyAuthorizationTransaction,
  clearSpotifySession,
  createSpotifyAuthorizationUrl,
  exchangeSpotifyAuthorizationCode,
  getSpotifyAccessToken,
  getStoredSpotifySession,
  handleSpotifyAuthorizationCallback,
  refreshSpotifySession,
} from "./auth";

export {
  addSpotifyPlaylistItems,
  createCurrentUserPlaylist,
  getCurrentSpotifyUser,
  getCurrentUserPlaylists,
  getPlaylistTracks,
  getSavedTracks,
  removeSpotifyPlaylistItems,
  searchSpotifyTracks,
  type CreateSpotifyPlaylistInput,
} from "./api";

export { getSpotifyConfig, SPOTIFY_SCOPES } from "./config";

export {
  SpotifyApiError,
  SpotifyAuthError,
  type SpotifyPage,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrackPage,
  type SpotifySession,
  type SpotifyTrack,
  type SpotifyUserProfile,
} from "./types";
