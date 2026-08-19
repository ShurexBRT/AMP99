export type SkinSprite = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SkinSpriteSheet =
  | "main"
  | "titlebar"
  | "cbuttons"
  | "shufrep"
  | "posbar"
  | "volume"
  | "balance"
  | "monoster"
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
  titlebar: [
    { name: "main.titlebarInactive", x: 27, y: 15, width: 275, height: 14 },
    { name: "main.titlebarActive", x: 27, y: 0, width: 275, height: 14 },
    { name: "main.options", x: 0, y: 0, width: 9, height: 9 },
    { name: "main.optionsPressed", x: 0, y: 9, width: 9, height: 9 },
    { name: "main.minimize", x: 9, y: 0, width: 9, height: 9 },
    { name: "main.minimizePressed", x: 9, y: 9, width: 9, height: 9 },
    { name: "main.shade", x: 0, y: 18, width: 9, height: 9 },
    { name: "main.shadePressed", x: 9, y: 18, width: 9, height: 9 },
    { name: "main.close", x: 18, y: 0, width: 9, height: 9 },
    { name: "main.closePressed", x: 18, y: 9, width: 9, height: 9 },
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
  shufrep: [
    { name: "main.repeat", x: 0, y: 0, width: 28, height: 15 },
    { name: "main.repeatPressed", x: 0, y: 15, width: 28, height: 15 },
    { name: "main.repeatSelected", x: 0, y: 30, width: 28, height: 15 },
    { name: "main.repeatSelectedPressed", x: 0, y: 45, width: 28, height: 15 },
    { name: "main.shuffle", x: 28, y: 0, width: 47, height: 15 },
    { name: "main.shufflePressed", x: 28, y: 15, width: 47, height: 15 },
    { name: "main.shuffleSelected", x: 28, y: 30, width: 47, height: 15 },
    { name: "main.shuffleSelectedPressed", x: 28, y: 45, width: 47, height: 15 },
    { name: "main.eq", x: 0, y: 61, width: 23, height: 12 },
    { name: "main.eqSelected", x: 0, y: 73, width: 23, height: 12 },
    { name: "main.eqPressed", x: 46, y: 61, width: 23, height: 12 },
    { name: "main.eqSelectedPressed", x: 46, y: 73, width: 23, height: 12 },
    { name: "main.playlist", x: 23, y: 61, width: 23, height: 12 },
    { name: "main.playlistSelected", x: 23, y: 73, width: 23, height: 12 },
    { name: "main.playlistPressed", x: 69, y: 61, width: 23, height: 12 },
    { name: "main.playlistSelectedPressed", x: 69, y: 73, width: 23, height: 12 },
  ],
  posbar: [
    { name: "main.positionBackground", x: 0, y: 0, width: 248, height: 10 },
    { name: "main.positionThumb", x: 248, y: 0, width: 29, height: 10 },
    { name: "main.positionThumbPressed", x: 278, y: 0, width: 29, height: 10 },
  ],
  volume: [
    { name: "main.volumeBackgroundStrip", x: 0, y: 0, width: 68, height: 420 },
    { name: "main.volumeThumb", x: 15, y: 422, width: 14, height: 11 },
    { name: "main.volumeThumbPressed", x: 0, y: 422, width: 14, height: 11 },
  ],
  balance: [
    { name: "main.balanceBackgroundStrip", x: 9, y: 0, width: 38, height: 420 },
    { name: "main.balanceThumb", x: 15, y: 422, width: 14, height: 11 },
    { name: "main.balanceThumbPressed", x: 0, y: 422, width: 14, height: 11 },
  ],
  monoster: [
    { name: "main.stereo", x: 0, y: 12, width: 29, height: 12 },
    { name: "main.stereoSelected", x: 0, y: 0, width: 29, height: 12 },
    { name: "main.mono", x: 29, y: 12, width: 27, height: 12 },
    { name: "main.monoSelected", x: 29, y: 0, width: 27, height: 12 },
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
