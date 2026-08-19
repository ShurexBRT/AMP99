import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { WindowPosition } from "../types/player";

const SNAP_DISTANCE = 10;
const MAIN_WIDTH = 275;
const MAIN_HEIGHT = 116;

function snap(value: number, targets: number[]) {
  for (const target of targets) {
    if (Math.abs(value - target) <= SNAP_DISTANCE) return target;
  }
  return value;
}

type Options = {
  position: WindowPosition;
  onMove: (position: WindowPosition) => void;
  width: number;
  height: number;
};

export function useDraggableWindow({ position, onMove, width, height }: Options) {
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

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
    const rawX = dragOrigin.current.x + event.clientX - dragOrigin.current.pointerX;
    const rawY = dragOrigin.current.y + event.clientY - dragOrigin.current.pointerY;
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);

    const x = Math.min(maxX, Math.max(0, snap(rawX, [0, MAIN_WIDTH, window.innerWidth - width])));
    const y = Math.min(maxY, Math.max(0, snap(rawY, [0, MAIN_HEIGHT, window.innerHeight - height])));
    onMove({ x, y });
  };

  const onPointerUp = () => {
    dragOrigin.current = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
