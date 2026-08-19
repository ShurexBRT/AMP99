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
  | "playpaus"
  | "eqmain"
  | "eq_ex"
  | "pledit";

/**
 * Classic Winamp 2.x compatibility geometry used by AMP99.
 *
 * These are sprite coordinates only. AMP99 never bundles Winamp artwork or
 * third-party skins. Geometry was cross-checked against the MIT-licensed
 * Webamp classic-skin implementation; see THIRD_PARTY_NOTICES.md.
 */
export const CORE_CLASSIC_SPRITES: Readonly<
  Record<SkinSpriteSheet, readonly SkinSprite[]>
> = {
  main: [
    { name: "main.windowBackground", x: 0, y: 0, width: 275, height: 116 },
  ],
  titlebar: [
    { name: "main.titlebarInactive", x: 27, y: 15, width: 275, height: 14 },
    { name: "main.titlebarActive", x: 27, y: 0, width: 275, height: 14 },
    { name: "main.shadeActive", x: 27, y: 29, width: 275, height: 14 },
    { name: "main.shadeInactive", x: 27, y: 42, width: 275, height: 14 },
    { name: "main.options", x: 0, y: 0, width: 9, height: 9 },
    { name: "main.optionsPressed", x: 0, y: 9, width: 9, height: 9 },
    { name: "main.minimize", x: 9, y: 0, width: 9, height: 9 },
    { name: "main.minimizePressed", x: 9, y: 9, width: 9, height: 9 },
    { name: "main.shade", x: 0, y: 18, width: 9, height: 9 },
    { name: "main.shadePressed", x: 9, y: 18, width: 9, height: 9 },
    { name: "main.unshade", x: 0, y: 27, width: 9, height: 9 },
    { name: "main.unshadePressed", x: 9, y: 27, width: 9, height: 9 },
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
  eqmain: [
    { name: "eq.windowBackground", x: 0, y: 0, width: 275, height: 116 },
    { name: "eq.titlebarActive", x: 0, y: 134, width: 275, height: 14 },
    { name: "eq.titlebarInactive", x: 0, y: 149, width: 275, height: 14 },
    { name: "eq.on", x: 10, y: 119, width: 24, height: 12 },
    { name: "eq.onPressed", x: 128, y: 119, width: 24, height: 12 },
    { name: "eq.onSelected", x: 69, y: 119, width: 24, height: 12 },
    { name: "eq.auto", x: 34, y: 119, width: 34, height: 12 },
    { name: "eq.autoPressed", x: 152, y: 119, width: 34, height: 12 },
    { name: "eq.autoSelected", x: 93, y: 119, width: 34, height: 12 },
    { name: "eq.preset", x: 224, y: 164, width: 44, height: 12 },
    { name: "eq.presetPressed", x: 224, y: 176, width: 44, height: 12 },
    { name: "eq.sliderThumb", x: 0, y: 164, width: 11, height: 11 },
    { name: "eq.sliderThumbPressed", x: 0, y: 176, width: 11, height: 11 },
    { name: "eq.close", x: 0, y: 116, width: 9, height: 9 },
    { name: "eq.closePressed", x: 0, y: 125, width: 9, height: 9 },
    { name: "eq.shade", x: 254, y: 137, width: 9, height: 9 },
  ],
  eq_ex: [
    { name: "eq.shadeActive", x: 0, y: 0, width: 275, height: 14 },
    { name: "eq.shadeInactive", x: 0, y: 15, width: 275, height: 14 },
    { name: "eq.shadeButtonPressed", x: 1, y: 38, width: 9, height: 9 },
    { name: "eq.shadeClose", x: 11, y: 38, width: 9, height: 9 },
    { name: "eq.shadeClosePressed", x: 11, y: 47, width: 9, height: 9 },
  ],
  pledit: [
    { name: "playlist.topLeftActive", x: 0, y: 0, width: 25, height: 20 },
    { name: "playlist.topMiddleActive", x: 127, y: 0, width: 25, height: 20 },
    { name: "playlist.topCenterActive", x: 26, y: 0, width: 100, height: 20 },
    { name: "playlist.topRightActive", x: 153, y: 0, width: 25, height: 20 },
    { name: "playlist.topLeftInactive", x: 0, y: 21, width: 25, height: 20 },
    { name: "playlist.topMiddleInactive", x: 127, y: 21, width: 25, height: 20 },
    { name: "playlist.topCenterInactive", x: 26, y: 21, width: 100, height: 20 },
    { name: "playlist.topRightInactive", x: 153, y: 21, width: 25, height: 20 },
    { name: "playlist.leftSide", x: 0, y: 42, width: 25, height: 29 },
    { name: "playlist.rightSide", x: 26, y: 42, width: 25, height: 29 },
    { name: "playlist.bottomLeft", x: 0, y: 72, width: 125, height: 38 },
    { name: "playlist.bottomMiddle", x: 179, y: 0, width: 25, height: 38 },
    { name: "playlist.bottomRight", x: 126, y: 72, width: 150, height: 38 },
    { name: "playlist.close", x: 167, y: 3, width: 9, height: 9 },
    { name: "playlist.closePressed", x: 52, y: 42, width: 9, height: 9 },
    { name: "playlist.shade", x: 157, y: 3, width: 9, height: 9 },
    { name: "playlist.shadePressed", x: 62, y: 42, width: 9, height: 9 },
    { name: "playlist.shadeLeft", x: 72, y: 42, width: 25, height: 14 },
    { name: "playlist.shadeMiddle", x: 72, y: 57, width: 25, height: 14 },
    { name: "playlist.shadeRightActive", x: 99, y: 42, width: 50, height: 14 },
    { name: "playlist.shadeRightInactive", x: 99, y: 57, width: 50, height: 14 },
    { name: "playlist.shadeClose", x: 138, y: 45, width: 9, height: 9 },
    { name: "playlist.shadeButton", x: 128, y: 45, width: 9, height: 9 },
    { name: "playlist.shadeButtonPressed", x: 150, y: 42, width: 9, height: 9 },
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
