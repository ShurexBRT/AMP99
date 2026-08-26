import { invoke, isTauri } from "@tauri-apps/api/core";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import {
  getAllWebviewWindows,
  getCurrentWebviewWindow,
  WebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { getPreferencesSnapshot } from "../preferences/preferencesStore";
import type { Amp99NativeWindowRole } from "./bridge";
import {
  MAIN_WINDOW_HEIGHT,
  MAIN_WINDOW_MAX_HEIGHT,
  MAIN_WINDOW_MAX_WIDTH,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH,
  MAIN_WINDOW_WIDTH,
} from "./windowDimensions";

const POSITION_STORAGE_KEY = "amp99.nativeWindowPositions.v1";
const SIZE_STORAGE_KEY = "amp99.nativeWindowSizes.v1";
const AUX_VISIBILITY_STORAGE_KEY = "amp99.nativeAuxVisibility.v1";
const SNAP_THRESHOLD_PX = 14;
const DOCK_LINK_THRESHOLD_PX = 2;
const AUX_RESTORE_DELAY_MS = 180;
const AUX_RESTORE_POLL_INTERVAL_MS = 150;
const MAIN_RESTORED_EVENT = "amp99://main-restored";

const BASE_SIZE: Record<Amp99NativeWindowRole, { width: number; height: number }> = {
  main: { width: MAIN_WINDOW_WIDTH, height: MAIN_WINDOW_HEIGHT },
  equalizer: { width: 275, height: 116 },
  playlist: { width: 275, height: 232 },
};

type SavedPositions = Partial<
  Record<Amp99NativeWindowRole, { x: number; y: number }>
>;

type SavedSizes = Partial<Record<Amp99NativeWindowRole, { width: number; height: number }>>;

type NativeResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

type AuxVisibility = {
  equalizer: boolean;
  playlist: boolean;
};

type WindowGeometry = {
  role: Amp99NativeWindowRole;
  window: WebviewWindow;
  position: PhysicalPosition;
  width: number;
  height: number;
};

let scheduledAuxRestore: number | undefined;
let auxRestoreInFlight: Promise<void> | undefined;
let mainLifecycleWatcher: number | undefined;

function isAmp99NativeWindowRole(label: string): label is Amp99NativeWindowRole {
  return label === "main" || label === "equalizer" || label === "playlist";
}

export function currentNativeWindowRole(): Amp99NativeWindowRole | "preferences" | "browser" {
  if (!isTauri()) return "browser";
  const label = getCurrentWebviewWindow().label;
  if (isAmp99NativeWindowRole(label)) return label;
  return label === "preferences" ? "preferences" : "browser";
}

export function isNativeHostFor(role: Amp99NativeWindowRole): boolean {
  return isTauri() && currentNativeWindowRole() === role;
}

function readSavedPositions(): SavedPositions {
  try {
    return JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) || "{}") as SavedPositions;
  } catch {
    return {};
  }
}

function savePosition(role: Amp99NativeWindowRole, position: PhysicalPosition): void {
  if (!getPreferencesSnapshot().rememberWindowPositions) return;
  try {
    const current = readSavedPositions();
    current[role] = { x: position.x, y: position.y };
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Position persistence is a convenience; never block window movement for it.
  }
}

export function forgetNativeWindowPositions(): void {
  try {
    localStorage.removeItem(POSITION_STORAGE_KEY);
    localStorage.removeItem("amp99.windowPositions.v1");
  } catch {
    // Forgetting positions is best-effort and never blocks the player.
  }
}

function readSavedSizes(): SavedSizes {
  try {
    return JSON.parse(localStorage.getItem(SIZE_STORAGE_KEY) || "{}") as SavedSizes;
  } catch {
    return {};
  }
}

function saveSize(role: Amp99NativeWindowRole, width: number, height: number): void {
  try {
    const current = readSavedSizes();
    current[role] = { width, height };
    localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Window-size persistence is a convenience only.
  }
}

function clampMainSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.min(MAIN_WINDOW_MAX_WIDTH, Math.max(MAIN_WINDOW_MIN_WIDTH, width)),
    height: Math.min(MAIN_WINDOW_MAX_HEIGHT, Math.max(MAIN_WINDOW_MIN_HEIGHT, height)),
  };
}

export function readNativeAuxVisibility(): AuxVisibility {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(AUX_VISIBILITY_STORAGE_KEY) || "{}",
    ) as Partial<AuxVisibility>;
    return {
      equalizer: parsed.equalizer ?? true,
      playlist: parsed.playlist ?? true,
    };
  } catch {
    return { equalizer: true, playlist: true };
  }
}

