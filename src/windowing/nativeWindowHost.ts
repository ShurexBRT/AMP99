import { isTauri } from "@tauri-apps/api/core";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import {
  getAllWebviewWindows,
  getCurrentWebviewWindow,
  WebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import type { Amp99NativeWindowRole } from "./bridge";

const POSITION_STORAGE_KEY = "amp99.nativeWindowPositions.v1";
const AUX_VISIBILITY_STORAGE_KEY = "amp99.nativeAuxVisibility.v1";
const SNAP_THRESHOLD_PX = 14;

const BASE_SIZE: Record<Amp99NativeWindowRole, { width: number; height: number }> = {
  main: { width: 275, height: 116 },
  equalizer: { width: 275, height: 116 },
  playlist: { width: 275, height: 232 },
};

type SavedPositions = Partial<
  Record<Amp99NativeWindowRole, { x: number; y: number }>
>;

type AuxVisibility = {
  equalizer: boolean;
  playlist: boolean;
};

export function currentNativeWindowRole(): Amp99NativeWindowRole | "browser" {
  if (!isTauri()) return "browser";
  const label = getCurrentWebviewWindow().label;
  return label === "main" || label === "equalizer" || label === "playlist"
    ? label
    : "browser";
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
  try {
    const current = readSavedPositions();
    current[role] = { x: position.x, y: position.y };
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Position persistence is a convenience; never block window movement for it.
  }
}

function readAuxVisibility(): AuxVisibility {
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
    const current = readAuxVisibility();
    current[role] = visible;
    localStorage.setItem(AUX_VISIBILITY_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Visibility persistence must never block window controls.
  }
}

async function restoreAuxVisibility(): Promise<void> {
  if (!isTauri()) return;
  const saved = readAuxVisibility();
  for (const role of ["equalizer", "playlist"] as const) {
    const target = await WebviewWindow.getByLabel(role);
    if (!target) continue;
    if (saved[role]) await target.show();
    else await target.hide();
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
): Promise<void> {
  if (!isNativeHostFor(role)) return;

  document.documentElement.dataset.doubleSize = doubleSize ? "true" : "false";
  const factor = doubleSize ? 2 : 1;
  const base = BASE_SIZE[role];
  const height = shaded ? 14 : base.height;
  await getCurrentWebviewWindow().setSize(
    new LogicalSize(base.width * factor, height * factor),
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

export async function setNativeWindowVisible(
  role: Exclude<Amp99NativeWindowRole, "main">,
  visible: boolean,
): Promise<void> {
  saveAuxVisibility(role, visible);
  if (!isTauri()) return;
  const target = await WebviewWindow.getByLabel(role);
  if (!target) return;
  if (visible) {
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

async function snappedPosition(
  current: WebviewWindow,
  position: PhysicalPosition,
): Promise<PhysicalPosition> {
  const currentSize = await current.outerSize();
  let x = position.x;
  let y = position.y;

  for (const other of await getAllWebviewWindows()) {
    if (other.label === current.label) continue;
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

export async function installNativeWindowHost(
  role: Amp99NativeWindowRole,
): Promise<() => void> {
  if (!isNativeHostFor(role)) return () => undefined;

  document.documentElement.dataset.nativeWindow = "true";
  document.documentElement.dataset.windowRole = role;
  document.documentElement.dataset.windowShaded = "false";

  const current = getCurrentWebviewWindow();
  const saved = readSavedPositions()[role];
  if (saved) {
    await current.setPosition(new PhysicalPosition(saved.x, saved.y));
  }

  const onMainFocus = () => {
    if (role === "main") void restoreAuxVisibility();
  };
  if (role === "main") {
    window.addEventListener("focus", onMainFocus);
    await restoreAuxVisibility();
  }

  let snapping = false;
  const unlistenMoved = await current.onMoved(({ payload }) => {
    if (snapping) return;
    void (async () => {
      const next = await snappedPosition(current, payload);
      if (next.x !== payload.x || next.y !== payload.y) {
        snapping = true;
        try {
          await current.setPosition(next);
          savePosition(role, next);
        } finally {
          window.setTimeout(() => {
            snapping = false;
          }, 0);
        }
      } else {
        savePosition(role, payload);
      }
    })();
  });

  return () => {
    unlistenMoved();
    if (role === "main") window.removeEventListener("focus", onMainFocus);
  };
}
