export type SpotifyWebPlaybackArtist = {
  name: string;
  uri: string;
};

export type SpotifyWebPlaybackTrack = {
  uri: string;
  id: string | null;
  name: string;
  artists: SpotifyWebPlaybackArtist[];
};

export type SpotifyWebPlaybackState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyWebPlaybackTrack;
    previous_tracks: SpotifyWebPlaybackTrack[];
    next_tracks: SpotifyWebPlaybackTrack[];
  };
};

export type SpotifyWebPlaybackError = {
  message: string;
};

export type SpotifyWebPlaybackReady = {
  device_id: string;
};

export type SpotifyPlayerOptions = {
  name: string;
  getOAuthToken: (callback: (token: string) => void) => void;
  volume?: number;
  enableMediaSession?: boolean;
};

export interface SpotifyWebPlaybackPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  getCurrentState(): Promise<SpotifyWebPlaybackState | null>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  addListener(
    event: "ready" | "not_ready",
    callback: (payload: SpotifyWebPlaybackReady) => void,
  ): boolean;
  addListener(
    event: "player_state_changed",
    callback: (state: SpotifyWebPlaybackState | null) => void,
  ): boolean;
  addListener(
    event:
      | "initialization_error"
      | "authentication_error"
      | "account_error"
      | "playback_error",
    callback: (error: SpotifyWebPlaybackError) => void,
  ): boolean;
  addListener(event: "autoplay_failed", callback: () => void): boolean;
}

export type SpotifyPlayerConstructor = new (
  options: SpotifyPlayerOptions,
) => SpotifyWebPlaybackPlayer;

declare global {
  interface Window {
    Spotify?: {
      Player: SpotifyPlayerConstructor;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
