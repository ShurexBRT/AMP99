import { describe, expect, it } from "vitest";
import { selectNextTrackIndex } from "../src/state/queueNavigation";

describe("queue navigation", () => {
  it("advances sequentially and wraps at the end", () => {
    expect(selectNextTrackIndex(1, 3, false)).toBe(2);
    expect(selectNextTrackIndex(2, 3, false)).toBe(0);
  });

  it("chooses a different track when shuffle is enabled", () => {
    expect(selectNextTrackIndex(1, 4, true, () => 0)).toBe(0);
    expect(selectNextTrackIndex(1, 4, true, () => 0.99)).toBe(3);
  });

  it("keeps a one-track queue on the same track", () => {
    expect(selectNextTrackIndex(0, 1, true, () => 0.99)).toBe(0);
  });
});