function saveAuxVisibility(
  role: Exclude<Amp99NativeWindowRole, "main">,
  visible: boolean,
): void {
  try {
    const current = readNativeAuxVisibility();
    current[role] = visible;
    localStorage.setItem(AUX_VISIBILITY_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Visibility persistence must never block window controls.
  }
  if (isTauri()) {
    void invoke("set_native_auxiliary_visibility", { role, visible }).catch(() => undefined);
  }
}

async function restoreAuxVisibility(startup = false): Promise<void> {
  if (!isTauri()) return;
  if (auxRestoreInFlight && !startup) return auxRestoreInFlight;

  const restore = (async () => {
    const saved = readNativeAuxVisibility();
    const preferences = getPreferencesSnapshot();
    await Promise.all(
      (["equalizer", "playlist"] as const).map(async (role) => {
        const target = await WebviewWindow.getByLabel(role).catch(() => null);
        if (!target) return;
        const startupEnabled =
          role === "equalizer"
            ? preferences.restoreEqualizerOnStartup
            : preferences.restorePlaylistOnStartup;
        const visible = startup ? startupEnabled && saved[role] : saved[role];
        if (isTauri()) {
          void invoke("set_native_auxiliary_visibility", { role, visible }).catch(() => undefined);
        }
        if (visible) {
          // A hidden native window can reject unminimize(). Show it first, then
          // clear a possible minimized state. One broken auxiliary window must
          // never prevent the other one from being restored.
          await target.show().catch(() => undefined);
          await target.unminimize().catch(() => undefined);
        } else {
          await target.hide().catch(() => undefined);
        }
      }),
    );
  })();

  auxRestoreInFlight = restore;
  try {
    await restore;
  } finally {
    if (auxRestoreInFlight === restore) auxRestoreInFlight = undefined;
  }
}

function scheduleAuxVisibilityRestore(): void {
  if (scheduledAuxRestore !== undefined) {
    window.clearTimeout(scheduledAuxRestore);
  }

  void restoreAuxVisibility(false);
  scheduledAuxRestore = window.setTimeout(() => {
    scheduledAuxRestore = undefined;
    void restoreAuxVisibility(false);
  }, AUX_RESTORE_DELAY_MS);
}

function watchMainLifecycle(current: WebviewWindow): () => void {
  let wasMinimized: boolean | undefined;
  let wasVisible: boolean | undefined;
  let checkInFlight = false;

  const watcher = window.setInterval(() => {
    if (checkInFlight) return;
    checkInFlight = true;
    void (async () => {
      const [minimized, visible] = await Promise.all([
        current.isMinimized().catch(() => false),
        current.isVisible().catch(() => true),
      ]);
      if (
        (wasMinimized === true && !minimized) ||
        (wasVisible === false && visible)
      ) {
        scheduleAuxVisibilityRestore();
      }
      wasMinimized = minimized;
      wasVisible = visible;
    })().finally(() => {
      checkInFlight = false;
    });
  }, AUX_RESTORE_POLL_INTERVAL_MS);

  mainLifecycleWatcher = watcher;
  return () => {
    window.clearInterval(watcher);
    if (mainLifecycleWatcher === watcher) mainLifecycleWatcher = undefined;
  };
}

export async function hidePlayerWindowGroup(): Promise<void> {
  if (!isTauri()) return;
  for (const role of ["main", "equalizer", "playlist"] as const) {
    const target = await WebviewWindow.getByLabel(role);
    if (target) await target.hide().catch(() => undefined);
  }
}

function scaleFromDocument(): number {
  return document.documentElement.dataset.doubleSize === "true" ? 2 : 1;
}

function shadedFromDocument(): boolean {
  return document.documentElement.dataset.windowShaded === "true";
}

export async function applyNativeWindowSize(
  role: Amp99NativeWindowRole,
  doubleSize: boolean,
  shaded = shadedFromDocument(),
  widthOverride?: number,
): Promise<void> {
  if (!isNativeHostFor(role)) return;

  document.documentElement.dataset.doubleSize = doubleSize ? "true" : "false";
  const factor = doubleSize ? 2 : 1;
  const base = BASE_SIZE[role];
  const width = widthOverride ?? base.width;

  if (role === "playlist" && !shaded && !doubleSize) {
    const saved = readSavedSizes().playlist;
    if (saved) {
      await getCurrentWebviewWindow().setSize(
        new LogicalSize(Math.max(275, saved.width), Math.max(145, saved.height)),
      );
      return;
    }
  }

  if (
    role === "main" &&
    widthOverride === MAIN_WINDOW_WIDTH &&
    !shaded &&
    !doubleSize
  ) {
    const saved = readSavedSizes().main;
    if (saved) {
      const size = clampMainSize(saved.width, saved.height);
      await getCurrentWebviewWindow().setSize(new LogicalSize(size.width, size.height));
      return;
    }
  }

  const height = shaded ? 14 : base.height;
  await getCurrentWebviewWindow().setSize(
    new LogicalSize(width * factor, height * factor),
  );
}

export async function applyNativeShade(
  role: Amp99NativeWindowRole,
  shaded: boolean,
): Promise<void> {
  if (!isNativeHostFor(role)) return;
  document.documentElement.dataset.windowShaded = shaded ? "true" : "false";
  await applyNativeWindowSize(role, scaleFromDocument() === 2, shaded);
}

export async function startNativeWindowDrag(
  role: Amp99NativeWindowRole,
): Promise<boolean> {
  if (!isNativeHostFor(role)) return false;
  await getCurrentWebviewWindow().startDragging();
  return true;
}

export async function startNativeWindowResize(
  role: Amp99NativeWindowRole,
  direction: NativeResizeDirection = "SouthEast",
): Promise<boolean> {
  if (!isNativeHostFor(role)) return false;
  await getCurrentWebviewWindow().startResizeDragging(direction);
  return true;
}

export async function setNativeWindowVisible(
  role: Exclude<Amp99NativeWindowRole, "main">,
  visible: boolean,
): Promise<void> {
  saveAuxVisibility(role, visible);
  if (!isTauri()) return;
  const target = await WebviewWindow.getByLabel(role);
  if (!target) return;
  if (visible) {
    await target.unminimize().catch(() => undefined);
    await target.show();
    await target.setFocus();
  } else {
    await target.hide();
  }
}

export async function hideCurrentNativeWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWebviewWindow().hide();
}

