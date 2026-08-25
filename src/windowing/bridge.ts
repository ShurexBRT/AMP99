import type { SpotifyPlaylist, SpotifyTrack } from "../spotify/types";
import type { Track } from "../types/player";

const CHANNEL_NAME = "amp99-native-window-bus-v1";
const REQUEST_TIMEOUT_MS = 30_000;

export type Amp99NativeWindowRole = "main" | "equalizer" | "playlist";

export type MainWindowSnapshot = {
  tracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  balance: number;
  progress: number;
  shuffle: boolean;
  repeat: boolean;
  doubleSize: boolean;
  playlistVisible: boolean;
  equalizerVisible: boolean;
  spotifyAuthenticated: boolean;
  spotifyDisplayName: string | null;
  spotifyPlaylists: SpotifyPlaylist[];
  spotifyLoading: boolean;
  spotifyError: string | null;
  activeSpotifyPlaylist: SpotifyPlaylist | null;
  spotifyPlaylistEditable: boolean;
  spotifyPlaylistReorderSafe: boolean;
};

export type MainCommandMap = {
  togglePlay: { request: undefined; response: void };
  stop: { request: undefined; response: void };
  previous: { request: undefined; response: void };
  next: { request: undefined; response: void };
  setVolume: { request: number; response: void };
  setBalance: { request: number; response: void };
  setProgress: { request: number; response: void };
  toggleShuffle: { request: undefined; response: void };
  toggleRepeat: { request: undefined; response: void };
  setDoubleSize: { request: boolean; response: void };
  setPlaylistVisible: { request: boolean; response: void };
  setEqualizerVisible: { request: boolean; response: void };
  selectTrack: { request: number; response: void };
  playNextTrack: { request: number; response: void };
  removeQueueTrack: { request: number; response: void };
  moveQueueTrack: {
    request: { trackIndex: number; direction: -1 | 1 };
    response: void;
  };
  connectSpotify: { request: undefined; response: void };
  disconnectSpotify: { request: undefined; response: void };
  refreshSpotify: { request: undefined; response: void };
  loadSpotifyPlaylist: {
    request: SpotifyPlaylist;
    response: { trackCount: number; skippedNonTracks: number };
  };
  loadLikedSongs: { request: undefined; response: { trackCount: number } };
  createSpotifyPlaylist: {
    request: { name: string; isPublic: boolean };
    response: SpotifyPlaylist;
  };
  searchSpotifyTracks: { request: string; response: SpotifyTrack[] };
  addSpotifyTrack: {
    request: SpotifyTrack;
    response: { trackCount: number };
  };
  removeSpotifyTrack: { request: Track; response: { trackCount: number } };
  moveSpotifyTrack: {
    request: { trackIndex: number; direction: -1 | 1 };
    response: { trackCount: number; newIndex: number };
  };
  clearQueue: { request: undefined; response: void };
};

export type MainCommandName = keyof MainCommandMap;

type MainRequestEnvelope = {
  kind: "request";
  id: string;
  source: Amp99NativeWindowRole;
  command: MainCommandName;
  payload: unknown;
};

