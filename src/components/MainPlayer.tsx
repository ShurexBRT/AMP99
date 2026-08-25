import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDesktopMediaControls } from "../platform/useDesktopMediaControls";
import type { Track, WindowPosition } from "../types/player";
import { WindowFrame } from "./WindowFrame";

type Props = {
  position: WindowPosition;
  track: Track;
  isPlaying: boolean;
  volume: number;
  balance: number;
  progress: number;
  shuffle: boolean;
  repeat: boolean;
  playlistVisible: boolean;
  equalizerVisible: boolean;
  skinSprites: ReadonlyMap<string, string> | null;
  onMove: (position: WindowPosition) => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolume: (value: number) => void;
  onBalance: (value: number) => void;
  onProgress: (value: number) => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onTogglePlaylist: () => void;
  onToggleEqualizer: () => void;
};

type LegacyButtonProps = {
  label: string;
  className: string;
  normal?: string;
  pressed?: string;
  selected?: boolean;
  selectedSprite?: string;
  selectedPressedSprite?: string;
  fallback: string;
  onClick?: () => void;
};

type SkinSliderStyle = CSSProperties & {
  "--skin-thumb-image"?: string;
};

function secondsToTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function timeDigits(value: number): number[] {
  const safeValue = Math.max(0, Math.floor(value));
  const minutes = Math.min(99, Math.floor(safeValue / 60));
  const seconds = safeValue % 60;
  return [
    Math.floor(minutes / 10),
    minutes % 10,
    Math.floor(seconds / 10),
    seconds % 10,
  ];
}

function useRealtimeProgress(
  track: Track,
  isPlaying: boolean,
  progress: number,
): number {
  const [displayProgress, setDisplayProgress] = useState(progress);
  const baselineRef = useRef({
    trackId: track.id,
    progress,
    at: performance.now(),
  });

  useEffect(() => {
    baselineRef.current = {
      trackId: track.id,
      progress,
      at: performance.now(),
    };
    setDisplayProgress(progress);
  }, [track.id, progress]);

  useEffect(() => {
    if (!isPlaying || track.duration <= 0) return;

    const timer = window.setInterval(() => {
      const baseline = baselineRef.current;
      if (baseline.trackId !== track.id) return;
      const elapsedSeconds = (performance.now() - baseline.at) / 1000;
      setDisplayProgress(
        Math.min(100, baseline.progress + (elapsedSeconds / track.duration) * 100),
      );
    }, 100);

    return () => window.clearInterval(timer);
  }, [isPlaying, track.id, track.duration]);

  return displayProgress;
}

function spectrumHeights(
  track: Track,
  elapsedSeconds: number,
  isPlaying: boolean,
  count: number,
  maxHeight: number,
): number[] {
  if (!isPlaying) return Array.from({ length: count }, () => 2);

  const key = `${track.source ?? "local"}:${track.id}:${track.uri ?? track.title}`;
  let seed = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    seed ^= key.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return Array.from({ length: count }, (_, index) => {
    const phase = ((seed >>> (index % 16)) & 31) / 31;
    const speed = 2.2 + (((seed >>> ((index + 5) % 20)) & 15) / 15) * 3.4;
    const primary = Math.sin(elapsedSeconds * speed + index * 0.73 + phase * Math.PI);
    const secondary = Math.sin(elapsedSeconds * (speed * 0.47) + index * 1.31);
    const energy = Math.max(0, Math.min(1, 0.54 + primary * 0.28 + secondary * 0.18));
    return Math.max(2, Math.round(2 + energy * (maxHeight - 2)));
  });
}

function LegacySpriteButton({
  label,
  className,
  normal,
  pressed,
  selected = false,
  selectedSprite,
  selectedPressedSprite,
  fallback,
  onClick,
}: LegacyButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const idleSprite = selected && selectedSprite ? selectedSprite : normal;
  const pressedSprite = selected && selectedPressedSprite ? selectedPressedSprite : pressed;
  const activeSprite = isPressed && pressedSprite ? pressedSprite : idleSprite;

  return (
    <button
      className={`legacy-sprite-button ${className} ${activeSprite ? "" : "missing-sprite"}`}
      style={{ backgroundImage: activeSprite ? `url(${activeSprite})` : undefined }}
      aria-label={label}
      title={label}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      onClick={onClick}
    >
      <span aria-hidden="true">{activeSprite ? "" : fallback}</span>
    </button>
  );
}

function LegacyTime({ elapsed, sprites }: { elapsed: number; sprites: ReadonlyMap<string, string> }) {
  const digits = timeDigits(elapsed);
  const urls = digits.map((digit) => sprites.get(`main.digit${digit}`));

  if (urls.some((url) => !url)) {
    return <div className="legacy-time-fallback">{secondsToTime(elapsed)}</div>;
  }

  const left = [48, 60, 78, 90];
  return (
    <div className="legacy-time-digits" aria-label={`Elapsed ${secondsToTime(elapsed)}`}>
      {urls.map((url, index) => (
        <img
          key={`${digits[index]}-${index}`}
          src={url}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ left: left[index] }}
        />
      ))}
    </div>
  );
}