function geometriesAreDocked(a: WindowGeometry, b: WindowGeometry): boolean {
  const aLeft = a.position.x;
  const aRight = aLeft + a.width;
  const aTop = a.position.y;
  const aBottom = aTop + a.height;
  const bLeft = b.position.x;
  const bRight = bLeft + b.width;
  const bTop = b.position.y;
  const bBottom = bTop + b.height;

  const verticalOverlap = Math.min(aBottom, bBottom) - Math.max(aTop, bTop) > 0;
  const horizontalOverlap = Math.min(aRight, bRight) - Math.max(aLeft, bLeft) > 0;

  const touchesHorizontally =
    Math.abs(aRight - bLeft) <= DOCK_LINK_THRESHOLD_PX ||
    Math.abs(bRight - aLeft) <= DOCK_LINK_THRESHOLD_PX;
  const touchesVertically =
    Math.abs(aBottom - bTop) <= DOCK_LINK_THRESHOLD_PX ||
    Math.abs(bBottom - aTop) <= DOCK_LINK_THRESHOLD_PX;

  return (
    (touchesHorizontally && verticalOverlap) ||
    (touchesVertically && horizontalOverlap)
  );
}

async function visibleWindowGeometries(
  current: WebviewWindow,
  currentPositionOverride?: PhysicalPosition,
): Promise<WindowGeometry[]> {
  const geometries: WindowGeometry[] = [];

  for (const candidate of await getAllWebviewWindows()) {
    if (!isAmp99NativeWindowRole(candidate.label)) continue;
    if (!(await candidate.isVisible())) continue;

    const position =
      candidate.label === current.label && currentPositionOverride
        ? currentPositionOverride
        : await candidate.outerPosition();
    const size = await candidate.outerSize();

    geometries.push({
      role: candidate.label,
      window: candidate,
      position,
      width: size.width,
      height: size.height,
    });
  }

  return geometries;
}

async function dockedGroupFromMain(
  current: WebviewWindow,
  previousMainPosition: PhysicalPosition,
): Promise<WindowGeometry[]> {
  const geometries = await visibleWindowGeometries(current, previousMainPosition);
  const main = geometries.find((geometry) => geometry.role === "main");
  if (!main) return [];

  const connected = new Set<Amp99NativeWindowRole>(["main"]);
  let expanded = true;

  while (expanded) {
    expanded = false;
    for (const candidate of geometries) {
      if (connected.has(candidate.role)) continue;
      const attachesToGroup = geometries.some(
        (member) =>
          connected.has(member.role) && geometriesAreDocked(member, candidate),
      );
      if (attachesToGroup) {
        connected.add(candidate.role);
        expanded = true;
      }
    }
  }

  return geometries.filter(
    (geometry) => geometry.role !== "main" && connected.has(geometry.role),
  );
}