type MainResponseEnvelope = {
  kind: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type SnapshotEnvelope = {
  kind: "snapshot";
  snapshot: MainWindowSnapshot;
};

type SkinEnvelope =
  | { kind: "skin-file"; name: string; bytes: ArrayBuffer }
  | { kind: "skin-reset" };

type BusEnvelope = MainRequestEnvelope | MainResponseEnvelope | SnapshotEnvelope | SkinEnvelope;

let channel: BroadcastChannel | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isWindowRole(value: unknown): value is Amp99NativeWindowRole {
  return value === "main" || value === "equalizer" || value === "playlist";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const COMMAND_PAYLOAD_VALIDATORS: Record<
  MainCommandName,
  (value: unknown) => boolean
> = {
  togglePlay: (value) => value === undefined,
  stop: (value) => value === undefined,
  previous: (value) => value === undefined,
  next: (value) => value === undefined,
  setVolume: (value) => isFiniteNumber(value) && value >= 0 && value <= 100,
  setBalance: (value) => isFiniteNumber(value) && value >= -100 && value <= 100,
  setProgress: (value) => isFiniteNumber(value) && value >= 0 && value <= 100,
  toggleShuffle: (value) => value === undefined,
  toggleRepeat: (value) => value === undefined,
  setDoubleSize: (value) => typeof value === "boolean",
  setPlaylistVisible: (value) => typeof value === "boolean",
  setEqualizerVisible: (value) => typeof value === "boolean",
  selectTrack: (value) => Number.isInteger(value) && (value as number) >= 0,
  playNextTrack: (value) => Number.isInteger(value) && (value as number) >= 0,
  removeQueueTrack: (value) => Number.isInteger(value) && (value as number) >= 0,
  moveQueueTrack: (value) =>
    isRecord(value) &&
    Number.isInteger(value.trackIndex) &&
    (value.trackIndex as number) >= 0 &&
    (value.direction === -1 || value.direction === 1),
  connectSpotify: (value) => value === undefined,
  disconnectSpotify: (value) => value === undefined,
  refreshSpotify: (value) => value === undefined,
  loadSpotifyPlaylist: (value) => isRecord(value) && typeof value.id === "string",
  loadLikedSongs: (value) => value === undefined,
  createSpotifyPlaylist: (value) =>
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.isPublic === "boolean",
  searchSpotifyTracks: (value) =>
    typeof value === "string" && value.trim().length > 0,
  addSpotifyTrack: (value) => isRecord(value) && typeof value.id === "string",
  removeSpotifyTrack: (value) => isRecord(value) && typeof value.id === "string",
  moveSpotifyTrack: (value) =>
    isRecord(value) &&
    Number.isInteger(value.trackIndex) &&
    (value.trackIndex as number) >= 0 &&
    (value.direction === -1 || value.direction === 1),
  clearQueue: (value) => value === undefined,
};

function isValidCommandPayload(
  command: MainCommandName,
  payload: unknown,
): boolean {
  return COMMAND_PAYLOAD_VALIDATORS[command](payload);
}

function isRequestEnvelope(value: unknown): value is MainRequestEnvelope {
  if (!isRecord(value) || value.kind !== "request") return false;
  if (typeof value.id !== "string" || !isWindowRole(value.source)) return false;
  if (
    typeof value.command !== "string" ||
    !Object.hasOwn(COMMAND_PAYLOAD_VALIDATORS, value.command)
  ) {
    return false;
  }
  return isValidCommandPayload(
    value.command as MainCommandName,
    value.payload,
  );
}

function isSnapshotEnvelope(value: unknown): value is SnapshotEnvelope {
  return isRecord(value) && value.kind === "snapshot" && isRecord(value.snapshot);
}

function isSkinEnvelope(value: unknown): value is SkinEnvelope {
  if (!isRecord(value)) return false;
  if (value.kind === "skin-reset") return true;
  return (
    value.kind === "skin-file" &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.bytes instanceof ArrayBuffer
  );
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function requestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function publishMainSnapshot(snapshot: MainWindowSnapshot): void {
  getChannel()?.postMessage({ kind: "snapshot", snapshot } satisfies SnapshotEnvelope);
}

export function subscribeMainSnapshot(
  listener: (snapshot: MainWindowSnapshot) => void,
): () => void {
  const bus = getChannel();
  if (!bus) return () => undefined;

  const onMessage = (event: MessageEvent<BusEnvelope>) => {
    if (isSnapshotEnvelope(event.data)) listener(event.data.snapshot);
  };
  bus.addEventListener("message", onMessage);
  return () => bus.removeEventListener("message", onMessage);
}

export async function requestMain<K extends MainCommandName>(
  source: Amp99NativeWindowRole,
  command: K,
  payload: MainCommandMap[K]["request"],
): Promise<MainCommandMap[K]["response"]> {
  const bus = getChannel();
  if (!bus) throw new Error("AMP99 inter-window channel is unavailable.");
  if (!isWindowRole(source)) {
    throw new Error("AMP99 rejected an invalid inter-window command source.");
  }

  const id = requestId();
  const request: MainRequestEnvelope = {
    kind: "request",
    id,
    source,
    command,
    payload,
  };

  if (!isValidCommandPayload(command, payload)) {
    throw new Error(`AMP99 rejected an invalid ${String(command)} command payload.`);
  }

  return new Promise<MainCommandMap[K]["response"]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      bus.removeEventListener("message", onMessage);
      reject(new Error(`AMP99 main window did not answer ${String(command)}.`));
    }, REQUEST_TIMEOUT_MS);

    const onMessage = (event: MessageEvent<BusEnvelope>) => {
      const message = event.data;
      if (message?.kind !== "response" || message.id !== id) return;
      window.clearTimeout(timeout);
      bus.removeEventListener("message", onMessage);
      if (message.ok) {
        resolve(message.result as MainCommandMap[K]["response"]);
      } else {
        reject(new Error(message.error || "AMP99 main-window command failed."));
      }
    };

    bus.addEventListener("message", onMessage);
    bus.postMessage(request);
  });
}

export function subscribeMainRequests(
  handler: (request: {
    source: Amp99NativeWindowRole;
    command: MainCommandName;
    payload: unknown;
  }) => Promise<unknown>,
): () => void {
  const bus = getChannel();
  if (!bus) return () => undefined;

  const onMessage = (event: MessageEvent<BusEnvelope>) => {
    const message = event.data;
    if (!isRequestEnvelope(message)) {
      const invalidMessage = message as unknown as Record<string, unknown>;
      if (isRecord(invalidMessage) && invalidMessage.kind === "request" && typeof invalidMessage.id === "string") {
        bus.postMessage({
          kind: "response",
          id: invalidMessage.id,
          ok: false,
          error: "AMP99 rejected an invalid inter-window command.",
        } satisfies MainResponseEnvelope);
      }
      return;
    }

    void handler({
      source: message.source,
      command: message.command,
      payload: message.payload,
    }).then(
      (result) => {
        bus.postMessage({
          kind: "response",
          id: message.id,
          ok: true,
          result,
        } satisfies MainResponseEnvelope);
      },
      (error) => {
        bus.postMessage({
          kind: "response",
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies MainResponseEnvelope);
      },
    );
  };

  bus.addEventListener("message", onMessage);
  return () => bus.removeEventListener("message", onMessage);
}

export function broadcastSkinFile(name: string, bytes: ArrayBuffer): void {
  getChannel()?.postMessage({ kind: "skin-file", name, bytes } satisfies SkinEnvelope);
}

export function broadcastSkinReset(): void {
  getChannel()?.postMessage({ kind: "skin-reset" } satisfies SkinEnvelope);
}

export function subscribeSkinSync(
  listener: (event: { type: "file"; name: string; bytes: ArrayBuffer } | { type: "reset" }) => void,
): () => void {
  const bus = getChannel();
  if (!bus) return () => undefined;

  const onMessage = (event: MessageEvent<BusEnvelope>) => {
    const message = event.data;
    if (!isSkinEnvelope(message)) return;
    if (message.kind === "skin-file") {
      listener({ type: "file", name: message.name, bytes: message.bytes });
    } else if (message?.kind === "skin-reset") {
      listener({ type: "reset" });
    }
  };

  bus.addEventListener("message", onMessage);
  return () => bus.removeEventListener("message", onMessage);
}