function LegacyMainPlayer(props: Props & { sprites: ReadonlyMap<string, string> }) {
  const { sprites } = props;
  const elapsedExact = (props.track.duration * props.progress) / 100;
  const elapsed = Math.round(elapsedExact);
  const spectrum = spectrumHeights(props.track, elapsedExact, props.isPlaying, 16, 16);
  const sprite = (name: string) => sprites.get(name);
  const playbackIndicator = sprite(props.isPlaying ? "main.playing" : "main.stopped");
  const volumeFrame = Math.max(1, Math.round((props.volume / 100) * 28));
  const volumeOffset = (volumeFrame - 1) * 15;
  const balanceFrame = Math.floor((Math.abs(props.balance) / 100) * 27);
  const balanceOffset = balanceFrame * 15;

  const positionStyle = {
    backgroundImage: sprite("main.positionBackground") ? `url(${sprite("main.positionBackground")})` : undefined,
    "--skin-thumb-image": sprite("main.positionThumb") ? `url(${sprite("main.positionThumb")})` : undefined,
  } as SkinSliderStyle;

  const volumeStyle = {
    backgroundImage: sprite("main.volumeBackgroundStrip") ? `url(${sprite("main.volumeBackgroundStrip")})` : undefined,
    backgroundPosition: `0 -${volumeOffset}px`,
    "--skin-thumb-image": sprite("main.volumeThumb") ? `url(${sprite("main.volumeThumb")})` : undefined,
  } as SkinSliderStyle;

  const balanceStyle = {
    backgroundImage: sprite("main.balanceBackgroundStrip") ? `url(${sprite("main.balanceBackgroundStrip")})` : undefined,
    backgroundPosition: `0 -${balanceOffset}px`,
    "--skin-thumb-image": sprite("main.balanceThumb") ? `url(${sprite("main.balanceThumb")})` : undefined,
  } as SkinSliderStyle;

  return (
    <WindowFrame
      title="AMP99"
      position={props.position}
      width={275}
      height={116}
      onMove={props.onMove}
      className="main-player legacy-main-player"
      skinBackground={sprite("main.windowBackground")}
      skinTitlebar={sprite("main.titlebarActive")}
    >
      <div className="legacy-main-body">
        <LegacyTime elapsed={elapsed} sprites={sprites} />

        {playbackIndicator && (
          <img className="legacy-playback-indicator" src={playbackIndicator} alt="" aria-hidden="true" draggable={false} />
        )}

        <div className="legacy-marquee" title={`${props.track.artist} - ${props.track.title}`}>
          {props.track.artist.toUpperCase()} - {props.track.title.toUpperCase()}
        </div>

        <div className="legacy-spectrum" aria-hidden="true">
          {spectrum.map((height, index) => (
            <i key={index} style={{ height, transition: "height 80ms linear" }} />
          ))}
        </div>

        <div className="legacy-mono-stereo" aria-hidden="true">
          {sprite("main.mono") && <img className="legacy-mono" src={sprite("main.mono")} alt="" draggable={false} />}
          {sprite("main.stereoSelected") && <img className="legacy-stereo" src={sprite("main.stereoSelected")} alt="" draggable={false} />}
        </div>

        <div className="legacy-volume-surface" style={volumeStyle}>
          <input className="legacy-skin-range legacy-volume-range" type="range" min="0" max="100" value={props.volume} aria-label="Volume" onInput={(event) => props.onVolume(Number(event.currentTarget.value))} onChange={() => undefined} />
        </div>

        <div className="legacy-balance-surface" style={balanceStyle}>
          <input className="legacy-skin-range legacy-balance-range" type="range" min="-100" max="100" value={props.balance} aria-label="Balance" onInput={(event) => props.onBalance(Number(event.currentTarget.value))} onChange={() => undefined} />
        </div>

        <input className="legacy-skin-range legacy-position-range" style={positionStyle} type="range" min="0" max="100" value={props.progress} aria-label="Seek" onInput={(event) => props.onProgress(Number(event.currentTarget.value))} onChange={() => undefined} />

        <LegacySpriteButton label="Previous" className="legacy-previous" normal={sprite("main.previous")} pressed={sprite("main.previousPressed")} fallback="◀◀" onClick={props.onPrevious} />
        <LegacySpriteButton label="Play" className="legacy-play" normal={sprite("main.play")} pressed={sprite("main.playPressed")} fallback="▶" onClick={() => !props.isPlaying && props.onTogglePlay()} />
        <LegacySpriteButton label="Pause" className="legacy-pause" normal={sprite("main.pause")} pressed={sprite("main.pausePressed")} fallback="Ⅱ" onClick={() => props.isPlaying && props.onTogglePlay()} />
        <LegacySpriteButton label="Stop" className="legacy-stop" normal={sprite("main.stop")} pressed={sprite("main.stopPressed")} fallback="■" onClick={props.onStop} />
        <LegacySpriteButton label="Next" className="legacy-next" normal={sprite("main.next")} pressed={sprite("main.nextPressed")} fallback="▶▶" onClick={props.onNext} />
        <LegacySpriteButton label="Open source menu" className="legacy-eject" normal={sprite("main.eject")} pressed={sprite("main.ejectPressed")} fallback="▲" />

        <LegacySpriteButton label="Shuffle" className="legacy-shuffle" normal={sprite("main.shuffle")} pressed={sprite("main.shufflePressed")} selected={props.shuffle} selectedSprite={sprite("main.shuffleSelected")} selectedPressedSprite={sprite("main.shuffleSelectedPressed")} fallback="SHUF" onClick={props.onShuffle} />
        <LegacySpriteButton label="Repeat" className="legacy-repeat" normal={sprite("main.repeat")} pressed={sprite("main.repeatPressed")} selected={props.repeat} selectedSprite={sprite("main.repeatSelected")} selectedPressedSprite={sprite("main.repeatSelectedPressed")} fallback="REP" onClick={props.onRepeat} />
        <LegacySpriteButton label="Equalizer" className="legacy-eq" normal={sprite("main.eq")} pressed={sprite("main.eqPressed")} selected={props.equalizerVisible} selectedSprite={sprite("main.eqSelected")} selectedPressedSprite={sprite("main.eqSelectedPressed")} fallback="EQ" onClick={props.onToggleEqualizer} />
        <LegacySpriteButton label="Playlist" className="legacy-playlist" normal={sprite("main.playlist")} pressed={sprite("main.playlistPressed")} selected={props.playlistVisible} selectedSprite={sprite("main.playlistSelected")} selectedPressedSprite={sprite("main.playlistSelectedPressed")} fallback="PL" onClick={props.onTogglePlaylist} />
      </div>
    </WindowFrame>
  );
}

