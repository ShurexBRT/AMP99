import { useCallback, useState } from "react";
import { importWinampSkin } from "./skinLoader";
import {
  renderCoreSkinSprites,
  type RenderedSkinSprites,
} from "./skinRenderer";

const DEFAULT_SKIN_NAME = "AMP99 Default";

export type SkinLoadSummary = {
  name: string;
  assetCount: number;
  renderedSpriteCount: number;
  warnings: string[];
};

export function useSkinManager() {
  const [activeSkin, setActiveSkin] = useState(DEFAULT_SKIN_NAME);
  const [renderedSkin, setRenderedSkin] = useState<RenderedSkinSprites | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const loadSkin = useCallback(async (file: File): Promise<SkinLoadSummary> => {
    setLoading(true);

    try {
      const imported = await importWinampSkin(file);
      const rendered = await renderCoreSkinSprites(imported);

      setActiveSkin(imported.name);
      setRenderedSkin(rendered);

      return {
        name: imported.name,
        assetCount: imported.supportedAssets.length,
        renderedSpriteCount: rendered.sprites.size,
        warnings: rendered.warnings,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetSkin = useCallback(() => {
    setActiveSkin(DEFAULT_SKIN_NAME);
    setRenderedSkin(null);
  }, []);

  return {
    activeSkin,
    loading,
    renderedSkin,
    sprites: renderedSkin?.sprites ?? null,
    warnings: renderedSkin?.warnings ?? [],
    loadSkin,
    resetSkin,
  };
}
