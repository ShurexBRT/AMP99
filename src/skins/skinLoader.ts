import JSZip from "jszip";

const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 32 * 1024 * 1024;

const IMAGE_ASSET_BASES = new Set([
  "main",
  "titlebar",
  "cbuttons",
  "shufrep",
  "volume",
  "balance",
  "numbers",
  "nums_ex",
  "playpaus",
  "monoster",
  "posbar",
  "text",
  "eqmain",
  "eq_ex",
  "pledit",
  "genex",
]);

const TEXT_ASSETS = new Set([
  "pledit.txt",
  "viscolor.txt",
  "region.txt",
]);

type AssetCandidate = {
  logicalName: string;
  canonicalName: string;
  archivePath: string;
  entry: JSZip.JSZipObject;
  mimeType: string;
};

type ZipEntryWithMetadata = JSZip.JSZipObject & {
  unsafeOriginalName?: string;
  _data?: {
    uncompressedSize?: number;
  };
};

export type ImportedSkin = {
  name: string;
  supportedAssets: string[];
  files: Map<string, Blob>;
  /** Maps logical sheet names such as `main` to the extracted file key. */
  assetIndex: Map<string, string>;
};

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function assertSafeArchivePath(path: string): void {
  if (!path || path.includes("\0")) {
    throw new Error("Skin archive contains an invalid file path.");
  }

  const normalized = path.replace(/\\/g, "/");
  const isAbsolute =
    normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized);
  const hasTraversal = normalized
    .split("/")
    .some((segment) => segment === "..");

  if (isAbsolute || hasTraversal) {
    throw new Error("Skin archive contains an unsafe file path.");
  }
}

function declaredUncompressedSize(entry: JSZip.JSZipObject): number | null {
  const value = (entry as ZipEntryWithMetadata)._data?.uncompressedSize;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mimeTypeFor(filename: string): string {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".bmp")) return "image/bmp";
  if (filename.endsWith(".txt")) return "text/plain;charset=utf-8";
  return "application/octet-stream";
}

function toCandidate(entry: JSZip.JSZipObject): AssetCandidate | null {
  if (entry.dir) return null;

  const lowerBaseName = basename(entry.name).toLowerCase();
  const imageMatch = /^([a-z0-9_]+)\.(bmp|png)$/.exec(lowerBaseName);

  if (imageMatch && IMAGE_ASSET_BASES.has(imageMatch[1])) {
    return {
      logicalName: imageMatch[1],
      canonicalName: lowerBaseName,
      archivePath: entry.name,
      entry,
      mimeType: mimeTypeFor(lowerBaseName),
    };
  }

  if (TEXT_ASSETS.has(lowerBaseName)) {
    return {
      logicalName: lowerBaseName,
      canonicalName: lowerBaseName,
      archivePath: entry.name,
      entry,
      mimeType: mimeTypeFor(lowerBaseName),
    };
  }

  return null;
}

function validateCandidateSize(candidate: AssetCandidate): void {
  const declaredSize = declaredUncompressedSize(candidate.entry);
  if (declaredSize !== null && declaredSize > MAX_ASSET_BYTES) {
    throw new Error(
      `Skin asset ${candidate.canonicalName} exceeds the ${MAX_ASSET_BYTES / 1024 / 1024} MB safety limit.`,
    );
  }
}

async function extractCandidate(candidate: AssetCandidate): Promise<Blob> {
  validateCandidateSize(candidate);
  const buffer = await candidate.entry.async("arraybuffer");

  if (buffer.byteLength > MAX_ASSET_BYTES) {
    throw new Error(
      `Skin asset ${candidate.canonicalName} exceeds the ${MAX_ASSET_BYTES / 1024 / 1024} MB safety limit.`,
    );
  }

  return new Blob([buffer], { type: candidate.mimeType });
}

/**
 * Imports a classic Winamp-compatible .wsz archive without bundling any
 * third-party skin assets with AMP99.
 *
 * Asset lookup is intentionally case-insensitive and accepts assets nested in
 * folders because real legacy skins commonly depend on Windows' case-insensitive
 * filesystem behavior. When several matching entries exist, the later ZIP entry
 * wins, matching the compatibility behavior used by Webamp.
 */
export async function importWinampSkin(file: File): Promise<ImportedSkin> {
  const lowerFileName = file.name.toLowerCase();
  if (!lowerFileName.endsWith(".wsz") && !lowerFileName.endsWith(".zip")) {
    throw new Error("AMP99 expects a Winamp .wsz skin or ZIP archive.");
  }

  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error(
      `Skin archive exceeds the ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB safety limit.`,
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("AMP99 could not read this skin archive.");
  }

  const candidates = new Map<string, AssetCandidate>();

  for (const entry of Object.values(zip.files)) {
    const metadataEntry = entry as ZipEntryWithMetadata;
    const originalPath = metadataEntry.unsafeOriginalName || entry.name;
    assertSafeArchivePath(originalPath);

    const candidate = toCandidate(entry);
    if (!candidate) continue;

    validateCandidateSize(candidate);
    // Deliberately overwrite: the last case-insensitive matching ZIP entry wins.
    candidates.set(candidate.logicalName, candidate);
  }

  if (!candidates.has("main")) {
    throw new Error(
      "This archive does not look like a classic Winamp skin (main.bmp/main.png is missing).",
    );
  }

  const files = new Map<string, Blob>();
  const assetIndex = new Map<string, string>();
  let extractedBytes = 0;

  for (const [logicalName, candidate] of candidates) {
    const blob = await extractCandidate(candidate);
    extractedBytes += blob.size;

    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      throw new Error(
        `Skin assets exceed the ${MAX_EXTRACTED_BYTES / 1024 / 1024} MB extracted-size safety limit.`,
      );
    }

    files.set(candidate.canonicalName, blob);
    assetIndex.set(logicalName, candidate.canonicalName);
  }

  return {
    name: file.name.replace(/\.(wsz|zip)$/i, ""),
    supportedAssets: [...files.keys()],
    files,
    assetIndex,
  };
}

export function getImportedSkinAsset(
  skin: ImportedSkin,
  logicalName: string,
): Blob | null {
  const normalized = logicalName
    .trim()
    .toLowerCase()
    .replace(/\.(bmp|png)$/i, "");
  const assetKey = skin.assetIndex.get(normalized) ?? skin.assetIndex.get(logicalName.toLowerCase());
  return assetKey ? skin.files.get(assetKey) ?? null : null;
}
