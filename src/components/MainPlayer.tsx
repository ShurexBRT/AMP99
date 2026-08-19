import type { Track, WindowPosition } from "../types/player";
import { WindowFrame } from "./WindowFrame";

type Props = {
  position: WindowPosition;
  track: Track;
  isPlaying: boolean;
  volume: number;
  progress: number;
  shuffle: boolean;
  repeat: boolean;
  playlistVisible: boolean;
  equalizerVisible: boolean;
  onMove: (position: WindowPosition) => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolume: (value: number) => void;
  onProgress: (value: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onTogglePlaylist: () => void;
  onToggleEqualizer: () => void;
};

function secondsToTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function MainPlayer(props: Props) {
  const elapsed = Math.round((props.track.duration * props.progress) / 100);
  return (
    <WindowFrame title="AMP99" position={props.position} width={275} height={116} onMove={props.onMove} className="main-player">
      <div className="main-body">
        <div className="display-panel">
          <div className="time-display">{secondsToTime(elapsed)}</div>
          <div className="status-dot">{props.isPlaying ? "▶" : "■"}</div>
          <div className="track-marquee"><span>{props.track.artist.toUpperCase()} - {props.track.title.toUpperCase()}</span></div>
          <div className="fake-spectrum" aria-hidden="true">
            {[7, 14, 10, 18, 5, 13, 20, 9, 15, 6, 17, 11, 20, 8, 13, 5, 16, 10].map((height, index) => <i key={index} style={{ height }} />)}
          </div>
          <span className="stream-meta">SPOTIFY DEV</span>
        </div>

        <input className="seek classic-range" type="range" min="0" max="100" value={props.progress} onChange={(e) => props.onProgress(Number(e.target.value))} aria-label="Seek" />

        <div className="transport-row">
          <button title="Previous" onClick={props.onPrevious}>◀◀</button>
          <button title="Play" onClick={() => !props.isPlaying && props.onTogglePlay()}>▶</button>
          <button title="Pause" onClick={() => props.isPlaying && props.onTogglePlay()}>Ⅱ</button>
          <button title="Stop" onClick={() => props.isPlaying && props.onTogglePlay()}>■</button>
          <button title="Next" onClick={props.onNext}>▶▶</button>
          <button className="eject-button" title="Open source menu">▲</button>
        </div>

        <div className="volume-line">
          <span>VOL</span>
          <input className="classic-range compact" type="range" min="0" max="100" value={props.volume} onChange={(e) => props.onVolume(Number(e.target.value))} aria-label="Volume" />
        </div>

        <div className="toggle-row">
          <button className={props.shuffle ? "active" : ""} onClick={props.onShuffle}>SHUFFLE</button>
          <button className={props.repeat ? "active" : ""} onClick={props.onRepeat}>REPEAT</button>
          <button className={props.equalizerVisible ? "active" : ""} onClick={props.onToggleEqualizer}>EQ</button>
          <button className={props.playlistVisible ? "active" : ""} onClick={props.onTogglePlaylist}>PL</button>
        </div>
      </div>
    </WindowFrame>
  );
}
