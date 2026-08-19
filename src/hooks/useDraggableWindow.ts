import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WindowId, WindowPosition } from "../types/player";

const SNAP_DISTANCE = 10;

type RegisteredWindow = {
  id: WindowId;
  position: WindowPosition;
  width: number;
  height: number;
};

const windowRegistry = new Map<WindowId, RegisteredWindow>();

function displayScale(): number {
  if (typeof document === "undefined") return 1;
  return document.querySelector<HTMLElement>(".desktop")?.dataset.doubleSize === "true"
    ? 2
    : 1;
}

function snapValue(value: number, targets: number[]): number {
  let best = value;
  let distance = SNAP_DISTANCE + 1;
  for (const target of targets) {
    const nextDistance = Math.abs(value - target);
    if (nextDistance <= SNAP_DISTANCE && nextDistance < distance) {
      best = target;
      distance = nextDistance;
    }
  }
  return best;
}

type Options = {
  id: WindowId;
  position: WindowPosition;
  onMove: (position: WindowPosition) => void;
  width: number;
  height: number;
};

export function useDraggableWindow({
  id,
  position,
  onMove,
  width,
  height,
}: Options) {
  const dragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  useEffect(() => {
    windowRegistry.set(id, { id, position, width, height });
    return () => {
      windowRegistry.delete(id);
    };
  }, [id, position, width, height]);

  useEffect(() => {
    const clampToViewport = () => {
      const scale = displayScale();
      const maxX = Math.max(0, window.innerWidth - width * scale);
      const maxY = Math.max(0, window.innerHeight - height * scale);
      const next = {
        x: Math.min(maxX, Math.max(0, position.x)),
        y: Math.min(maxY, Math.max(0, position.y)),
      };
      if (next.x !== position.x || next.y !== position.y) {
        moveRef.current(next);
      }
    };

    window.addEventListener("resize", clampToViewport);
    window.visualViewport?.addEventListener("resize", clampToViewport);
    return () => {
      window.removeEventListener("resize", clampToViewport);
      window.visualViewport?.removeEventListener("resize", clampToViewport);
    };
  }, [position.x, position.y, width, height]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button,input,select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragOrigin.current) return;

    const scale = displayScale();
    const visualWidth = width * scale;
    const visualHeight = height * scale;
    const rawX = dragOrigin.current.x + event.clientX - dragOrigin.current.pointerX;
    const rawY = dragOrigin.current.y + event.clientY - dragOrigin.current.pointerY;

    const xTargets = [0, Math.max(0, window.innerWidth - visualWidth)];
    const yTargets = [0, Math.max(0, window.innerHeight - visualHeight)];

    for (const other of windowRegistry.values()) {
      if (other.id === id) continue;
      const otherRight = other.position.x + other.width * scale;
      const otherBottom = other.position.y + other.height * scale;

      xTargets.push(
        other.position.x,
        otherRight,
        other.position.x - visualWidth,
        otherRight - visualWidth,
      );
      yTargets.push(
        other.position.y,
        otherBottom,
        other.position.y - visualHeight,
        otherBottom - visualHeight,
      );
    }

    const maxX = Math.max(0, window.innerWidth - visualWidth);
    const maxY = Math.max(0, window.innerHeight - visualHeight);
    const x = Math.min(maxX, Math.max(0, snapValue(rawX, xTargets)));
    const y = Math.min(maxY, Math.max(0, snapValue(rawY, yTargets)));
    onMove({ x, y });
  };

  const onPointerUp = () => {
    dragOrigin.current = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
