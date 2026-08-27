/** Choose the queue item that should follow the currently playing item. */
export function selectNextTrackIndex(
  currentIndex: number,
  trackCount: number,
  shuffle: boolean,
  random = Math.random,
): number {
  if (trackCount <= 0) return 0;

  const normalizedCurrentIndex = Math.max(
    0,
    Math.min(currentIndex, trackCount - 1),
  );

  if (!shuffle || trackCount === 1) {
    return (normalizedCurrentIndex + 1) % trackCount;
  }

  // Pick from every item except the current one. Keeping the current item out
  // of the candidate set prevents a shuffle auto-advance from restarting the
  // song that just ended.
  const candidateCount = trackCount - 1;
  const candidate = Math.max(
    0,
    Math.min(candidateCount - 1, Math.floor(random() * candidateCount)),
  );

  return candidate >= normalizedCurrentIndex ? candidate + 1 : candidate;
}
