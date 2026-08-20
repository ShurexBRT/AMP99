import { useRef, useState } from "react";
import { showPreferencesWindow } from "../preferences/nativePreferences";
import type { SkinLoadSummary } from "../skins/useSkinManager";
import type { SpotifyPlaylist, SpotifyTrack } from "../spotify/types";
import type { Track, WindowPosition } from "../types/player";
import { startNativeWindowResize } from "../windowing/nativeWindowHost";
import { WindowFrame } from "./WindowFrame";

type Props = {
  position: WindowPosition;
  tracks: Track[];
  currentIndex: number;
  activeSkin: string;
  skinLoading: boolean;
  spotifyAuthenticated: boolean;
  spotifyDisplayName: string | null;
  spotifyPlaylists: SpotifyPlaylist[];
  spotifyLoading: boolean;
  spotifyError: string | null;
  activeSpotifyPlaylist: SpotifyPlaylist | null;
  spotifyPlaylistEditable: boolean;
  spotifyPlaylistReorderSafe: boolean;
  onMove: (position: WindowPosition) => void;
  onSelectTrack: (index: number) => void;
  onLoadSkin: (file: File) => Promise<SkinLoadSummary>;
  onResetSkin: () => void;
  onConnectSpotify: () => Promise<void>;
  onDisconnectSpotify: () => void;
  onRefreshSpotify: () => Promise<void>;
  onLoadSpotifyPlaylist: (
    playlist: SpotifyPlaylist,
  ) => Promise<{ trackCount: number; skippedNonTracks: number }>;
  onLoadLikedSongs: () => Promise<{ trackCount: number }>;
  onCreateSpotifyPlaylist: (
    name: string,
    isPublic: boolean,
  ) => Promise<SpotifyPlaylist>;
  onSearchSpotifyTracks: (query: string) => Promise<SpotifyTrack[]>;
  onAddSpotifyTrack: (track: SpotifyTrack) => Promise<{ trackCount: number }>;
  onRemoveSpotifyTrack: (track: Track) => Promise<{ trackCount: number }>;
  onMoveSpotifyTrack: (
    direction: -1 | 1,
  ) => Promise<{ trackCount: number; newIndex: number }>;
  onClearQueue: () => void;
};

type Menu = "add" | "misc" | "list" | "spotify" | null;

function time(value: number) {
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operation failed";
}

