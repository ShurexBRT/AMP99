import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  broadcastSkinFile,
  broadcastSkinReset,
  subscribeSkinSync,
} from "../windowing/bridge";
import { importWinampSkin } from "./skinLoader";
import {
  renderCoreSkinSprites,
  type RenderedSkinSprites,
} from "./skinRenderer";

const DEFAULT_SKIN_NAME = "AMP99 Default";
const OPEN_SKIN_EVENT = "amp99://open-skin";
let sharedRenderedSkin: RenderedSkinSprites | null = null;
const sharedListeners = new Set<() => void>();

function publishSharedSkin(next: RenderedSkinSprites | null) {
  sharedRenderedSkin = next;
  for (const listener of sharedListeners) listener();
}

function subscribeSharedSkin(listener: () => void) {
  sharedListeners.add(listener);
  return () => sharedListeners.delete(listener);
}

function filenameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "AMP99-skin.wsz";
}

export function useCurrentSkin(): RenderedSkinSprites | null {
  return useSyncExternalStore(
    subscribeSharedSkin,
    () => sharedRenderedSkin,
    () => null,
  );
}

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

  const applySkin = useCallback(
    async (file: File, broadcast: boolean): Promise<SkinLoadSummary> => {
      setLoading(true);

      try {
        const imported = await importWinampSkin(file);
        const rendered = await renderCoreSkinSprites(imported);

        setActiveSkin(imported.name);
        setRenderedSkin(rendered);
        publishSharedSkin(rendered);

        if (broadcast && isTauri()) {
          broadcastSkinFile(file.name, await file.arrayBuffer());
        }

        return {
          name: imported.name,
          assetCount: imported.supportedAssets.length,
          renderedSpriteCount: rendered.sprites.size,
          warnings: rendered.warnings,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadSkin = useCallback(
    (file: File) => applySkin(file, true),
    [applySkin],
  );

  const loadSkinPath = useCallback(
    async (path: string) => {
      const bytes = await invoke<number[]>("read_skin_file", { path });
      const file = new File([new Uint8Array(bytes)], filenameFromPath(path), {
        type: "application/zip",
      });
      // The native file-association event is emitted to every AMP99 webview already,
      // so do not rebroadcast and create duplicate decoding work.
      return applySkin(file, false);
    },
    [applySkin],
  );

  useEffect(() => {
    const unsubscribe = subscribeSkinSync((event) => {
      if (event.type === "reset") {
        setActiveSkin(DEFAULT_SKIN_NAME);
        setRenderedSkin(null);
        publishSharedSkin(null);
        return;
      }

      const file = new File([event.bytes], event.name, {
        type: "application/zip",
      });
      void applySkin(file, false).catch((error) => {
        console.error("AMP99 could not synchronize skin across windows:", error);
      });
    });
    return unsubscribe;
  }, [applySkin]);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      unlisten = await listen<string>(OPEN_SKIN_EVENT, (event) => {
        if (!disposed && event.payload) {
          void loadSkinPath(event.payload).catch((error) => {
            console.error("AMP99 could not open associated skin:", error);
          });
        }
      });

      if (disposed) {
        unlisten();
        return;
      }

      const pending = await invoke<string | null>("take_pending_skin");
      if (!disposed && pending) {
        await loadSkinPath(pending);
      }
    })().catch((error) => {
      console.error("AMP99 skin file-association setup failed:", error);
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [loadSkinPath]);

  const resetSkin = useCallback(() => {
    setActiveSkin(DEFAULT_SKIN_NAME);
    setRenderedSkin(null);
    publishSharedSkin(null);
    if (isTauri()) broadcastSkinReset();
  }, []);

  return {
    activeSkin,
    loading,
    renderedSkin,
    sprites: renderedSkin?.sprites ?? null,
    playlistColors: renderedSkin?.playlistColors ?? null,
    warnings: renderedSkin?.warnings ?? [],
    loadSkin,
    resetSkin,
  };
}
