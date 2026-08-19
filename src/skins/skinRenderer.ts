import { getImportedSkinAsset, type ImportedSkin } from "./skinLoader";
import {
  CORE_CLASSIC_SPRITES,
  type SkinSprite,
  type SkinSpriteSheet,
} from "./spriteManifest";

const CORE_SHEETS: readonly SkinSpriteSheet[] = [
  "main",
  "cbuttons",
  "numbers",
  "playpaus",
];

type DecodedImage = ImageBitmap | HTMLImageElement;

export type RenderedSkinSprites = {
  skinName: string;
  sprites: Map<string, string>;
  loadedSheets: SkinSpriteSheet[];
  skippedSheets: SkinSpriteSheet[];
  warnings: string[];
};

function imageDimensions(image: DecodedImage): { width: number; height: number } {
  return {
    width: image.width,
    height: image.height,
  };
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
      // Some WebViews are stricter about BMP decoding through createImageBitmap.
      // The HTMLImageElement path below gives us a second native decoder.
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

  if (!validGeometry) {
    throw new Error(`Invalid sprite geometry for ${sprite.name}.`);
  }

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
      if (!context) {
        throw new Error("AMP99 could not create a canvas for skin rendering.");
      }

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
      const rendered = await renderSpriteSheet(
        blob,
        CORE_CLASSIC_SPRITES[sheet],
      );

      for (const [name, url] of rendered) {
        sprites.set(name, url);
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
  };
}