async function snappedPosition(
  current: WebviewWindow,
  position: PhysicalPosition,
  excludedLabels: ReadonlySet<string> = new Set(),
): Promise<PhysicalPosition> {
  const currentSize = await current.outerSize();
  let x = position.x;
  let y = position.y;

  for (const other of await getAllWebviewWindows()) {
    if (other.label === current.label || excludedLabels.has(other.label)) continue;
    if (!(await other.isVisible())) continue;

    const otherPosition = await other.outerPosition();
    const otherSize = await other.outerSize();

    const currentLeft = x;
    const currentRight = x + currentSize.width;
    const currentTop = y;
    const currentBottom = y + currentSize.height;
    const otherLeft = otherPosition.x;
    const otherRight = otherPosition.x + otherSize.width;
    const otherTop = otherPosition.y;
    const otherBottom = otherPosition.y + otherSize.height;

    const verticalOverlap =
      currentBottom >= otherTop - SNAP_THRESHOLD_PX &&
      currentTop <= otherBottom + SNAP_THRESHOLD_PX;
    const horizontalOverlap =
      currentRight >= otherLeft - SNAP_THRESHOLD_PX &&
      currentLeft <= otherRight + SNAP_THRESHOLD_PX;

    if (verticalOverlap) {
      if (Math.abs(currentLeft - otherRight) <= SNAP_THRESHOLD_PX) x = otherRight;
      if (Math.abs(currentRight - otherLeft) <= SNAP_THRESHOLD_PX) {
        x = otherLeft - currentSize.width;
      }
      if (Math.abs(currentLeft - otherLeft) <= SNAP_THRESHOLD_PX) x = otherLeft;
      if (Math.abs(currentRight - otherRight) <= SNAP_THRESHOLD_PX) {
        x = otherRight - currentSize.width;
      }
    }

    if (horizontalOverlap) {
      if (Math.abs(currentTop - otherBottom) <= SNAP_THRESHOLD_PX) y = otherBottom;
      if (Math.abs(currentBottom - otherTop) <= SNAP_THRESHOLD_PX) {
        y = otherTop - currentSize.height;
      }
      if (Math.abs(currentTop - otherTop) <= SNAP_THRESHOLD_PX) y = otherTop;
      if (Math.abs(currentBottom - otherBottom) <= SNAP_THRESHOLD_PX) {
        y = otherBottom - currentSize.height;
      }
    }
  }

  return new PhysicalPosition(x, y);
}

async function moveDockedGroupWithMain(
  current: WebviewWindow,
  previousMainPosition: PhysicalPosition,
  requestedMainPosition: PhysicalPosition,
): Promise<PhysicalPosition> {
  const docked = await dockedGroupFromMain(current, previousMainPosition);
  const excluded = new Set(docked.map((geometry) => geometry.role));
  const finalMainPosition = await snappedPosition(
    current,
    requestedMainPosition,
    excluded,
  );

  const deltaX = finalMainPosition.x - previousMainPosition.x;
  const deltaY = finalMainPosition.y - previousMainPosition.y;

  if ((deltaX !== 0 || deltaY !== 0) && docked.length > 0) {
    await Promise.all(
      docked.map(async (geometry) => {
        const next = new PhysicalPosition(
          geometry.position.x + deltaX,
          geometry.position.y + deltaY,
        );
        await geometry.window.setPosition(next);
        savePosition(geometry.role, next);
      }),
    );
  }

  return finalMainPosition;
}

export async function minimizeNativeWindowGroup(): Promise<boolean> {
  if (!isNativeHostFor("main")) return false;

  const current = getCurrentWebviewWindow();
  try {
    const mainPosition = await current.outerPosition();
    const docked = await dockedGroupFromMain(current, mainPosition);
    await Promise.all(
      [current, ...docked.map((geometry) => geometry.window)].map((window) =>
        window.minimize().catch(() => undefined),
      ),
    );
  } catch {
    await current.minimize().catch(() => undefined);
  }
  return true;
}

