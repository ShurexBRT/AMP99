import { useCallback, useEffect, useMemo, useState } from "react";
import type { Track, WindowId, WindowPosition } from "../types/player";

const STORAGE_KEY = "amp99.windowPositions.v1";
export const WINDOW_CLOSE_EVENT = "amp99-window-close";

const defaultPositions: Record<WindowId, WindowPosition> = {
  main: { x: 28, y: 28 },
  equalizer: { x: 28, y: 154 },
  playlist: { x: 313, y: 28 },
};

const demoTracks: Track[] = [
  { id: "1", artist: "AMP99", title: "Play it like it's 1999", duration: 243 },
  { id: "2", artist: "The Debuggers", title: "Works On My Machine", duration: 218 },
  { id: "3", artist: "Null Pointer", title: "Segmentation Groove", duration: 196 },
  { id: "4", artist: "Packet Loss", title: "Retry Again", duration: 264 },
];

const emptyTrack: Track = {
  id: "amp99-empty",
  artist: "AMP99",
  title: "Queue is empty",
  duration: 0,
};

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
  const [tracks, setTracks] = useState<Track[]>(demoTracks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(74);
  const [balance, setBalance] = useState(0);
  const [progress, setProgress] = useState(31);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [doubleSize, setDoubleSize] = useState(false);

  const currentTrack = tracks[currentIndex] ?? tracks[0] ?? emptyTrack;

  useEffect(() => {
    const onClose = (event: Event) => {
      const id = (event as CustomEvent<WindowId>).detail;
      if (id === "equalizer") setEqualizerVisible(false);
      if (id === "playlist") setPlaylistVisible(false);
    };

    window.addEventListener(WINDOW_CLOSE_EVENT, onClose);
    return () => window.removeEventListener(WINDOW_CLOSE_EVENT, onClose);
  }, []);

  const setWindowPosition = useCallback((id: WindowId, position: WindowPosition) => {
    setPositions((previous) => {
      const next = { ...previous, [id]: position };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const replaceQueue = useCallback((nextTracks: Track[]) => {
    setTracks(nextTracks);
    setCurrentIndex(0);
    setProgress(0);
    setIsPlaying(false);
  }, []);

  const previous = useCallback(() => {
    setCurrentIndex((index) => {
      if (tracks.length === 0) return 0;
      return (index - 1 + tracks.length) % tracks.length;
    });
    setProgress(0);
  }, [tracks.length]);

  const next = useCallback(() => {
    setCurrentIndex((index) => {
      if (tracks.length === 0) return 0;
      return (index + 1) % tracks.length;
    });
    setProgress(0);
  }, [tracks.length]);

  const api = useMemo(() => ({
    positions,
    playlistVisible,
    equalizerVisible,
    isPlaying,
    currentIndex,
    currentTrack,
    tracks,
    volume,
    balance,
    progress,
    shuffle,
    repeat,
    doubleSize,
    setWindowPosition,
    setPlaylistVisible,
    setEqualizerVisible,
    setIsPlaying,
    setCurrentIndex,
    setVolume,
    setBalance,
    setProgress,
    setShuffle,
    setRepeat,
    setDoubleSize,
    replaceQueue,
    previous,
    next,
  }), [positions, playlistVisible, equalizerVisible, isPlaying, currentIndex, currentTrack, tracks, volume, balance, progress, shuffle, repeat, doubleSize, setWindowPosition, replaceQueue, previous, next]);

  return api;
}
