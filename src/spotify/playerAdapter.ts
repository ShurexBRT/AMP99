import type { Track } from "../types/player";
import type { SpotifyTrack } from "./types";

export function spotifyTrackToPlayerTrack(track: SpotifyTrack): Track {
  return {
    id: track.id,
    artist: track.artist,
    title: track.title,
    duration: track.durationSeconds,
    source: "spotify",
    uri: track.uri,
    albumArtUrl: track.albumArtUrl,
  };
}

export function spotifyTracksToPlayerQueue(tracks: SpotifyTrack[]): Track[] {
  return tracks.map(spotifyTrackToPlayerTrack);
}
