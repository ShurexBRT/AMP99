import { useEffect, useMemo, useState } from "react";
import { Equalizer } from "./components/Equalizer";
import { MainPlayer } from "./components/MainPlayer";
import { PlaylistEditor } from "./components/PlaylistEditor";
import { useSkinManager } from "./skins/useSkinManager";
import { spotifyTracksToPlayerQueue } from "./spotify/playerAdapter";
import { reorderSpotifyPlaylistItem } from "./spotify/playlistReorder";
import type { SpotifyPlaylist, SpotifyTrack } from "./spotify/types";
import { useSpotifyLibrary } from "./spotify/useSpotifyLibrary";
import { useSpotifyPlayback } from "./spotify/useSpotifyPlayback";
import { useAmp99State } from "./state/useAmp99State";
import type { Track } from "./types/player";
import {
  requestMain,
  subscribeMainRequests,
  type MainWindowSnapshot,
} from "./windowing/bridge";
import {
  currentNativeWindowRole,
  setNativeWindowVisible,
} from "./windowing/nativeWindowHost";
import {
  useMainWindowSnapshot,
  useNativeWindowHost,
  usePublishMainWindowSnapshot,
} from "./windowing/useNativeWindowBridge";

const ZERO_POSITION = { x: 0, y: 0 };

const EMPTY_SNAPSHOT: MainWindowSnapshot = {
  tracks: [],
  currentIndex: 0,
  isPlaying: false,
  volume: 74,
  balance: 0,
  progress: 0,
  shuffle: false,
  repeat: false,
  doubleSize: false,
  playlistVisible: true,
  equalizerVisible: true,
  spotifyAuthenticated: false,
  spotifyDisplayName: null,
  spotifyPlaylists: [],
  spotifyLoading: false,
  spotifyError: null,
  activeSpotifyPlaylist: null,
  spotifyPlaylistEditable: false,
  spotifyPlaylistReorderSafe: true,
};

