import { getImportedSkinAsset, type ImportedSkin } from "./skinLoader";
import {
  CORE_CLASSIC_SPRITES,
  type SkinSprite,
  type SkinSpriteSheet,
} from "./spriteManifest";

const CORE_SHEETS: readonly SkinSpriteSheet[] = [
  "main",
  "titlebar",
  "cbuttons",
  "shufrep",
  "posbar",
  "volume",
  "balance",
  "monoster",
  "numbers",
  "playpaus",
  "eqmain",
  "eq_ex",
  "pledit",
];

const PLAYLIST_WIDTH = 275;
const PLAYLIST_HEIGHT = 232;
const PLAYLIST_BOTTOM_HEIGHT = 38;

type DecodedImage = ImageBitmap | HTMLImageElement;

export type PlaylistSkinColors = {
  normal: string;
  current: string;
  normalBackground: string;
  selectedBackground: string;
};

const DEFAULT_PLAYLIST_COLORS: PlaylistSkinColors = {
  normal: "#00ff00",
  current: "#ffffff",
  normalBackground: "#000000",
  selectedBackground: "#000080",
};

export type RenderedSkinSprites = {
  skinName: string;
  sprites: Map<string, string>;
  loadedSheets: SkinSpriteSheet[];
  skippedSheets: SkinSpriteSheet[];
  warnings: string[];
  playlistColors: PlaylistSkinColors;
};

function imageDimensions(image: DecodedImage): { width: number; height: number } {
  return { width: image.width, height: image.height };
}

function closeDecodedImage(image: DecodedImage): void {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    image.close();
  }
}

function loadHtmlImage(blob: Blob): Promise<HTMLImageElement> {
  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Skin rendering requires a browser document context."),
    );
  }

  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("AMP99 could not decode a skin image sheet."));
    };
    image.src = url;
  });
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // BMP decoding through createImageBitmap is inconsistent across WebViews.
    }
  }
  return loadHtmlImage(blob);
}

function assertSpriteFits(
  sprite: SkinSprite,
  sheetWidth: number,
  sheetHeight: number,
): void {
  const validGeometry =
    Number.isFinite(sprite.x) &&
    Number.isFinite(sprite.y) &&
    Number.isFinite(sprite.width) &&
    Number.isFinite(sprite.height) &&
    sprite.x >= 0 &&
    sprite.y >= 0 &&
    sprite.width > 0 &&
    sprite.height > 0;

  if (!validGeometry) throw new Error(`Invalid sprite geometry for ${sprite.name}.`);
  if (
    sprite.x + sprite.width > sheetWidth ||
    sprite.y + sprite.height > sheetHeight
  ) {
    throw new Error(
      `Sprite ${sprite.name} is outside its ${sheetWidth}x${sheetHeight} sheet.`,
    );
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("Skin rendering requires a browser document context.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function renderSpriteSheet(
  blob: Blob,
  sprites: readonly SkinSprite[],
): Promise<Map<string, string>> {
  const image = await decodeImage(blob);
  try {
    const { width: sheetWidth, height: sheetHeight } = imageDimensions(image);
    const result = new Map<string, string>();

    for (const sprite of sprites) {
      assertSpriteFits(sprite, sheetWidth, sheetHeight);
      const canvas = createCanvas(sprite.width, sprite.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("AMP99 could not create a canvas for skin rendering.");
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, sprite.width, sprite.height);
      context.drawImage(
        image,
        sprite.x,
        sprite.y,
        sprite.width,
        sprite.height,
        0,
        0,
        sprite.width,
        sprite.height,
      );
      result.set(sprite.name, canvas.toDataURL("image/png"));
    }
    return result;
  } finally {
    closeDecodedImage(image);
  }
}

function drawTiled(
  context: CanvasRenderingContext2D,
  image: DecodedImage,
  source: { x: number; y: number; width: number; height: number },
  destination: { x: number; y: number; width: number; height: number },
): void {
  context.save();
  context.beginPath();
  context.rect(destination.x, destination.y, destination.width, destination.height);
  context.clip();

  for (let y = destination.y; y < destination.y + destination.height; y += source.height) {
    for (let x = destination.x; x < destination.x + destination.width; x += source.width) {
      context.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        x,
        y,
        source.width,
        source.height,
      );
    }
  }
  context.restore();
}

async function renderPlaylistChrome(blob: Blob): Promise<Map<string, string>> {
  const image = await decodeImage(blob);
  try {
    const { width, height } = imageDimensions(image);
    if (width < 276 || height < 110) {
      throw new Error(`PLEDIT sheet is too small (${width}x${height}).`);
    }

    const result = new Map<string, string>();
    const makeNormal = (active: boolean) => {
      const canvas = createCanvas(PLAYLIST_WIDTH, PLAYLIST_HEIGHT);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("AMP99 could not create playlist skin canvas.");
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#000";
      context.fillRect(0, 0, PLAYLIST_WIDTH, PLAYLIST_HEIGHT);

      const topY = active ? 0 : 21;
      context.drawImage(image, 0, topY, 25, 20, 0, 0, 25, 20);
      drawTiled(
        context,
        image,
        { x: 127, y: topY, width: 25, height: 20 },
        { x: 25, y: 0, width: 225, height: 20 },
      );
      context.drawImage(image, 153, topY, 25, 20, 250, 0, 25, 20);
      context.drawImage(image, 26, topY, 100, 20, 87, 0, 100, 20);

      const sideHeight = PLAYLIST_HEIGHT - 20 - PLAYLIST_BOTTOM_HEIGHT;
      drawTiled(
        context,
        image,
        { x: 0, y: 42, width: 25, height: 29 },
        { x: 0, y: 20, width: 25, height: sideHeight },
      );
      drawTiled(
        context,
        image,
        { x: 26, y: 42, width: 25, height: 29 },
        { x: 250, y: 20, width: 25, height: sideHeight },
      );

      const bottomY = PLAYLIST_HEIGHT - PLAYLIST_BOTTOM_HEIGHT;
      context.drawImage(image, 0, 72, 125, 38, 0, bottomY, 125, 38);
      context.drawImage(image, 126, 72, 150, 38, 125, bottomY, 150, 38);
      return canvas.toDataURL("image/png");
    };

    const makeShade = (active: boolean) => {
      const canvas = createCanvas(PLAYLIST_WIDTH, 14);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("AMP99 could not create playlist shade canvas.");
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 72, 42, 25, 14, 0, 0, 25, 14);
      drawTiled(
        context,
        image,
        { x: 72, y: 57, width: 25, height: 14 },
        { x: 25, y: 0, width: 200, height: 14 },
      );
      context.drawImage(
        image,
        99,
        active ? 42 : 57,
        50,
        14,
        225,
        0,
        50,
        14,
      );
      return canvas.toDataURL("image/png");
    };

    result.set("playlist.windowBackgroundActive", makeNormal(true));
    result.set("playlist.windowBackgroundInactive", makeNormal(false));
    result.set("playlist.shadeBackgroundActive", makeShade(true));
    result.set("playlist.shadeBackgroundInactive", makeShade(false));
    return result;
  } finally {
    closeDecodedImage(image);
  }
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const hex = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) return `#${hex[1].toLowerCase()}`;

  const rgb = /^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i.exec(trimmed);
  if (!rgb) return null;
  const channels = rgb.slice(1).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) return null;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

