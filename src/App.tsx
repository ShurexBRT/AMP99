import { Equalizer } from "./components/Equalizer";
import { MainPlayer } from "./components/MainPlayer";
import { PlaylistEditor } from "./components/PlaylistEditor";
import { useAmp99State } from "./state/useAmp99State";

export default function App() {
  const amp = useAmp99State();

  return (
    <main className="desktop" data-double-size={amp.doubleSize ? "true" : "false"}>
      <div className="desktop-brand">AMP99 <span>PLAY IT LIKE IT'S '99</span></div>
      <button className="size-toggle" onClick={() => amp.setDoubleSize((value) => !value)}>{amp.doubleSize ? "1×" : "2×"}</button>

      <MainPlayer
        position={amp.positions.main}
        track={amp.currentTrack}
        isPlaying={amp.isPlaying}
        volume={amp.volume}
        progress={amp.progress}
        shuffle={amp.shuffle}
        repeat={amp.repeat}
        playlistVisible={amp.playlistVisible}
        equalizerVisible={amp.equalizerVisible}
        onMove={(position) => amp.setWindowPosition("main", position)}
        onTogglePlay={() => amp.setIsPlaying((value) => !value)}
        onPrevious={amp.previous}
        onNext={amp.next}
        onVolume={amp.setVolume}
        onProgress={amp.setProgress}
        onShuffle={() => amp.setShuffle((value) => !value)}
        onRepeat={() => amp.setRepeat((value) => !value)}
        onTogglePlaylist={() => amp.setPlaylistVisible((value) => !value)}
        onToggleEqualizer={() => amp.setEqualizerVisible((value) => !value)}
      />

      {amp.equalizerVisible && <Equalizer position={amp.positions.equalizer} onMove={(position) => amp.setWindowPosition("equalizer", position)} />}
      {amp.playlistVisible && (
        <PlaylistEditor
          position={amp.positions.playlist}
          tracks={amp.tracks}
          currentIndex={amp.currentIndex}
          activeSkin={amp.activeSkin}
          onMove={(position) => amp.setWindowPosition("playlist", position)}
          onSelectTrack={(index) => { amp.setCurrentIndex(index); amp.setProgress(0); amp.setIsPlaying(true); }}
          onSkinLoaded={amp.setActiveSkin}
        />
      )}
    </main>
  );
}
