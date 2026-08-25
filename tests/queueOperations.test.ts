import { describe, expect, it } from "vitest";
import { moveTrack, moveTrackNext, removeTrackAt } from "../src/state/queueOperations";
import type { Track } from "../src/types/player";

const tracks: Track[] = [
  { id: "a", artist: "A", title: "A", duration: 1 },
  { id: "b", artist: "B", title: "B", duration: 2 },
  { id: "c", artist: "C", title: "C", duration: 3 },
];

describe("queue operations", () => {
  it("removes a track and preserves the playing index", () => {
    const result = removeTrackAt(tracks, 0, 2);
    expect(result.tracks.map((track) => track.id)).toEqual(["b", "c"]);
    expect(result.currentIndex).toBe(1);
  });

  it("moves a track and follows the playing track", () => {
    const result = moveTrack(tracks, 2, -1, 0);
    expect(result.tracks.map((track) => track.id)).toEqual(["a", "c", "b"]);
    expect(result.currentIndex).toBe(0);
  });

  it("places a selected track immediately after the current track", () => {
    const result = moveTrackNext(tracks, 2, 0);
    expect(result.tracks.map((track) => track.id)).toEqual(["a", "c", "b"]);
    expect(result.currentIndex).toBe(0);
  });
});