export async function installNativeWindowHost(
  role: Amp99NativeWindowRole,
): Promise<() => void> {
  if (!isNativeHostFor(role)) return () => undefined;

  document.documentElement.dataset.nativeWindow = "true";
  document.documentElement.dataset.windowRole = role;
  document.documentElement.dataset.windowShaded = "false";

  const current = getCurrentWebviewWindow();
  const preferences = getPreferencesSnapshot();
  const saved = preferences.rememberWindowPositions
    ? readSavedPositions()[role]
    : undefined;
  if (saved) {
    await current.setPosition(new PhysicalPosition(saved.x, saved.y));
  }

  if (role === "playlist") {
    const savedSize = readSavedSizes().playlist;
    if (savedSize) {
      await current.setSize(
        new LogicalSize(Math.max(275, savedSize.width), Math.max(145, savedSize.height)),
      );
    }
  }

  let lastKnownPosition = await current.outerPosition();

  let unlistenFocused: (() => void) | undefined;
  let unlistenNativeRestore: (() => void) | undefined;
  let onDomFocus: (() => void) | undefined;
  let onVisibilityChange: (() => void) | undefined;
  let stopMainLifecycleWatcher: (() => void) | undefined;
  if (role === "main") {
    unlistenFocused = await current.onFocusChanged(({ payload }) => {
      if (payload) scheduleAuxVisibilityRestore();
    });
    onDomFocus = () => scheduleAuxVisibilityRestore();
    onVisibilityChange = () => {
      if (!document.hidden) scheduleAuxVisibilityRestore();
    };
    window.addEventListener("focus", onDomFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    unlistenNativeRestore = await current
      .listen(MAIN_RESTORED_EVENT, () => {
        scheduleAuxVisibilityRestore();
      })
      .catch(() => undefined);
    stopMainLifecycleWatcher = watchMainLifecycle(current);
    await restoreAuxVisibility(true);
    window.setTimeout(() => void restoreAuxVisibility(false), AUX_RESTORE_DELAY_MS);
    if (preferences.startMinimized) await hidePlayerWindowGroup();
  }

  let snapping = false;
  let mainMoveBusy = false;
  let pendingMainPosition: PhysicalPosition | null = null;

  const unlistenResized = await current.onResized(({ payload }) => {
    if (
      (role !== "playlist" && role !== "main") ||
      shadedFromDocument() ||
      scaleFromDocument() !== 1
    ) {
      return;
    }
    void (async () => {
      const scaleFactor = await current.scaleFactor();
      const logical = payload.toLogical(scaleFactor);
      if (role === "main") {
        const size = clampMainSize(logical.width, logical.height);
        saveSize(role, size.width, size.height);
      } else {
        saveSize(role, Math.max(275, logical.width), Math.max(145, logical.height));
      }
    })();
  });

  const processMainMoves = async () => {
    if (mainMoveBusy) return;
    mainMoveBusy = true;

    try {
      while (pendingMainPosition) {
        const requested = pendingMainPosition;
        pendingMainPosition = null;
        const previous = lastKnownPosition;
        const next = await moveDockedGroupWithMain(current, previous, requested);

        if (next.x !== requested.x || next.y !== requested.y) {
          snapping = true;
          try {
            await current.setPosition(next);
          } finally {
            window.setTimeout(() => {
              snapping = false;
            }, 0);
          }
        }

        lastKnownPosition = next;
        savePosition(role, next);
      }
    } finally {
      mainMoveBusy = false;
      if (pendingMainPosition) void processMainMoves();
    }
  };

  const unlistenMoved = await current.onMoved(({ payload }) => {
    if (snapping) {
      lastKnownPosition = payload;
      return;
    }

    if (role === "main") {
      pendingMainPosition = payload;
      void processMainMoves();
      return;
    }

    void (async () => {
      const next = await snappedPosition(current, payload);
      if (next.x !== payload.x || next.y !== payload.y) {
        snapping = true;
        try {
          await current.setPosition(next);
          lastKnownPosition = next;
          savePosition(role, next);
        } finally {
          window.setTimeout(() => {
            snapping = false;
          }, 0);
        }
      } else {
        lastKnownPosition = payload;
        savePosition(role, payload);
      }
    })();
  });

  return () => {
    unlistenResized();
    unlistenMoved();
    unlistenFocused?.();
    unlistenNativeRestore?.();
    if (onDomFocus) window.removeEventListener("focus", onDomFocus);
    if (onVisibilityChange) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    stopMainLifecycleWatcher?.();
  };
}