function MainController({ native }: { native: boolean }) {
  const amp = useAmp99State();
  const skin = useSkinManager();
  const spotify = useSpotifyLibrary();
  const [activeSpotifyPlaylist, setActiveSpotifyPlaylist] =
    useState<SpotifyPlaylist | null>(null);
  const [activeSpotifyPlaylistReorderSafe, setActiveSpotifyPlaylistReorderSafe] =
    useState(true);
  const playback = useSpotifyPlayback({
    enabled: spotify.authenticated,
    initialVolume: amp.volume,
  });

  useNativeWindowHost("main", amp.doubleSize);

  const spotifyPlaylistEditable = Boolean(
    activeSpotifyPlaylist &&
      spotify.profile &&
      (activeSpotifyPlaylist.ownerId === spotify.profile.id ||
        activeSpotifyPlaylist.isCollaborative),
  );

  useEffect(() => {
    const snapshot = playback.snapshot;
    if (!snapshot) return;

    amp.setIsPlaying(!snapshot.paused);

    if (snapshot.durationMs > 0) {
      amp.setProgress(
        Math.max(0, Math.min(100, (snapshot.positionMs / snapshot.durationMs) * 100)),
      );
    }

    if (snapshot.currentTrackUri) {
      const index = amp.tracks.findIndex(
        (track) => track.uri === snapshot.currentTrackUri,
      );
      if (index >= 0 && index !== amp.currentIndex) {
        amp.setCurrentIndex(index);
      }
    }
  }, [
    playback.snapshot,
    amp.tracks,
    amp.currentIndex,
    amp.setCurrentIndex,
    amp.setIsPlaying,
    amp.setProgress,
  ]);

  const loadSpotifyPlaylist = async (playlist: SpotifyPlaylist) => {
    const result = await spotify.loadPlaylist(playlist.id);
    amp.replaceQueue(spotifyTracksToPlayerQueue(result.tracks));
    setActiveSpotifyPlaylist(playlist);
    setActiveSpotifyPlaylistReorderSafe(result.skippedNonTracks === 0);
    return {
      trackCount: result.tracks.length,
      skippedNonTracks: result.skippedNonTracks,
    };
  };

  const loadLikedSongs = async () => {
    const tracks = await spotify.loadLikedSongs();
    amp.replaceQueue(spotifyTracksToPlayerQueue(tracks));
    setActiveSpotifyPlaylist(null);
    setActiveSpotifyPlaylistReorderSafe(true);
    return { trackCount: tracks.length };
  };

  const createSpotifyPlaylist = async (name: string, isPublic: boolean) => {
    const created = await spotify.createPlaylist({ name, isPublic });
    setActiveSpotifyPlaylist(created);
    setActiveSpotifyPlaylistReorderSafe(true);
    amp.replaceQueue([]);
    return created;
  };

  const reloadActivePlaylist = async () => {
    if (!activeSpotifyPlaylist) {
      throw new Error("Load an editable Spotify playlist first.");
    }

    const result = await spotify.loadPlaylist(activeSpotifyPlaylist.id);
    amp.replaceQueue(spotifyTracksToPlayerQueue(result.tracks));
    setActiveSpotifyPlaylistReorderSafe(result.skippedNonTracks === 0);
    return result;
  };

  const updateActivePlaylistSnapshot = (
    snapshotId: string | null,
    trackCount: number,
  ) => {
    setActiveSpotifyPlaylist((current) =>
      current
        ? {
            ...current,
            snapshotId: snapshotId ?? current.snapshotId,
            totalItems: trackCount,
          }
        : current,
    );
  };

  const addSpotifyTrack = async (track: SpotifyTrack) => {
    if (!activeSpotifyPlaylist || !spotifyPlaylistEditable) {
      throw new Error("Load a Spotify playlist you can edit first.");
    }

    const snapshotId = await spotify.addTrackToPlaylist(
      activeSpotifyPlaylist.id,
      track.uri,
    );
    const result = await reloadActivePlaylist();
    updateActivePlaylistSnapshot(snapshotId, result.tracks.length);

    return { trackCount: result.tracks.length };
  };

  const removeSpotifyTrack = async (track: Track) => {
    if (!activeSpotifyPlaylist || !spotifyPlaylistEditable || !track.uri) {
      throw new Error("The selected queue item is not editable on Spotify.");
    }

    const duplicateCount = amp.tracks.filter(
      (candidate) => candidate.uri === track.uri,
    ).length;
    if (duplicateCount > 1) {
      throw new Error(
        "This track appears more than once. Spotify's current remove API cannot target one duplicate occurrence safely.",
      );
    }

    const snapshotId = await spotify.removeTrackFromPlaylist(
      activeSpotifyPlaylist.id,
      track.uri,
      activeSpotifyPlaylist.snapshotId,
    );
    const result = await reloadActivePlaylist();
    updateActivePlaylistSnapshot(snapshotId, result.tracks.length);

    return { trackCount: result.tracks.length };
  };

  const moveSpotifyTrack = async (direction: -1 | 1) => {
    if (!activeSpotifyPlaylist || !spotifyPlaylistEditable) {
      throw new Error("Load a Spotify playlist you can edit first.");
    }

    if (!activeSpotifyPlaylistReorderSafe) {
      throw new Error(
        "This playlist contains non-track items. AMP99 will not reorder it until those Spotify positions can be mapped safely.",
      );
    }

    const sourceIndex = amp.currentIndex;
    const targetIndex = sourceIndex + direction;
    if (targetIndex < 0 || targetIndex >= amp.tracks.length) {
      throw new Error(direction < 0 ? "Track is already first." : "Track is already last.");
    }

    const insertBefore = direction < 0 ? targetIndex : sourceIndex + 2;
    const snapshotId = await reorderSpotifyPlaylistItem({
      playlistId: activeSpotifyPlaylist.id,
      rangeStart: sourceIndex,
      insertBefore,
      rangeLength: 1,
      snapshotId: activeSpotifyPlaylist.snapshotId,
    });

    const result = await reloadActivePlaylist();
    updateActivePlaylistSnapshot(snapshotId, result.tracks.length);
    amp.setCurrentIndex(targetIndex);

    return { trackCount: result.tracks.length, newIndex: targetIndex };
  };

  const playTrackAt = async (index: number) => {
    const track = amp.tracks[index];
    if (!track) return;

    amp.setCurrentIndex(index);
    amp.setProgress(0);

    if (track.source === "spotify" && track.uri) {
      try {
        await playback.playTrack(track.uri);
        amp.setIsPlaying(true);
      } catch {
        amp.setIsPlaying(false);
      }
      return;
    }

    amp.setIsPlaying(true);
  };

  const previousTrack = async () => {
    if (amp.tracks.length === 0) return;
    const index =
      (amp.currentIndex - 1 + amp.tracks.length) % amp.tracks.length;
    await playTrackAt(index);
  };

  const nextTrack = async () => {
    if (amp.tracks.length === 0) return;
    const index = (amp.currentIndex + 1) % amp.tracks.length;
    await playTrackAt(index);
  };

  const togglePlay = async () => {
    const track = amp.currentTrack;

    if (track.source !== "spotify" || !track.uri) {
      amp.setIsPlaying((value) => !value);
      return;
    }

    try {
      if (playback.snapshot?.currentTrackUri !== track.uri) {
        await playback.playTrack(track.uri);
        return;
      }

      if (amp.isPlaying) {
        await playback.pause();
      } else {
        await playback.resume();
      }
    } catch {
      // Playback hook exposes the readable error in the shared snapshot.
    }
  };

  const stopPlayback = async () => {
    const track = amp.currentTrack;

    if (track.source === "spotify" && track.uri) {
      try {
        await playback.stop();
      } catch {
        // Playback hook exposes the readable error in the shared snapshot.
      }
    }

    amp.setIsPlaying(false);
    amp.setProgress(0);
  };

  const changeVolume = (value: number) => {
    amp.setVolume(value);
    if (amp.currentTrack.source === "spotify" && playback.connected) {
      void playback.setVolume(value).catch(() => undefined);
    }
  };

  const seek = (value: number) => {
    amp.setProgress(value);
    const durationMs = playback.snapshot?.durationMs ?? 0;
    if (
      amp.currentTrack.source === "spotify" &&
      playback.connected &&
      durationMs > 0
    ) {
      void playback.seek((durationMs * value) / 100).catch(() => undefined);
    }
  };

  const toggleShuffle = () => {
    const next = !amp.shuffle;
    amp.setShuffle(next);
    if (amp.currentTrack.source === "spotify" && playback.connected) {
      void playback.setShuffle(next).catch(() => amp.setShuffle(!next));
    }
  };

  const toggleRepeat = () => {
    const next = !amp.repeat;
    amp.setRepeat(next);
    if (amp.currentTrack.source === "spotify" && playback.connected) {
      void playback.setRepeat(next).catch(() => amp.setRepeat(!next));
    }
  };

  const disconnectSpotify = () => {
    spotify.disconnect();
    setActiveSpotifyPlaylist(null);
    setActiveSpotifyPlaylistReorderSafe(true);
    if (amp.currentTrack.source === "spotify") {
      amp.setIsPlaying(false);
    }
  };

  const setPlaylistVisible = (visible: boolean) => {
    amp.setPlaylistVisible(visible);
    if (native) void setNativeWindowVisible("playlist", visible);
  };

  const setEqualizerVisible = (visible: boolean) => {
    amp.setEqualizerVisible(visible);
    if (native) void setNativeWindowVisible("equalizer", visible);
  };

  const sharedSnapshot = useMemo<MainWindowSnapshot>(
    () => ({
      tracks: amp.tracks,
      currentIndex: amp.currentIndex,
      isPlaying: amp.isPlaying,
      volume: amp.volume,
      balance: amp.balance,
      progress: amp.progress,
      shuffle: amp.shuffle,
      repeat: amp.repeat,
      doubleSize: amp.doubleSize,
      playlistVisible: amp.playlistVisible,
      equalizerVisible: amp.equalizerVisible,
      spotifyAuthenticated: spotify.authenticated,
      spotifyDisplayName: spotify.profile?.displayName ?? null,
      spotifyPlaylists: spotify.playlists,
      spotifyLoading: spotify.loading,
      spotifyError: spotify.error ?? playback.error,
      activeSpotifyPlaylist,
      spotifyPlaylistEditable,
      spotifyPlaylistReorderSafe: activeSpotifyPlaylistReorderSafe,
    }),
    [
      amp.tracks,
      amp.currentIndex,
      amp.isPlaying,
      amp.volume,
      amp.balance,
      amp.progress,
      amp.shuffle,
      amp.repeat,
      amp.doubleSize,
      amp.playlistVisible,
      amp.equalizerVisible,
      spotify.authenticated,
      spotify.profile?.displayName,
      spotify.playlists,
      spotify.loading,
      spotify.error,
      playback.error,
      activeSpotifyPlaylist,
      spotifyPlaylistEditable,
      activeSpotifyPlaylistReorderSafe,
    ],
  );

  usePublishMainWindowSnapshot(sharedSnapshot);

  useEffect(() => {
    if (!native) return;

    return subscribeMainRequests(async ({ command, payload }) => {
      switch (command) {
        case "togglePlay":
          return togglePlay();
        case "stop":
          return stopPlayback();
        case "previous":
          return previousTrack();
        case "next":
          return nextTrack();
        case "setVolume":
          changeVolume(payload as number);
          return;
        case "setBalance":
          amp.setBalance(payload as number);
          return;
        case "setProgress":
          seek(payload as number);
          return;
        case "toggleShuffle":
          toggleShuffle();
          return;
        case "toggleRepeat":
          toggleRepeat();
          return;
        case "setDoubleSize":
          amp.setDoubleSize(payload as boolean);
          return;
        case "setPlaylistVisible":
          setPlaylistVisible(payload as boolean);
          return;
        case "setEqualizerVisible":
          setEqualizerVisible(payload as boolean);
          return;
        case "selectTrack":
          return playTrackAt(payload as number);
        case "connectSpotify":
          return spotify.connect();
        case "disconnectSpotify":
          disconnectSpotify();
          return;
        case "refreshSpotify":
          return spotify.refreshLibrary();
        case "loadSpotifyPlaylist":
          return loadSpotifyPlaylist(payload as SpotifyPlaylist);
        case "loadLikedSongs":
          return loadLikedSongs();
        case "createSpotifyPlaylist": {
          const request = payload as { name: string; isPublic: boolean };
          return createSpotifyPlaylist(request.name, request.isPublic);
        }
        case "searchSpotifyTracks":
          return spotify.searchTracks(payload as string);
        case "addSpotifyTrack":
          return addSpotifyTrack(payload as SpotifyTrack);
        case "removeSpotifyTrack":
          return removeSpotifyTrack(payload as Track);
        case "moveSpotifyTrack":
          return moveSpotifyTrack(payload as -1 | 1);
        case "clearQueue":
          amp.replaceQueue([]);
          setActiveSpotifyPlaylist(null);
          setActiveSpotifyPlaylistReorderSafe(true);
          return;
      }
    });
  });

  const mainPlayer = (
    <MainPlayer
      position={native ? ZERO_POSITION : amp.positions.main}
      track={amp.currentTrack}
      isPlaying={amp.isPlaying}
      volume={amp.volume}
      balance={amp.balance}
      progress={amp.progress}
      shuffle={amp.shuffle}
      repeat={amp.repeat}
      playlistVisible={amp.playlistVisible}
      equalizerVisible={amp.equalizerVisible}
      skinSprites={skin.sprites}
      onMove={(position) => amp.setWindowPosition("main", position)}
      onTogglePlay={() => void togglePlay()}
      onStop={() => void stopPlayback()}
      onPrevious={() => void previousTrack()}
      onNext={() => void nextTrack()}
      onVolume={changeVolume}
      onBalance={amp.setBalance}
      onProgress={seek}
      onShuffle={toggleShuffle}
      onRepeat={toggleRepeat}
      onTogglePlaylist={() => setPlaylistVisible(!amp.playlistVisible)}
      onToggleEqualizer={() => setEqualizerVisible(!amp.equalizerVisible)}
    />
  );

  if (native) {
    return (
      <main className="native-window-root" data-double-size={amp.doubleSize ? "true" : "false"}>
        {mainPlayer}
      </main>
    );
  }

  return (
    <main className="desktop" data-double-size={amp.doubleSize ? "true" : "false"}>
      <div className="desktop-brand">AMP99 <span>PLAY IT LIKE IT'S 1999</span></div>
      <button className="size-toggle" onClick={() => amp.setDoubleSize((value) => !value)}>{amp.doubleSize ? "1×" : "2×"}</button>
      {mainPlayer}
      {amp.equalizerVisible && (
        <Equalizer
          position={amp.positions.equalizer}
          onMove={(position) => amp.setWindowPosition("equalizer", position)}
        />
      )}
      {amp.playlistVisible && (
        <PlaylistEditor
          position={amp.positions.playlist}
          tracks={amp.tracks}
          currentIndex={amp.currentIndex}
          activeSkin={skin.activeSkin}
          skinLoading={skin.loading}
          spotifyAuthenticated={spotify.authenticated}
          spotifyDisplayName={spotify.profile?.displayName ?? null}
          spotifyPlaylists={spotify.playlists}
          spotifyLoading={spotify.loading}
          spotifyError={spotify.error ?? playback.error}
          activeSpotifyPlaylist={activeSpotifyPlaylist}
          spotifyPlaylistEditable={spotifyPlaylistEditable}
          spotifyPlaylistReorderSafe={activeSpotifyPlaylistReorderSafe}
          onMove={(position) => amp.setWindowPosition("playlist", position)}
          onSelectTrack={(index) => void playTrackAt(index)}
          onLoadSkin={skin.loadSkin}
          onResetSkin={skin.resetSkin}
          onConnectSpotify={spotify.connect}
          onDisconnectSpotify={disconnectSpotify}
          onRefreshSpotify={spotify.refreshLibrary}
          onLoadSpotifyPlaylist={loadSpotifyPlaylist}
          onLoadLikedSongs={loadLikedSongs}
          onCreateSpotifyPlaylist={createSpotifyPlaylist}
          onSearchSpotifyTracks={spotify.searchTracks}
          onAddSpotifyTrack={addSpotifyTrack}
          onRemoveSpotifyTrack={removeSpotifyTrack}
          onMoveSpotifyTrack={moveSpotifyTrack}
          onClearQueue={() => {
            amp.replaceQueue([]);
            setActiveSpotifyPlaylist(null);
            setActiveSpotifyPlaylistReorderSafe(true);
          }}
        />
      )}
    </main>
  );
}

