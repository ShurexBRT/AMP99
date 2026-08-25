import type { Track } from "../types/player";

export type QueueMoveDirection = -1 | 1;

export type QueueMutation = {
  tracks: Track[];
  currentIndex: number;
};

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, Math.max(0, length - 1)));
}

export function removeTrackAt(
  tracks: Track[],
  trackIndex: number,
  currentIndex: number,
): QueueMutation {
  if (trackIndex < 0 || trackIndex >= tracks.length) {
    return { tracks, currentIndex: clampIndex(currentIndex, tracks.length) };
  }

  const nextTracks = tracks.filter((_, index) => index !== trackIndex);
  let nextCurrentIndex = currentIndex;

  if (trackIndex < currentIndex) nextCurrentIndex -= 1;
  if (trackIndex === currentIndex) {
    nextCurrentIndex = Math.min(currentIndex, nextTracks.length - 1);
  }

  return {
    tracks: nextTracks,
    currentIndex: clampIndex(nextCurrentIndex, nextTracks.length),
  };
}

export function moveTrack(
  tracks: Track[],
  trackIndex: number,
  direction: QueueMoveDirection,
  currentIndex: number,
): QueueMutation {
  const targetIndex = trackIndex + direction;
  if (
    trackIndex < 0 ||
    trackIndex >= tracks.length ||
    targetIndex < 0 ||
    targetIndex >= tracks.length
  ) {
    return { tracks, currentIndex: clampIndex(currentIndex, tracks.length) };
  }

  const nextTracks = [...tracks];
  [nextTracks[trackIndex], nextTracks[targetIndex]] = [
    nextTracks[targetIndex],
    nextTracks[trackIndex],
  ];

  let nextCurrentIndex = currentIndex;
  if (currentIndex === trackIndex) nextCurrentIndex = targetIndex;
  else if (currentIndex === targetIndex) nextCurrentIndex = trackIndex;

  return { tracks: nextTracks, currentIndex: nextCurrentIndex };
}

/** Move a selected track directly after the currently selected/playing track. */
export function moveTrackNext(
  tracks: Track[],
  trackIndex: number,
  currentIndex: number,
): QueueMutation {
  if (
    trackIndex < 0 ||
    trackIndex >= tracks.length ||
    currentIndex < 0 ||
    currentIndex >= tracks.length ||
    trackIndex === currentIndex
  ) {
    return { tracks, currentIndex: clampIndex(currentIndex, tracks.length) };
  }

  const nextTracks = tracks.filter((_, index) => index !== trackIndex);
  const currentTrackIndex = trackIndex < currentIndex ? currentIndex - 1 : currentIndex;
  nextTracks.splice(currentTrackIndex + 1, 0, tracks[trackIndex]);

  return { tracks: nextTracks, currentIndex: currentTrackIndex };
}
