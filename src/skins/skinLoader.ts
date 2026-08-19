import JSZip from "jszip";

const SUPPORTED_ASSETS = [
  "main.bmp",
  "titlebar.bmp",
  "cbuttons.bmp",
  "shufrep.bmp",
  "volume.bmp",
  "balance.bmp",
  "numbers.bmp",
  "playpaus.bmp",
  "eqmain.bmp",
  "pledit.bmp",
  "pledit.txt",
  "viscolor.txt",
] as const;

export type ImportedSkin = {
  name: string;
  supportedAssets: string[];
  files: Map<string, Blob>;
};

export async function importWinampSkin(file: File): Promise<ImportedSkin> {
  if (!file.name.toLowerCase().endsWith(".wsz") && !file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("AMP99 expects a Winamp .wsz skin or ZIP archive.");
  }

  const zip = await JSZip.loadAsync(file);
  const files = new Map<string, Blob>();
  const byLowerName = new Map(Object.keys(zip.files).map((name) => [name.split("/").pop()?.toLowerCase(), name]));

  for (const asset of SUPPORTED_ASSETS) {
    const archivePath = byLowerName.get(asset);
    if (!archivePath || zip.files[archivePath].dir) continue;
    const blob = await zip.files[archivePath].async("blob");
    files.set(asset, blob);
  }

  if (!files.has("main.bmp")) {
    throw new Error("This archive does not look like a classic Winamp skin (main.bmp is missing).");
  }

  return {
    name: file.name.replace(/\.(wsz|zip)$/i, ""),
    supportedAssets: [...files.keys()],
    files,
  };
}