function NativeEqualizerWindow() {
  const snapshot = useMainWindowSnapshot() ?? EMPTY_SNAPSHOT;
  const skin = useSkinManager();
  useNativeWindowHost("equalizer", snapshot.doubleSize);

  return (
    <main className="native-window-root" data-double-size={snapshot.doubleSize ? "true" : "false"}>
      <Equalizer
        position={ZERO_POSITION}
        onMove={() => undefined}
        skinSprites={skin.sprites}
      />
    </main>
  );
}

function NativePlaylistWindow() {
  const snapshot = useMainWindowSnapshot() ?? EMPTY_SNAPSHOT;
  const skin = useSkinManager();
  useNativeWindowHost("playlist", snapshot.doubleSize);

  return (
    <main className="native-window-root" data-double-size={snapshot.doubleSize ? "true" : "false"}>
      <PlaylistEditor
        position={ZERO_POSITION}
        tracks={snapshot.tracks}
        currentIndex={snapshot.currentIndex}
        activeSkin={skin.activeSkin}
        skinLoading={skin.loading}
        spotifyAuthenticated={snapshot.spotifyAuthenticated}
        spotifyDisplayName={snapshot.spotifyDisplayName}
        spotifyPlaylists={snapshot.spotifyPlaylists}
        spotifyLoading={snapshot.spotifyLoading}
        spotifyError={snapshot.spotifyError}
        activeSpotifyPlaylist={snapshot.activeSpotifyPlaylist}
        spotifyPlaylistEditable={snapshot.spotifyPlaylistEditable}
        spotifyPlaylistReorderSafe={snapshot.spotifyPlaylistReorderSafe}
        onMove={() => undefined}
        onSelectTrack={(index) => {
          void requestMain("playlist", "selectTrack", index);
        }}
        onLoadSkin={skin.loadSkin}
        onResetSkin={skin.resetSkin}
        onConnectSpotify={() => requestMain("playlist", "connectSpotify", undefined)}
        onDisconnectSpotify={() => {
          void requestMain("playlist", "disconnectSpotify", undefined);
        }}
        onRefreshSpotify={() => requestMain("playlist", "refreshSpotify", undefined)}
        onLoadSpotifyPlaylist={(playlist) =>
          requestMain("playlist", "loadSpotifyPlaylist", playlist)
        }
        onLoadLikedSongs={() => requestMain("playlist", "loadLikedSongs", undefined)}
        onCreateSpotifyPlaylist={(name, isPublic) =>
          requestMain("playlist", "createSpotifyPlaylist", { name, isPublic })
        }
        onSearchSpotifyTracks={(query) =>
          requestMain("playlist", "searchSpotifyTracks", query)
        }
        onAddSpotifyTrack={(track) =>
          requestMain("playlist", "addSpotifyTrack", track)
        }
        onRemoveSpotifyTrack={(track) =>
          requestMain("playlist", "removeSpotifyTrack", track)
        }
        onMoveSpotifyTrack={(direction) =>
          requestMain("playlist", "moveSpotifyTrack", direction)
        }
        onClearQueue={() => {
          void requestMain("playlist", "clearQueue", undefined);
        }}
      />
    </main>
  );
}

export default function App() {
  const role = currentNativeWindowRole();

  if (role === "main") return <MainController native />;
  if (role === "equalizer") return <NativeEqualizerWindow />;
  if (role === "playlist") return <NativePlaylistWindow />;

  return <MainController native={false} />;
}