async function readPlaylistColors(skin: ImportedSkin): Promise<PlaylistSkinColors> {
  const blob = getImportedSkinAsset(skin, "pledit.txt");
  if (!blob) return { ...DEFAULT_PLAYLIST_COLORS };

  try {
    const values = new Map<string, string>();
    for (const rawLine of (await blob.text()).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";") || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      values.set(
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      );
    }

    const pick = (key: string, fallback: string) =>
      normalizeHex(values.get(key) ?? "") ?? fallback;

    return {
      normal: pick("normal", DEFAULT_PLAYLIST_COLORS.normal),
      current: pick("current", DEFAULT_PLAYLIST_COLORS.current),
      normalBackground: pick("normalbg", DEFAULT_PLAYLIST_COLORS.normalBackground),
      selectedBackground: pick("selectedbg", DEFAULT_PLAYLIST_COLORS.selectedBackground),
    };
  } catch {
    return { ...DEFAULT_PLAYLIST_COLORS };
  }
}

export async function renderCoreSkinSprites(
  skin: ImportedSkin,
): Promise<RenderedSkinSprites> {
  const sprites = new Map<string, string>();
  const loadedSheets: SkinSpriteSheet[] = [];
  const skippedSheets: SkinSpriteSheet[] = [];
  const warnings: string[] = [];

  for (const sheet of CORE_SHEETS) {
    const blob = getImportedSkinAsset(skin, sheet);
    if (!blob) {
      if (sheet === "main") {
        throw new Error("Imported skin is missing its required MAIN image sheet.");
      }
      skippedSheets.push(sheet);
      warnings.push(`Optional ${sheet.toUpperCase()} sheet is missing.`);
      continue;
    }

    try {
      const rendered = await renderSpriteSheet(blob, CORE_CLASSIC_SPRITES[sheet]);
      for (const [name, url] of rendered) sprites.set(name, url);

      if (sheet === "pledit") {
        const chrome = await renderPlaylistChrome(blob);
        for (const [name, url] of chrome) sprites.set(name, url);
      }
      loadedSheets.push(sheet);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown render error.";
      if (sheet === "main") {
        throw new Error(`Failed to render required MAIN sheet: ${message}`);
      }
      skippedSheets.push(sheet);
      warnings.push(`Skipped ${sheet.toUpperCase()}: ${message}`);
    }
  }

  return {
    skinName: skin.name,
    sprites,
    loadedSheets,
    skippedSheets,
    warnings,
    playlistColors: await readPlaylistColors(skin),
  };
}
