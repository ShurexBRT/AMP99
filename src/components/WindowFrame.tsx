import type { PropsWithChildren, ReactNode } from "react";
import { useDraggableWindow } from "../hooks/useDraggableWindow";
import type { WindowPosition } from "../types/player";

type Props = PropsWithChildren<{
  title: string;
  position: WindowPosition;
  width: number;
  height: number;
  className?: string;
  titleActions?: ReactNode;
  onMove: (position: WindowPosition) => void;
}>;

export function WindowFrame({ title, position, width, height, className = "", titleActions, onMove, children }: Props) {
  const drag = useDraggableWindow({ position, onMove, width, height });

  return (
    <section
      className={`amp-window ${className}`}
      style={{ left: position.x, top: position.y, width, height }}
      aria-label={title}
    >
      <header className="amp-titlebar" {...drag}>
        <span className="amp-titlebar-grip" aria-hidden="true" />
        <span className="amp-title">{title}</span>
        <span className="amp-titlebar-grip" aria-hidden="true" />
        {titleActions}
      </header>
      {children}
    </section>
  );
}
