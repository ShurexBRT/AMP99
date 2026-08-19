import { useCallback, useMemo, useState } from "react";
import type { Track, WindowId, WindowPosition } from "../types/player";

const STORAGE_KEY = "amp99.windowPositions.v1";

const defaultPositions: Record<WindowId, WindowPosition> = {
  main: { x: 28, y: 28 },
  equalizer: { x: 28, y: 154 },
  playlist: { x: 313, y: 28 },
};

const demoTracks: Track[] = [
  { id: "1", artist: "AMP99", title: "Play it like it's '99", duration: 243 },
  { id: "2", artist: "The Debuggers", title: "Works On My Machine", duration: 218 },
  { id: "3", artist: "Null Pointer", title: "Segmentation Groove", duration: 196 },
  { id: "4", artist: "Packet Loss", title: "Retry Again", duration: 264 },
];

function loadPositions(): Record<WindowId, WindowPosition> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultPositions, ...JSON.parse(saved) } : defaultPositions;
  } catch {
    return defaultPositions;
  }
}

export function useAmp99State() {
  const [positions, setPositions] = useState(loadPositions);
  const [playlistVisible, setPlaylistVisible] = useState(true);
  const [equalizerVisible, setEqualizerVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(74);
  const [progress, setProgress] = useState(31);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [doubleSize, setDoubleSize] = useState(false);
  const [activeSkin, setActiveSkin] = useState("AMP99 Default");

  const currentTrack = demoTracks[currentIndex];

  const setWindowPosition = useCallback((id: WindowId, position: WindowPosition) => {
    setPositions((previous) => {
      const next = { ...previous, [id]: position };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const previous = useCallback(() => {
    setCurrentIndex((index) => (index - 1 + demoTracks.length) % demoTracks.length);
    setProgress(0);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((index) => (index + 1) % demoTracks.length);
    setProgress(0);
  }, []);

  const api = useMemo(() => ({
    positions,
    playlistVisible,
    equalizerVisible,
    isPlaying,
    currentIndex,
    currentTrack,
    tracks: demoTracks,
    volume,
    progress,
    shuffle,
    repeat,
    doubleSize,
    activeSkin,
    setWindowPosition,
    setPlaylistVisible,
    setEqualizerVisible,
    setIsPlaying,
    setCurrentIndex,
    setVolume,
    setProgress,
    setShuffle,
    setRepeat,
    setDoubleSize,
    setActiveSkin,
    previous,
    next,
  }), [positions, playlistVisible, equalizerVisible, isPlaying, currentIndex, currentTrack, volume, progress, shuffle, repeat, doubleSize, activeSkin, setWindowPosition, previous, next]);

  return api;
}
