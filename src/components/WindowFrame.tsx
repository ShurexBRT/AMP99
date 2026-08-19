import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { useDraggableWindow } from "../hooks/useDraggableWindow";
import type { WindowId, WindowPosition } from "../types/player";

const WINDOW_FOCUS_EVENT = "amp99-window-focus";

function inferWindowId(title: string): WindowId {
  const normalized = title.toLowerCase();
  if (normalized.includes("equalizer")) return "equalizer";
  if (normalized.includes("playlist")) return "playlist";
  return "main";
}

type Props = PropsWithChildren<{
  windowId?: WindowId;
  title: string;
  position: WindowPosition;
  width: number;
  height: number;
  className?: string;
  titleActions?: ReactNode;
  skinBackground?: string | null;
  skinTitlebar?: string | null;
  inactiveSkinTitlebar?: string | null;
  shadeable?: boolean;
  skinShadeBackground?: string | null;
  inactiveSkinShadeBackground?: string | null;
  onMove: (position: WindowPosition) => void;
}>;

export function WindowFrame({
  windowId,
  title,
  position,
  width,
  height,
  className = "",
  titleActions,
  skinBackground,
  skinTitlebar,
  inactiveSkinTitlebar,
  shadeable = true,
  skinShadeBackground,
  inactiveSkinShadeBackground,
  onMove,
  children,
}: Props) {
  const resolvedWindowId = windowId ?? inferWindowId(title);
  const [active, setActive] = useState(resolvedWindowId === "main");
  const [shaded, setShaded] = useState(false);
  const renderedHeight = shaded ? 14 : height;
  const drag = useDraggableWindow({
    id: resolvedWindowId,
    position,
    onMove,
    width,
    height: renderedHeight,
  });

  useEffect(() => {
    const listener = (event: Event) => {
      const focusedId = (event as CustomEvent<WindowId>).detail;
      setActive(focusedId === resolvedWindowId);
    };
    window.addEventListener(WINDOW_FOCUS_EVENT, listener);
    return () => window.removeEventListener(WINDOW_FOCUS_EVENT, listener);
  }, [resolvedWindowId]);

  const activate = () => {
    window.dispatchEvent(
      new CustomEvent<WindowId>(WINDOW_FOCUS_EVENT, { detail: resolvedWindowId }),
    );
  };

  const onTitlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    activate();
    drag.onPointerDown(event);
  };

  const activeTitlebar = active ? skinTitlebar : inactiveSkinTitlebar ?? skinTitlebar;
  const activeShade = active
    ? skinShadeBackground
    : inactiveSkinShadeBackground ?? skinShadeBackground;
  const displayedBackground = shaded && activeShade ? activeShade : skinBackground;
  const displayedTitlebar = shaded && activeShade ? null : activeTitlebar;
  const hasSkinBackground = Boolean(displayedBackground);

  return (
    <section
      className={`amp-window ${hasSkinBackground ? "legacy-skinned-window" : ""} ${shaded ? "amp-window-shaded" : ""} ${active ? "amp-window-active" : "amp-window-inactive"} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width,
        height: renderedHeight,
        backgroundImage: displayedBackground
          ? `url(${displayedBackground})`
          : undefined,
        backgroundSize: shaded ? `${width}px 14px` : undefined,
      }}
      aria-label={title}
      data-window-id={resolvedWindowId}
      data-active={active ? "true" : "false"}
      data-shaded={shaded ? "true" : "false"}
      onPointerDownCapture={activate}
    >
      <header
        className={`amp-titlebar ${displayedTitlebar ? "legacy-skinned-titlebar" : ""}`}
        style={{
          backgroundImage: displayedTitlebar
            ? `url(${displayedTitlebar})`
            : undefined,
        }}
        onPointerDown={onTitlePointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onDoubleClick={() => shadeable && setShaded((value) => !value)}
        title={shadeable ? "Double-click to toggle shade mode" : undefined}
      >
        <span className="amp-titlebar-grip" aria-hidden="true" />
        <span className="amp-title">{title}</span>
        <span className="amp-titlebar-grip" aria-hidden="true" />
        {titleActions}
      </header>
      {!shaded && children}
    </section>
  );
}
