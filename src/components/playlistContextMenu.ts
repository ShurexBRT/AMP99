import type { Track } from "../types/player";

export type PlaylistContextActionId =
  | "play"
  | "play-next"
  | "remove-queue"
  | "move-up"
  | "move-down"
  | "copy-title"
  | "open-spotify"
  | "copy-spotify-link"
  | "remove-spotify"
  | "track-info";

export type PlaylistContextAction = {
  id: PlaylistContextActionId;
  label: string;
  disabled: boolean;
  reason?: string;
};

export type PlaylistContextMenuState = {
  trackIndex: number;
  x: number;
  y: number;
};

type PlaylistContextMenuOptions = {
  track: Track;
  trackIndex: number;
  currentIndex: number;
  tracksLength: number;
  spotifyPlaylistEditable: boolean;
  spotifyLoading: boolean;
  duplicateSpotifyTrackCount: number;
  canMoveTracks: boolean;
};

function action(
  id: PlaylistContextActionId,
  label: string,
  disabled = false,
  reason?: string,
): PlaylistContextAction {
  return { id, label, disabled, ...(reason ? { reason } : {}) };
}

export function isSpotifyTrack(track: Track): boolean {
  return track.source === "spotify" && Boolean(track.uri?.startsWith("spotify:track:"));
}

export function spotifyTrackUrl(track: Track): string | null {
  if (!isSpotifyTrack(track) || !track.uri) return null;
  const id = track.uri.slice("spotify:track:".length);
  return id ? `https://open.spotify.com/track/${encodeURIComponent(id)}` : null;
}

export function getPlaylistContextActions({
  track,
  trackIndex,
  currentIndex,
  tracksLength,
  spotifyPlaylistEditable,
  spotifyLoading,
  duplicateSpotifyTrackCount,
  canMoveTracks,
}: PlaylistContextMenuOptions): PlaylistContextAction[] {
  const spotifyTrack = isSpotifyTrack(track);
  const spotifyUrl = spotifyTrackUrl(track);
  const canRemoveSpotify =
    spotifyTrack &&
    Boolean(spotifyUrl) &&
    spotifyPlaylistEditable &&
    !spotifyLoading &&
    duplicateSpotifyTrackCount <= 1;

  return [
    action("play", "Play"),
    action(
      "play-next",
      "Play next",
      tracksLength < 2 || trackIndex === currentIndex,
      trackIndex === currentIndex ? "The current track is already playing." : undefined,
    ),
    action("remove-queue", "Remove from queue"),
    action(
      "move-up",
      "Move up",
      !canMoveTracks || trackIndex <= 0,
      !canMoveTracks ? "Track reordering is unavailable here." : undefined,
    ),
    action(
      "move-down",
      "Move down",
      !canMoveTracks || trackIndex >= tracksLength - 1,
      !canMoveTracks ? "Track reordering is unavailable here." : undefined,
    ),
    action("copy-title", "Copy track title"),
    action("open-spotify", "Open in Spotify", !spotifyUrl, "Spotify track URI unavailable."),
    action(
      "copy-spotify-link",
      "Copy Spotify link",
      !spotifyUrl,
      "Spotify track URI unavailable.",
    ),
    action(
      "remove-spotify",
      "Remove from Spotify playlist",
      !canRemoveSpotify,
      !spotifyTrack
        ? "Only available for Spotify tracks."
        : !spotifyPlaylistEditable
          ? "Load an editable Spotify playlist first."
          : duplicateSpotifyTrackCount > 1
            ? "Duplicate Spotify tracks cannot be removed safely."
            : spotifyLoading
              ? "Spotify is busy."
              : undefined,
    ),
    action("track-info", "Track info"),
  ];
}
