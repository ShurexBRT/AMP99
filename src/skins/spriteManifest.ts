export type SkinSprite = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SkinSpriteSheet =
  | "main"
  | "cbuttons"
  | "numbers"
  | "playpaus";

/**
 * Core Winamp-classic sprite geometry used by AMP99's first skin renderer.
 *
 * These are compatibility coordinates only. No third-party bitmap assets are
 * bundled with AMP99. The geometry was cross-checked against the MIT-licensed
 * Webamp implementation; see THIRD_PARTY_NOTICES.md.
 */
export const CORE_CLASSIC_SPRITES: Readonly<
  Record<SkinSpriteSheet, readonly SkinSprite[]>
> = {
  main: [
    {
      name: "main.windowBackground",
      x: 0,
      y: 0,
      width: 275,
      height: 116,
    },
  ],
  cbuttons: [
    { name: "main.previous", x: 0, y: 0, width: 23, height: 18 },
    { name: "main.previousPressed", x: 0, y: 18, width: 23, height: 18 },
    { name: "main.play", x: 23, y: 0, width: 23, height: 18 },
    { name: "main.playPressed", x: 23, y: 18, width: 23, height: 18 },
    { name: "main.pause", x: 46, y: 0, width: 23, height: 18 },
    { name: "main.pausePressed", x: 46, y: 18, width: 23, height: 18 },
    { name: "main.stop", x: 69, y: 0, width: 23, height: 18 },
    { name: "main.stopPressed", x: 69, y: 18, width: 23, height: 18 },
    { name: "main.next", x: 92, y: 0, width: 23, height: 18 },
    { name: "main.nextPressed", x: 92, y: 18, width: 22, height: 18 },
    { name: "main.eject", x: 114, y: 0, width: 22, height: 16 },
    { name: "main.ejectPressed", x: 114, y: 16, width: 22, height: 16 },
  ],
  numbers: Array.from({ length: 10 }, (_, digit): SkinSprite => ({
    name: `main.digit${digit}`,
    x: digit * 9,
    y: 0,
    width: 9,
    height: 13,
  })),
  playpaus: [
    { name: "main.playing", x: 0, y: 0, width: 9, height: 9 },
    { name: "main.paused", x: 9, y: 0, width: 9, height: 9 },
    { name: "main.stopped", x: 18, y: 0, width: 9, height: 9 },
  ],
};

export function getCoreSpritesForSheet(
  sheet: string,
): readonly SkinSprite[] {
  const normalized = sheet.toLowerCase().replace(/\.(bmp|png)$/i, "");
  return normalized in CORE_CLASSIC_SPRITES
    ? CORE_CLASSIC_SPRITES[normalized as SkinSpriteSheet]
    : [];
}
