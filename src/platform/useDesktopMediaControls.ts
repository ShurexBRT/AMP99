import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import type { Track } from "../types/player";

const MEDIA_KEY_EVENT = "amp99://media-key";

type Callbacks = {
  onTogglePlay: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

type Options = Callbacks & {
  track: Track;
  isPlaying: boolean;
};

export function useDesktopMediaControls({
  track,
  isPlaying,
  onTogglePlay,
  onStop,
  onPrevious,
  onNext,
}: Options) {
  const callbacks = useRef<Callbacks>({
    onTogglePlay,
    onStop,
    onPrevious,
    onNext,
  });
  const playbackState = useRef(isPlaying);

  callbacks.current = { onTogglePlay, onStop, onPrevious, onNext };
  playbackState.current = isPlaying;

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<string>(MEDIA_KEY_EVENT, (event) => {
      if (disposed) return;
      switch (event.payload) {
        case "play-pause":
          callbacks.current.onTogglePlay();
          break;
        case "stop":
          callbacks.current.onStop();
          break;
        case "previous":
          callbacks.current.onPrevious();
          break;
        case "next":
          callbacks.current.onNext();
          break;
        default:
          break;
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    try {
      if (typeof MediaMetadata !== "undefined") {
        mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: "AMP99 — Play it like it's 1999",
          artwork: track.albumArtUrl
            ? [
                {
                  src: track.albumArtUrl,
                  sizes: "512x512",
                },
              ]
            : [],
        });
      }
      mediaSession.playbackState = isPlaying ? "playing" : "paused";

      mediaSession.setActionHandler("play", () => {
        if (!playbackState.current) callbacks.current.onTogglePlay();
      });
      mediaSession.setActionHandler("pause", () => {
        if (playbackState.current) callbacks.current.onTogglePlay();
      });
      mediaSession.setActionHandler("stop", () => callbacks.current.onStop());
      mediaSession.setActionHandler("previoustrack", () => callbacks.current.onPrevious());
      mediaSession.setActionHandler("nexttrack", () => callbacks.current.onNext());
    } catch {
      // Media Session support varies between WebView2 and browser versions.
      // Hardware keys still work through the native Tauri bridge.
    }

    return () => {
      try {
        mediaSession.setActionHandler("play", null);
        mediaSession.setActionHandler("pause", null);
        mediaSession.setActionHandler("stop", null);
        mediaSession.setActionHandler("previoustrack", null);
        mediaSession.setActionHandler("nexttrack", null);
      } catch {
        // Older runtimes may reject unsupported handlers during cleanup.
      }
    };
  }, [track.id, track.title, track.artist, track.albumArtUrl, isPlaying]);
}
