import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tauriConfig = readFileSync("src-tauri/tauri.conf.json", "utf8");

describe("Spotify Web Playback security policy", () => {
  it("allows the SDK embedded playback frame", () => {
    expect(tauriConfig).toContain("frame-src https://sdk.scdn.co");
    expect(tauriConfig).toContain("child-src https://sdk.scdn.co");
  });
});
