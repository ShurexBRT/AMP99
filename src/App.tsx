import { useEffect } from "react";
import { Equalizer } from "./components/Equalizer";
import { MainPlayer } from "./components/MainPlayer";
import { PlaylistEditor } from "./components/PlaylistEditor";
import { useSkinManager } from "./skins/useSkinManager";
import { spotifyTracksToPlayerQueue } from "./spotify/playerAdapter";
import type { SpotifyPlaylist } from "./spotify/types";
import { useSpotifyLibrary } from "./spotify/useSpotifyLibrary";
import { useSpotifyPlayback } from "./spotify/useSpotifyPlayback";
import { useAmp99State } from "./state/useAmp99State";

export default function App() {
  const amp = useAmp99State();
  const skin = useSkinManager();
  const spotify = useSpotifyLibrary();
  const playback = useSpotifyPlayback({
    enabled: spotify.authenticated,
    initialVolume: amp.volume,
  });

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
    return {
      trackCount: result.tracks.length,
      skippedNonTracks: result.skippedNonTracks,
    };
  };

  const loadLikedSongs = async () => {
    const tracks = await spotify.loadLikedSongs();
    amp.replaceQueue(spotifyTracksToPlayerQueue(tracks));
    return { trackCount: tracks.length };
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
          onMove={(position) => amp.setWindowPosition("playlist", position)}
          onSelectTrack={(index) => void playTrackAt(index)}
          onLoadSkin={skin.loadSkin}
          onResetSkin={skin.resetSkin}
          onConnectSpotify={spotify.connect}
          onDisconnectSpotify={spotify.disconnect}
          onRefreshSpotify={spotify.refreshLibrary}
          onLoadSpotifyPlaylist={loadSpotifyPlaylist}
          onLoadLikedSongs={loadLikedSongs}
          onCreateSpotifyPlaylist={(name, isPublic) => spotify.createPlaylist({ name, isPublic })}
          onClearQueue={() => amp.replaceQueue([])}
        />
      )}
    </main>
  );
}
