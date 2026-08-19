export type SpotifySession = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
  refreshTokenIssuedAt: number;
};

export type SpotifyUserProfile = {
  id: string;
  displayName: string;
  product: string | null;
  country: string | null;
  externalUrl: string | null;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  isPublic: boolean | null;
  isCollaborative: boolean;
  totalItems: number;
  imageUrl: string | null;
  externalUrl: string | null;
  uri: string;
  snapshotId: string | null;
};

export type SpotifyTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  artists: string[];
  durationMs: number;
  durationSeconds: number;
  albumId: string | null;
  albumName: string;
  albumArtUrl: string | null;
  externalUrl: string | null;
  isLocal: boolean;
};

export type SpotifyPage<T> = {
  items: T[];
  limit: number;
  offset: number;
  total: number;
  nextOffset: number | null;
};

export type SpotifyPlaylistTrackPage = SpotifyPage<SpotifyTrack> & {
  skippedNonTracks: number;
};

export type SpotifyApiErrorDetails = {
  status: number;
  retryAfterSeconds: number | null;
  spotifyMessage: string | null;
  code: string | null;
};

export class SpotifyApiError extends Error {
  readonly details: SpotifyApiErrorDetails;

  constructor(message: string, details: SpotifyApiErrorDetails) {
    super(message);
    this.name = "SpotifyApiError";
    this.details = details;
  }

  get status(): number {
    return this.details.status;
  }

  get isPlaylistAccessRestriction(): boolean {
    return this.details.status === 403;
  }
}

export class SpotifyAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SpotifyAuthError";
    this.code = code;
  }
}
