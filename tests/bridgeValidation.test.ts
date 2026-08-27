import { describe, expect, it } from "vitest";
import { isMainRequestEnvelope } from "../src/windowing/bridge";

describe("native window bridge request validation", () => {
  it("accepts a valid typed request envelope", () => {
    expect(
      isMainRequestEnvelope({
        kind: "request",
        id: "request-1",
        source: "playlist",
        command: "moveQueueTrack",
        payload: { trackIndex: 2, direction: -1 },
      }),
    ).toBe(true);
  });

  it.each([
    {
      command: "setVolume",
      payload: 101,
    },
    {
      command: "moveQueueTrack",
      payload: { trackIndex: 0, direction: 0 },
    },
    {
      command: "loadSpotifyPlaylist",
      payload: { name: "missing playlist id" },
    },
    {
      command: "togglePlay",
      payload: false,
    },
  ])("rejects an invalid $command payload", ({ command, payload }) => {
    expect(
      isMainRequestEnvelope({
        kind: "request",
        id: "request-invalid",
        source: "equalizer",
        command,
        payload,
      }),
    ).toBe(false);
  });

  it("rejects malformed request metadata and unknown commands", () => {
    expect(
      isMainRequestEnvelope({
        kind: "request",
        id: "request-invalid-source",
        source: "settings",
        command: "stop",
        payload: undefined,
      }),
    ).toBe(false);
    expect(
      isMainRequestEnvelope({
        kind: "request",
        id: "request-unknown-command",
        source: "playlist",
        command: "deleteEverything",
        payload: undefined,
      }),
    ).toBe(false);
  });
});
