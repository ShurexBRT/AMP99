import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getPreferencesSnapshot,
  usePreferences,
} from "../preferences/preferencesStore";
import type { Track, WindowId, WindowPosition } from "../types/player";
import {
  moveTrack,
  moveTrackNext,
  removeTrackAt,
  type QueueMoveDirection,
} from "./queueOperations";

const STORAGE_KEY = "amp99.windowPositions.v1";
const LAST_QUEUE_STORAGE_KEY = "amp99.lastQueue.v1";
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

type PersistedQueue = {
  tracks: Track[];
  currentIndex: number;
};

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    typeof track.artist === "string" &&
    typeof track.title === "string" &&
    typeof track.duration === "number" &&
    Number.isFinite(track.duration) &&
    track.duration >= 0 &&
    (track.source === undefined || track.source === "demo" || track.source === "spotify") &&
    (track.uri === undefined || typeof track.uri === "string") &&
    (track.albumArtUrl === undefined ||
      track.albumArtUrl === null ||
      typeof track.albumArtUrl === "string")
  );
}

function loadPersistedQueue(): PersistedQueue | null {
  if (!getPreferencesSnapshot().resumeLastQueue) return null;

  try {
    const raw = localStorage.getItem(LAST_QUEUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedQueue>;
    if (!Array.isArray(parsed.tracks) || !parsed.tracks.every(isTrack)) return null;

    const currentIndex =
      typeof parsed.currentIndex === "number" && Number.isInteger(parsed.currentIndex)
        ? Math.max(0, Math.min(parsed.currentIndex, Math.max(0, parsed.tracks.length - 1)))
        : 0;

    return { tracks: parsed.tracks, currentIndex };
  } catch {
    return null;
  }
}

function loadPositions(): Record<WindowId, WindowPosition> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultPositions, ...JSON.parse(saved) } : defaultPositions;
  } catch {
    return defaultPositions;
  }
}

export function useAmp99State() {
  const preferences = usePreferences();
  const initialQueueRef = useRef<PersistedQueue | null>(loadPersistedQueue());
  const [positions, setPositions] = useState(loadPositions);
  const [playlistVisible, setPlaylistVisible] = useState(true);
  const [equalizerVisible, setEqualizerVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>(
    initialQueueRef.current?.tracks ?? demoTracks,
  );
  const [currentIndex, setCurrentIndex] = useState(
    initialQueueRef.current?.currentIndex ?? 0,
  );
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

  useEffect(() => {
    if (!preferences.resumeLastQueue) {
      try {
        localStorage.removeItem(LAST_QUEUE_STORAGE_KEY);
      } catch {
        // Queue resume is optional and must never break playback.
      }
      return;
    }

    try {
      const payload: PersistedQueue = { tracks, currentIndex };
      localStorage.setItem(LAST_QUEUE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Queue resume is optional and must never break playback.
    }
  }, [preferences.resumeLastQueue, tracks, currentIndex]);

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

  const removeTrack = useCallback((trackIndex: number) => {
    const next = removeTrackAt(tracks, trackIndex, currentIndex);
    setTracks(next.tracks);
    setCurrentIndex(next.currentIndex);
    setProgress(0);
    setIsPlaying(false);
  }, [currentIndex, tracks]);

  const moveQueueTrack = useCallback((trackIndex: number, direction: QueueMoveDirection) => {
    const next = moveTrack(tracks, trackIndex, direction, currentIndex);
    setTracks(next.tracks);
    setCurrentIndex(next.currentIndex);
  }, [currentIndex, tracks]);

  const playNextTrack = useCallback((trackIndex: number) => {
    const next = moveTrackNext(tracks, trackIndex, currentIndex);
    setTracks(next.tracks);
    setCurrentIndex(next.currentIndex);
  }, [currentIndex, tracks]);

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

  const api = useMemo(
    () => ({
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
      removeTrack,
      moveQueueTrack,
      playNextTrack,
      previous,
      next,
    }),
    [
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
      replaceQueue,
      removeTrack,
      moveQueueTrack,
      playNextTrack,
      previous,
      next,
    ],
  );

  return api;
}
