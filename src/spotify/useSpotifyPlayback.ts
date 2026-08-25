import { useCallback, useEffect, useRef, useState } from "react";
import { getSpotifyAccessToken, getStoredSpotifySession } from "./auth";
import {
  transferSpotifyPlayback,
  setSpotifyRepeat,
  setSpotifyShuffle,
  startSpotifyTrack,
} from "./playerApi";
import { loadSpotifyWebPlaybackSdk } from "./webPlaybackSdk";
import type {
  SpotifyWebPlaybackPlayer,
  SpotifyWebPlaybackState,
} from "./webPlaybackTypes";

const REQUIRED_PLAYBACK_SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
] as const;

const DEVICE_READY_TIMEOUT_MS = 15_000;

type DeviceReadyWaiter = {
  promise: Promise<string>;
  resolve: (deviceId: string) => void;
  reject: (error: Error) => void;
};

function createDeviceReadyWaiter(): DeviceReadyWaiter {
  let resolve!: (deviceId: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  // The SDK can fail before the user clicks Play. Avoid an unhandled rejection
  // while retaining the rejected promise for a later playback operation.
  void promise.catch(() => undefined);

  return { promise, resolve, reject };
}

async function waitForDeviceReady(
  waiter: DeviceReadyWaiter,
  timeoutMs: number,
): Promise<string> {
  let timeoutId: number | null = null;
  try {
    return await Promise.race([
      waiter.promise,
      new Promise<string>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("AMP99 Spotify device is still initializing. Try Play again in a moment.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

export type SpotifyPlaybackSnapshot = {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  currentTrackUri: string | null;
};

type Options = {
  enabled: boolean;
  initialVolume: number;
};

async function hasPlaybackScopes(): Promise<boolean> {
  const session = await getStoredSpotifySession();
  if (!session) return false;

  const granted = new Set(session.scope.split(/\s+/).filter(Boolean));
  return REQUIRED_PLAYBACK_SCOPES.every((scope) => granted.has(scope));
}

function snapshotFromState(
  state: SpotifyWebPlaybackState | null,
): SpotifyPlaybackSnapshot | null {
  if (!state) return null;

  return {
    paused: state.paused,
    positionMs: Math.max(0, state.position),
    durationMs: Math.max(0, state.duration),
    currentTrackUri: state.track_window.current_track?.uri ?? null,
  };
}

function readablePlaybackError(error: unknown): string {
  return error instanceof Error ? error.message : "Spotify playback operation failed.";
}

export function useSpotifyPlayback({ enabled, initialVolume }: Options) {
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);
  const deviceReadyWaiterRef = useRef<DeviceReadyWaiter | null>(null);
  const initialVolumeRef = useRef(initialVolume);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [environmentSupported, setEnvironmentSupported] = useState<boolean | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SpotifyPlaybackSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) {
      deviceReadyWaiterRef.current?.reject(new Error("Spotify playback is disconnected."));
      deviceReadyWaiterRef.current = null;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId(null);
      setConnected(false);
      setSnapshot(null);
      setError(null);
      setPremiumRequired(false);
      setEnvironmentSupported(null);
      return;
    }

    let disposed = false;
    let player: SpotifyWebPlaybackPlayer | null = null;
    const deviceReadyWaiter = createDeviceReadyWaiter();
    deviceReadyWaiterRef.current = deviceReadyWaiter;

    const rejectDeviceReady = (message: string) => {
      deviceReadyWaiter.reject(new Error(message));
    };

    const initialize = async () => {
      try {
        if (!(await hasPlaybackScopes())) {
          setConnected(false);
          setError("Reconnect Spotify to grant AMP99 playback permissions.");
          return;
        }

        const Player = await loadSpotifyWebPlaybackSdk();
        if (disposed) return;

        player = new Player({
          name: "AMP99 — Play it like it's 1999",
          volume: Math.max(0, Math.min(1, initialVolumeRef.current / 100)),
          enableMediaSession: true,
          getOAuthToken: (callback) => {
            void getSpotifyAccessToken()
              .then(callback)
              .catch((tokenError) => {
                if (!disposed) {
                  setError(
                    tokenError instanceof Error
                      ? tokenError.message
                      : "Could not refresh Spotify access token.",
                  );
                }
              });
          },
        });
        playerRef.current = player;

        player.addListener("ready", ({ device_id }) => {
          if (disposed) return;
          setDeviceId(device_id);
          setConnected(true);
          setEnvironmentSupported(true);
          setPremiumRequired(false);
          setError(null);
          deviceReadyWaiter.resolve(device_id);
        });

        player.addListener("not_ready", ({ device_id }) => {
          if (disposed) return;
          setDeviceId((current) => (current === device_id ? null : current));
          setConnected(false);
          if (deviceReadyWaiterRef.current === deviceReadyWaiter) {
            deviceReadyWaiter.reject(new Error("AMP99 Spotify playback device went offline."));
            deviceReadyWaiterRef.current = createDeviceReadyWaiter();
          }
        });

        player.addListener("player_state_changed", (state) => {
          if (disposed) return;
          setSnapshot(snapshotFromState(state));
        });

        player.addListener("initialization_error", ({ message }) => {
          if (disposed) return;
          setEnvironmentSupported(false);
          setConnected(false);
          setError(
            `Spotify playback cannot initialize in this webview/browser: ${message}`,
          );
          rejectDeviceReady(`Spotify playback cannot initialize in this webview/browser: ${message}`);
        });

        player.addListener("authentication_error", ({ message }) => {
          if (disposed) return;
          setConnected(false);
          setError(`Spotify playback authentication failed: ${message}`);
          rejectDeviceReady(`Spotify playback authentication failed: ${message}`);
        });

        player.addListener("account_error", ({ message }) => {
          if (disposed) return;
          setPremiumRequired(true);
          setConnected(false);
          setError(`Spotify Premium is required for playback: ${message}`);
          rejectDeviceReady(`Spotify Premium is required for playback: ${message}`);
        });

        player.addListener("playback_error", ({ message }) => {
          if (disposed) return;
          setError(`Spotify playback failed: ${message}`);
        });

        player.addListener("autoplay_failed", () => {
          if (disposed) return;
          setError("Spotify autoplay was blocked. Press Play in AMP99 to activate audio.");
        });

        const success = await player.connect();
        if (!success && !disposed) {
          setConnected(false);
          setError("Spotify Web Playback SDK could not connect.");
          rejectDeviceReady("Spotify Web Playback SDK could not connect.");
        }
      } catch (initializationError) {
        if (disposed) return;
        setConnected(false);
        setError(
          initializationError instanceof Error
            ? initializationError.message
            : "Spotify Web Playback SDK initialization failed.",
        );
        rejectDeviceReady(
          initializationError instanceof Error
            ? initializationError.message
            : "Spotify Web Playback SDK initialization failed.",
        );
      }
    };

    void initialize();

    return () => {
      disposed = true;
      deviceReadyWaiter.reject(new Error("Spotify playback is no longer available."));
      if (deviceReadyWaiterRef.current === deviceReadyWaiter) {
        deviceReadyWaiterRef.current = null;
      }
      player?.disconnect();
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, [enabled]);

  const requirePlayer = useCallback(async () => {
    const player = playerRef.current;
    if (!player) {
      throw new Error(error || "Spotify playback is still initializing. Try again in a moment.");
    }

    const deviceReadyWaiter = deviceReadyWaiterRef.current;
    if (!deviceReadyWaiter && !deviceId) {
      throw new Error("Spotify playback is still initializing. Try again in a moment.");
    }

    const activeDeviceId = deviceId ?? await waitForDeviceReady(
      deviceReadyWaiter!,
      DEVICE_READY_TIMEOUT_MS,
    );
    const activePlayer = playerRef.current;
    if (!activePlayer) {
      throw new Error("Spotify playback is no longer available.");
    }

    return { player: activePlayer, deviceId: activeDeviceId };
  }, [deviceId, error]);

  const runOperation = useCallback(async <T,>(operation: () => Promise<T>) => {
    setError(null);
    try {
      return await operation();
    } catch (operationError) {
      const message = readablePlaybackError(operationError);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const playTrack = useCallback(
    async (uri: string) => runOperation(async () => {
      const { player, deviceId: activeDeviceId } = await requirePlayer();
      try {
        await player.activateElement();
      } catch {
        // Desktop environments often do not need explicit activation.
      }
      await transferSpotifyPlayback(activeDeviceId);
      await startSpotifyTrack(activeDeviceId, uri);
    }),
    [requirePlayer, runOperation],
  );

  const resume = useCallback(
    async () => runOperation(async () => {
      const { player, deviceId: activeDeviceId } = await requirePlayer();
      try {
        await player.activateElement();
      } catch {
        // Continue; activateElement is mainly needed where autoplay is restricted.
      }
      await transferSpotifyPlayback(activeDeviceId, true);
      await player.resume();
    }),
    [requirePlayer, runOperation],
  );

  const pause = useCallback(
    async () => runOperation(async () => {
      const { player } = await requirePlayer();
      await player.pause();
    }),
    [requirePlayer, runOperation],
  );

  const stop = useCallback(
    async () => runOperation(async () => {
      const { player } = await requirePlayer();
      await player.pause();
      await player.seek(0);
    }),
    [requirePlayer, runOperation],
  );

  const seek = useCallback(
    async (positionMs: number) => runOperation(async () => {
      const { player } = await requirePlayer();
      await player.seek(Math.max(0, Math.floor(positionMs)));
    }),
    [requirePlayer, runOperation],
  );

  const setVolume = useCallback(
    async (percent: number) => runOperation(async () => {
      const { player } = await requirePlayer();
      await player.setVolume(Math.max(0, Math.min(1, percent / 100)));
    }),
    [requirePlayer, runOperation],
  );

  const setShuffle = useCallback(
    async (value: boolean) => runOperation(async () => {
      const { deviceId: activeDeviceId } = await requirePlayer();
      await setSpotifyShuffle(activeDeviceId, value);
    }),
    [requirePlayer, runOperation],
  );

  const setRepeat = useCallback(
    async (value: boolean) => runOperation(async () => {
      const { deviceId: activeDeviceId } = await requirePlayer();
      await setSpotifyRepeat(activeDeviceId, value);
    }),
    [requirePlayer, runOperation],
  );

  return {
    connected,
    deviceId,
    environmentSupported,
    premiumRequired,
    error,
    snapshot,
    playTrack,
    resume,
    pause,
    stop,
    seek,
    setVolume,
    setShuffle,
    setRepeat,
  };
}
