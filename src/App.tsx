import { useEffect, useState } from "react";
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

export default function App() {
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
      // The playback hook records a user-readable error for the Playlist Editor.
    }
  };

  const stopPlayback = async () => {
    const track = amp.currentTrack;

    if (track.source === "spotify" && track.uri) {
      try {
        await playback.stop();
      } catch {
        // The playback hook records the error.
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

  return (
    <main className="desktop" data-double-size={amp.doubleSize ? "true" : "false"}>
      <div className="desktop-brand">AMP99 <span>PLAY IT LIKE IT'S '99</span></div>
      <button className="size-toggle" onClick={() => amp.setDoubleSize((value) => !value)}>{amp.doubleSize ? "1×" : "2×"}</button>

      <MainPlayer
        position={amp.positions.main}
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
        onTogglePlaylist={() => amp.setPlaylistVisible((value) => !value)}
        onToggleEqualizer={() => amp.setEqualizerVisible((value) => !value)}
      />

      {amp.equalizerVisible && <Equalizer position={amp.positions.equalizer} onMove={(position) => amp.setWindowPosition("equalizer", position)} />}
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
