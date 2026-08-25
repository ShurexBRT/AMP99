import { describe, expect, it } from "vitest";
import {
  compareAmp99Versions,
  isOfficialAmp99ReleaseUrl,
} from "../src/updates/githubUpdates";

describe("AMP99 release validation", () => {
  it("orders stable releases after prereleases", () => {
    expect(compareAmp99Versions("0.2.0-alpha.2", "0.2.0-alpha.3")).toBeLessThan(0);
    expect(compareAmp99Versions("0.2.0-alpha.3", "0.2.0")).toBeLessThan(0);
    expect(compareAmp99Versions("1.0.0", "0.9.9")).toBeGreaterThan(0);
  });

  it("accepts only official AMP99 release URLs", () => {
    expect(
      isOfficialAmp99ReleaseUrl(
        "https://github.com/ShurexBRT/AMP99/releases/tag/v0.2.0-alpha.2",
      ),
    ).toBe(true);
    expect(isOfficialAmp99ReleaseUrl("https://example.com/AMP99/releases/tag/v1")).toBe(
      false,
    );
    expect(
      isOfficialAmp99ReleaseUrl(
        "https://github.com/ShurexBRT/AMP99/releases/tag/v1\nhttps://example.com",
      ),
    ).toBe(false);
  });
});
