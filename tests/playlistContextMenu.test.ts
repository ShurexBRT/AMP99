import { describe, expect, it } from "vitest";
import {
  getPlaylistContextActions,
  spotifyTrackUrl,
} from "../src/components/playlistContextMenu";
import type { Track } from "../src/types/player";

const spotifyTrack: Track = {
  id: "track-1",
  artist: "Clutch",
  title: "The Mob Goes Wild",
  duration: 212,
  source: "spotify",
  uri: "spotify:track:abc123",
};

describe("playlist context menu", () => {
  it("builds the Spotify link only for Spotify track URIs", () => {
    expect(spotifyTrackUrl(spotifyTrack)).toBe(
      "https://open.spotify.com/track/abc123",
    );
    expect(
      spotifyTrackUrl({ ...spotifyTrack, source: "demo", uri: undefined }),
    ).toBeNull();
  });

  it("disables unsafe Spotify and reorder actions", () => {
    const actions = getPlaylistContextActions({
      track: spotifyTrack,
      trackIndex: 1,
      currentIndex: 0,
      tracksLength: 3,
      spotifyPlaylistEditable: false,
      spotifyLoading: false,
      duplicateSpotifyTrackCount: 1,
      canMoveTracks: false,
    });

    expect(actions.find((item) => item.id === "move-up")?.disabled).toBe(true);
    expect(actions.find((item) => item.id === "move-down")?.disabled).toBe(true);
    expect(actions.find((item) => item.id === "remove-spotify")?.disabled).toBe(true);
    expect(actions.find((item) => item.id === "open-spotify")?.disabled).toBe(false);
  });

  it("allows editable Spotify removal and local reordering", () => {
    const actions = getPlaylistContextActions({
      track: spotifyTrack,
      trackIndex: 0,
      currentIndex: 1,
      tracksLength: 2,
      spotifyPlaylistEditable: true,
      spotifyLoading: false,
      duplicateSpotifyTrackCount: 1,
      canMoveTracks: true,
    });

    expect(actions.find((item) => item.id === "remove-spotify")?.disabled).toBe(false);
    expect(actions.find((item) => item.id === "move-up")?.disabled).toBe(true);
    expect(actions.find((item) => item.id === "move-down")?.disabled).toBe(false);
  });
});