function DefaultMainPlayer(props: Props) {
  const elapsedExact = (props.track.duration * props.progress) / 100;
  const elapsed = Math.round(elapsedExact);
  const spectrum = spectrumHeights(props.track, elapsedExact, props.isPlaying, 18, 20);
  const streamLabel = props.track.source === "spotify" ? "SPOTIFY" : "LOCAL";
  return (
    <WindowFrame title="AMP99" position={props.position} width={275} height={116} onMove={props.onMove} className="main-player">
      <div className="main-body">
        <div className="display-panel">
          <div className="time-display">{secondsToTime(elapsed)}</div>
          <div className="status-dot">{props.isPlaying ? "▶" : "■"}</div>
          <div className="track-marquee"><span>{props.track.artist.toUpperCase()} - {props.track.title.toUpperCase()}</span></div>
          <div className="fake-spectrum" aria-hidden="true">
            {spectrum.map((height, index) => <i key={index} style={{ height, transition: "height 80ms linear" }} />)}
          </div>
          <span className="stream-meta">{streamLabel}</span>
        </div>

        <input className="seek classic-range" type="range" min="0" max="100" value={props.progress} onInput={(e) => props.onProgress(Number(e.currentTarget.value))} onChange={() => undefined} aria-label="Seek" />

        <div className="transport-row">
          <button title="Previous" onClick={props.onPrevious}>◀◀</button>
          <button title="Play" onClick={() => !props.isPlaying && props.onTogglePlay()}>▶</button>
          <button title="Pause" onClick={() => props.isPlaying && props.onTogglePlay()}>Ⅱ</button>
          <button title="Stop" onClick={props.onStop}>■</button>
          <button title="Next" onClick={props.onNext}>▶▶</button>
          <button className="eject-button" title="Open source menu">▲</button>
        </div>

        <div className="volume-line">
          <span>VOL</span>
          <input className="classic-range compact" type="range" min="0" max="100" value={props.volume} onInput={(e) => props.onVolume(Number(e.currentTarget.value))} onChange={() => undefined} aria-label="Volume" />
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

export function MainPlayer(props: Props) {
  const realtimeProgress = useRealtimeProgress(
    props.track,
    props.isPlaying,
    props.progress,
  );
  const liveProps = { ...props, progress: realtimeProgress };

  useDesktopMediaControls({
    track: props.track,
    isPlaying: props.isPlaying,
    onTogglePlay: props.onTogglePlay,
    onStop: props.onStop,
    onPrevious: props.onPrevious,
    onNext: props.onNext,
  });

  const hasLegacySkin = Boolean(props.skinSprites?.get("main.windowBackground"));

  if (hasLegacySkin && props.skinSprites) {
    return <LegacyMainPlayer {...liveProps} sprites={props.skinSprites} />;
  }

  return <DefaultMainPlayer {...liveProps} />;
}