export function PlaylistEditor({
  position,
  tracks,
  currentIndex,
  activeSkin,
  skinLoading,
  spotifyAuthenticated,
  spotifyDisplayName,
  spotifyPlaylists,
  spotifyLoading,
  spotifyError,
  activeSpotifyPlaylist,
  spotifyPlaylistEditable,
  spotifyPlaylistReorderSafe,
  onMove,
  onSelectTrack,
  onLoadSkin,
  onResetSkin,
  onConnectSpotify,
  onDisconnectSpotify,
  onRefreshSpotify,
  onLoadSpotifyPlaylist,
  onLoadLikedSongs,
  onCreateSpotifyPlaylist,
  onSearchSpotifyTracks,
  onAddSpotifyTrack,
  onRemoveSpotifyTrack,
  onMoveSpotifyTrack,
  onClearQueue,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [status, setStatus] = useState("LOCAL DEMO QUEUE");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);

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
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const resetSkin = () => {
    onResetSkin();
    setMenu(null);
    setStatus("AMP99 DEFAULT SKIN RESTORED");
  };

  const connectSpotify = async () => {
    setMenu(null);
    setStatus("CONNECTING TO SPOTIFY...");
    try {
      await onConnectSpotify();
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const refreshSpotify = async () => {
    setMenu(null);
    setStatus("REFRESHING SPOTIFY LIBRARY...");
    try {
      await onRefreshSpotify();
      setStatus("SPOTIFY LIBRARY REFRESHED");
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const loadSpotifyPlaylist = async (playlist: SpotifyPlaylist) => {
    setMenu(null);
    setStatus(`LOADING: ${playlist.name.toUpperCase()}...`);
    try {
      const result = await onLoadSpotifyPlaylist(playlist);
      const skipped = result.skippedNonTracks
        ? ` · ${result.skippedNonTracks} NON-TRACK ITEM${result.skippedNonTracks === 1 ? "" : "S"} SKIPPED`
        : "";
      setStatus(
        `SPOTIFY: ${playlist.name.toUpperCase()} · ${result.trackCount} TRACKS${skipped}`,
      );
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const loadLikedSongs = async () => {
    setMenu(null);
    setStatus("LOADING LIKED SONGS...");
    try {
      const result = await onLoadLikedSongs();
      setStatus(`SPOTIFY: LIKED SONGS · ${result.trackCount} TRACKS`);
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const submitNewPlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      setStatus("PLAYLIST NAME IS REQUIRED");
      return;
    }

    setStatus("CREATING SPOTIFY PLAYLIST...");
    try {
      const created = await onCreateSpotifyPlaylist(name, newPlaylistPublic);
      setCreateDialogOpen(false);
      setNewPlaylistName("");
      setNewPlaylistPublic(false);
      setStatus(`CREATED SPOTIFY PLAYLIST: ${created.name.toUpperCase()} · EDIT MODE`);
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setStatus("ENTER A SPOTIFY SEARCH QUERY");
      return;
    }

    setStatus(`SEARCHING SPOTIFY: ${query.toUpperCase()}...`);
    try {
      const results = await onSearchSpotifyTracks(query);
      setSearchResults(results);
      setStatus(`SPOTIFY SEARCH: ${results.length} RESULTS`);
    } catch (error) {
      setSearchResults([]);
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const addSearchResult = async (track: SpotifyTrack) => {
    setStatus(`ADDING: ${track.artist.toUpperCase()} - ${track.title.toUpperCase()}...`);
    try {
      const result = await onAddSpotifyTrack(track);
      setStatus(`ADDED TO ${activeSpotifyPlaylist?.name.toUpperCase() ?? "SPOTIFY PLAYLIST"} · ${result.trackCount} TRACKS`);
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const removeCurrentTrack = async () => {
    const track = tracks[currentIndex];
    if (!track) {
      setStatus("NO TRACK SELECTED");
      return;
    }

    setStatus(`REMOVING: ${track.artist.toUpperCase()} - ${track.title.toUpperCase()}...`);
    try {
      const result = await onRemoveSpotifyTrack(track);
      setStatus(`REMOVED FROM ${activeSpotifyPlaylist?.name.toUpperCase() ?? "SPOTIFY PLAYLIST"} · ${result.trackCount} TRACKS`);
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const moveCurrentTrack = async (direction: -1 | 1) => {
    setMenu(null);
    const action = direction < 0 ? "UP" : "DOWN";
    setStatus(`MOVING TRACK ${action}...`);

    try {
      const result = await onMoveSpotifyTrack(direction);
      setStatus(
        `MOVED TRACK ${action} · POSITION ${result.newIndex + 1}/${result.trackCount}`,
      );
    } catch (error) {
      setStatus(errorMessage(error).toUpperCase());
    }
  };

  const clearQueue = () => {
    onClearQueue();
    setMenu(null);
    setStatus("QUEUE CLEARED");
  };

  const disconnectSpotify = () => {
    onDisconnectSpotify();
    setMenu(null);
    setStatus("SPOTIFY DISCONNECTED");
  };

  const editContext = activeSpotifyPlaylist
    ? `${activeSpotifyPlaylist.name.toUpperCase()} ${spotifyPlaylistEditable ? "[EDIT]" : "[READ ONLY]"}${spotifyPlaylistEditable && !spotifyPlaylistReorderSafe ? " [MOVE LOCKED]" : ""}`
    : null;
  const canMove =
    spotifyPlaylistEditable &&
    spotifyPlaylistReorderSafe &&
    !spotifyLoading &&
    tracks.length > 1;

  return (
    <WindowFrame title="AMP99 PLAYLIST EDITOR" position={position} width={275} height={232} onMove={onMove} className="playlist-window">
      <div className="playlist-list" onClick={() => setMenu(null)}>
        {tracks.length === 0 ? (
          <div className="playlist-empty">QUEUE IS EMPTY</div>
        ) : tracks.map((track, index) => (
          <button key={`${track.source ?? "local"}-${track.id}-${index}`} className={`playlist-row ${index === currentIndex ? "selected" : ""}`} onDoubleClick={() => onSelectTrack(index)}>
            <span className="track-index">{index + 1}.</span>
            <span className="track-name">{track.artist} - {track.title}</span>
            <span className="track-time">{time(track.duration)}</span>
          </button>
        ))}
      </div>
      <div className="playlist-status">
        {spotifyError ? `SPOTIFY: ${spotifyError.toUpperCase()} · ` : ""}
        {editContext ? `${editContext} · ` : ""}
        {status} · {activeSkin.toUpperCase()}
      </div>
      <div className="playlist-toolbar">
        <div className="menu-anchor">
          <button onClick={() => setMenu(menu === "add" ? null : "add")}>ADD</button>
          {menu === "add" && (
            <div className="popup-menu">
              <button
                disabled={!spotifyAuthenticated || !spotifyPlaylistEditable || spotifyLoading}
                onClick={() => { setMenu(null); setSearchDialogOpen(true); }}
              >
                Spotify Search...
              </button>
              <button disabled={!spotifyAuthenticated || spotifyLoading} onClick={() => void loadLikedSongs()}>Liked Songs</button>
              <button disabled={!spotifyAuthenticated || spotifyLoading} onClick={() => setMenu("spotify")}>Spotify Playlist...</button>
            </div>
          )}
        </div>
        <button
          disabled={!spotifyPlaylistEditable || spotifyLoading || !tracks[currentIndex]?.uri}
          title={spotifyPlaylistEditable ? "Remove selected track from Spotify playlist" : "Load an editable Spotify playlist first"}
          onClick={() => void removeCurrentTrack()}
        >REM</button>
        <button>SEL</button>
        <div className="menu-anchor">
          <button onClick={() => setMenu(menu === "misc" ? null : "misc")}>MISC</button>
          {menu === "misc" && (
            <div className="popup-menu misc-menu">
              <button disabled={!canMove || currentIndex <= 0} onClick={() => void moveCurrentTrack(-1)}>Move Up</button>
              <button disabled={!canMove || currentIndex >= tracks.length - 1} onClick={() => void moveCurrentTrack(1)}>Move Down</button>
              {!spotifyPlaylistReorderSafe && activeSpotifyPlaylist && (
                <button disabled>Move locked: non-track items</button>
              )}
            </div>
          )}
        </div>
        <div className="menu-anchor list-options">
          <button onClick={() => setMenu(menu === "list" ? null : "list")}>LIST OPTS</button>
          {menu === "list" && (
            <div className="popup-menu align-right list-opts-menu">
              {!spotifyAuthenticated ? (
                <button disabled={spotifyLoading} onClick={() => void connectSpotify()}>
                  {spotifyLoading ? "Connecting..." : "Connect Spotify..."}
                </button>
              ) : (
                <>
                  <button disabled={spotifyLoading} onClick={() => setMenu("spotify")}>Spotify Playlists &gt;</button>
                  <button disabled={spotifyLoading} onClick={() => void loadLikedSongs()}>Liked Songs</button>
                  <button disabled={spotifyLoading} onClick={() => { setMenu(null); setCreateDialogOpen(true); }}>New Spotify Playlist...</button>
                  <button disabled={spotifyLoading} onClick={() => void refreshSpotify()}>Refresh Spotify Library</button>
                  <button onClick={disconnectSpotify}>Disconnect {spotifyDisplayName || "Spotify"}</button>
                </>
              )}
              <span className="popup-separator" aria-hidden="true" />
              <button disabled={skinLoading} onClick={() => fileInput.current?.click()}>
                {skinLoading ? "Loading Skin..." : "Load Skin..."}
              </button>
              <button onClick={resetSkin}>Use AMP99 Default</button>
              <span className="popup-separator" aria-hidden="true" />
              <button onClick={() => { setMenu(null); void showPreferencesWindow(); }}>Preferences...</button>
              <span className="popup-separator" aria-hidden="true" />
              <button onClick={clearQueue}>Clear Playlist</button>
            </div>
          )}
          {menu === "spotify" && (
            <div className="popup-menu align-right spotify-playlist-menu">
              <div className="popup-menu-title">SPOTIFY PLAYLISTS</div>
              {spotifyPlaylists.length === 0 ? (
                <button disabled>{spotifyLoading ? "Loading..." : "No playlists found"}</button>
              ) : (
                spotifyPlaylists.map((playlist) => (
                  <button
                    key={playlist.id}
                    disabled={spotifyLoading}
                    className="spotify-playlist-menu-item"
                    title={`${playlist.name} · ${playlist.ownerName}`}
                    onClick={() => void loadSpotifyPlaylist(playlist)}
                  >
                    <span>{playlist.name}</span>
                    <small>{playlist.totalItems}</small>
                  </button>
                ))
              )}
              <span className="popup-separator" aria-hidden="true" />
              <button onClick={() => setMenu("list")}>&lt; Back</button>
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

      <button
        type="button"
        className="playlist-resize-handle"
        aria-label="Resize Playlist Editor"
        title="Drag to resize Playlist Editor"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void startNativeWindowResize("playlist", "SouthEast");
        }}
      />

      {createDialogOpen && (
        <div className="playlist-dialog-backdrop" role="presentation">
          <div className="classic-dialog" role="dialog" aria-modal="true" aria-labelledby="new-playlist-title">
            <div id="new-playlist-title" className="classic-dialog-title">NEW SPOTIFY PLAYLIST</div>
            <label className="classic-dialog-field">
              <span>Playlist name:</span>
              <input
                autoFocus
                maxLength={100}
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !spotifyLoading) void submitNewPlaylist();
                  if (event.key === "Escape") setCreateDialogOpen(false);
                }}
              />
            </label>
            <label className="classic-dialog-check">
              <input type="checkbox" checked={newPlaylistPublic} onChange={(event) => setNewPlaylistPublic(event.target.checked)} />
              Public playlist
            </label>
            <div className="classic-dialog-actions">
              <button disabled={spotifyLoading || !newPlaylistName.trim()} onClick={() => void submitNewPlaylist()}>
                {spotifyLoading ? "CREATING..." : "CREATE"}
              </button>
              <button disabled={spotifyLoading} onClick={() => setCreateDialogOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {searchDialogOpen && (
        <div className="playlist-dialog-backdrop" role="presentation">
          <div className="classic-dialog spotify-search-dialog" role="dialog" aria-modal="true" aria-labelledby="spotify-search-title">
            <div id="spotify-search-title" className="classic-dialog-title">SPOTIFY SEARCH</div>
            <div className="spotify-search-controls">
              <input
                autoFocus
                value={searchQuery}
                placeholder="Artist or track..."
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !spotifyLoading) void runSearch();
                  if (event.key === "Escape") setSearchDialogOpen(false);
                }}
              />
              <button disabled={spotifyLoading || !searchQuery.trim()} onClick={() => void runSearch()}>SEARCH</button>
            </div>
            <div className="spotify-search-results">
              {searchResults.length === 0 ? (
                <div className="spotify-search-empty">{spotifyLoading ? "SEARCHING..." : "NO RESULTS YET"}</div>
              ) : searchResults.map((track) => (
                <button
                  key={track.id}
                  disabled={spotifyLoading}
                  title={`Add ${track.artist} - ${track.title}`}
                  onClick={() => void addSearchResult(track)}
                >
                  <span className="search-add-mark">+</span>
                  <span className="search-track-text">{track.artist} - {track.title}</span>
                  <small>{time(track.durationSeconds)}</small>
                </button>
              ))}
            </div>
            <div className="classic-dialog-actions">
              <button disabled={spotifyLoading} onClick={() => setSearchDialogOpen(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </WindowFrame>
  );
}
