import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importWinampSkin } from "../src/skins/skinLoader";

async function skinFile(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes], "nostalgia.wsz", { type: "application/zip" });
}

describe("Winamp skin archive loading", () => {
  it("finds nested and case-varied MAIN assets", async () => {
    const imported = await importWinampSkin(
      await skinFile({ "Classic Skin/MAIN.BMP": "not-an-image" }),
    );

    expect(imported.name).toBe("nostalgia");
    expect(imported.assetIndex.get("main")).toBe("main.bmp");
  });

  it("rejects an archive without the required main sheet", async () => {
    await expect(importWinampSkin(await skinFile({ "PLEDIT.TXT": "#00ff00" }))).rejects.toThrow(
      /main\.bmp\/main\.png is missing/i,
    );
  });

  it("rejects traversal paths", async () => {
    await expect(
      importWinampSkin(await skinFile({ "../../MAIN.BMP": "unsafe" })),
    ).rejects.toThrow(/unsafe file path/i);
  });
});
