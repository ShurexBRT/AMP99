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
  skinBackground?: string | null;
  skinTitlebar?: string | null;
  onMove: (position: WindowPosition) => void;
}>;

export function WindowFrame({
  title,
  position,
  width,
  height,
  className = "",
  titleActions,
  skinBackground,
  skinTitlebar,
  onMove,
  children,
}: Props) {
  const drag = useDraggableWindow({ position, onMove, width, height });
  const hasSkinBackground = Boolean(skinBackground);

  return (
    <section
      className={`amp-window ${hasSkinBackground ? "legacy-skinned-window" : ""} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
        backgroundImage: skinBackground ? `url(${skinBackground})` : undefined,
      }}
      aria-label={title}
    >
      <header
        className={`amp-titlebar ${skinTitlebar ? "legacy-skinned-titlebar" : ""}`}
        style={{
          backgroundImage: skinTitlebar ? `url(${skinTitlebar})` : undefined,
        }}
        {...drag}
      >
        <span className="amp-titlebar-grip" aria-hidden="true" />
        <span className="amp-title">{title}</span>
        <span className="amp-titlebar-grip" aria-hidden="true" />
        {titleActions}
      </header>
      {children}
    </section>
  );
}
