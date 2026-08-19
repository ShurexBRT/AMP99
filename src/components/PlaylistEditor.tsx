import { useRef, useState } from "react";
import type { SkinLoadSummary } from "../skins/useSkinManager";
import type { Track, WindowPosition } from "../types/player";
import { WindowFrame } from "./WindowFrame";

type Props = {
  position: WindowPosition;
  tracks: Track[];
  currentIndex: number;
  activeSkin: string;
  skinLoading: boolean;
  onMove: (position: WindowPosition) => void;
  onSelectTrack: (index: number) => void;
  onLoadSkin: (file: File) => Promise<SkinLoadSummary>;
  onResetSkin: () => void;
};

function time(value: number) {
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function PlaylistEditor({
  position,
  tracks,
  currentIndex,
  activeSkin,
  skinLoading,
  onMove,
  onSelectTrack,
  onLoadSkin,
  onResetSkin,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<"add" | "list" | null>(null);
  const [status, setStatus] = useState("LOCAL DEMO QUEUE");

  const loadSkin = async (file?: File) => {
    if (!file) return;

    setStatus("LOADING SKIN...");
    try {
      const summary = await onLoadSkin(file);
      const warningSuffix = summary.warnings.length
        ? ` · ${summary.warnings.length} WARNING${summary.warnings.length === 1 ? "" : "S"}`
        : "";
      setStatus(
        `SKIN: ${summary.name.toUpperCase()} (${summary.assetCount} ASSETS / ${summary.renderedSpriteCount} SPRITES)${warningSuffix}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message.toUpperCase() : "SKIN LOAD FAILED");
    }
  };

  const resetSkin = () => {
    onResetSkin();
    setMenu(null);
    setStatus("AMP99 DEFAULT SKIN RESTORED");
  };

  return (
    <WindowFrame title="AMP99 PLAYLIST EDITOR" position={position} width={275} height={232} onMove={onMove} className="playlist-window">
      <div className="playlist-list" onClick={() => setMenu(null)}>
        {tracks.map((track, index) => (
          <button key={track.id} className={`playlist-row ${index === currentIndex ? "selected" : ""}`} onDoubleClick={() => onSelectTrack(index)}>
            <span className="track-index">{index + 1}.</span>
            <span className="track-name">{track.artist} - {track.title}</span>
            <span className="track-time">{time(track.duration)}</span>
          </button>
        ))}
      </div>
      <div className="playlist-status">{status} · {activeSkin.toUpperCase()}</div>
      <div className="playlist-toolbar">
        <div className="menu-anchor">
          <button onClick={() => setMenu(menu === "add" ? null : "add")}>ADD</button>
          {menu === "add" && <div className="popup-menu"><button disabled>Spotify Search...</button><button disabled>Liked Songs</button><button disabled>Spotify Playlist...</button></div>}
        </div>
        <button>REM</button>
        <button>SEL</button>
        <button>MISC</button>
        <div className="menu-anchor list-options">
          <button onClick={() => setMenu(menu === "list" ? null : "list")}>LIST OPTS</button>
          {menu === "list" && (
            <div className="popup-menu align-right">
              <button disabled>Spotify Playlists</button>
              <button disabled>Create Spotify Playlist...</button>
              <button disabled={skinLoading} onClick={() => fileInput.current?.click()}>
                {skinLoading ? "Loading Skin..." : "Load Winamp Skin..."}
              </button>
              <button onClick={resetSkin}>Use AMP99 Default</button>
              <button onClick={() => setStatus("QUEUE CLEARED (DEMO ONLY)")}>Clear Playlist</button>
            </div>
          )}
        </div>
        <input
          ref={fileInput}
          className="hidden-file"
          type="file"
          accept=".wsz,.zip"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void loadSkin(file);
          }}
        />
      </div>
    </WindowFrame>
  );
}
