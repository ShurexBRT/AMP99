import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { useDraggableWindow } from "../hooks/useDraggableWindow";
import { hideHostWindowToTray, minimizeHostWindow } from "../platform/windowControls";
import { useCurrentSkin } from "../skins/useSkinManager";
import type { WindowId, WindowPosition } from "../types/player";

const WINDOW_FOCUS_EVENT = "amp99-window-focus";
const WINDOW_CLOSE_EVENT = "amp99-window-close";

type WindowStyle = CSSProperties & {
  "--playlist-normal"?: string;
  "--playlist-current"?: string;
  "--playlist-bg"?: string;
  "--playlist-selected-bg"?: string;
};

type ControlKind = "minimize" | "shade" | "close";

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
  const sharedSkin = useCurrentSkin();
  const sharedSprite = (name: string) => sharedSkin?.sprites.get(name) ?? null;
  const [active, setActive] = useState(resolvedWindowId === "main");
  const [shaded, setShaded] = useState(false);
  const [pressedControl, setPressedControl] = useState<ControlKind | null>(null);
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

  let sharedBackground: string | null = null;
  let sharedTitlebar: string | null = null;
  let sharedInactiveTitlebar: string | null = null;
  let sharedShade: string | null = null;
  let sharedInactiveShade: string | null = null;

  if (resolvedWindowId === "main") {
    sharedBackground = sharedSprite("main.windowBackground");
    sharedTitlebar = sharedSprite("main.titlebarActive");
    sharedInactiveTitlebar = sharedSprite("main.titlebarInactive");
    sharedShade = sharedSprite("main.shadeActive");
    sharedInactiveShade = sharedSprite("main.shadeInactive");
  } else if (resolvedWindowId === "equalizer") {
    sharedBackground = sharedSprite("eq.windowBackground");
    sharedTitlebar = sharedSprite("eq.titlebarActive");
    sharedInactiveTitlebar = sharedSprite("eq.titlebarInactive");
    sharedShade = sharedSprite("eq.shadeActive");
    sharedInactiveShade = sharedSprite("eq.shadeInactive");
  } else {
    sharedBackground = active
      ? sharedSprite("playlist.windowBackgroundActive")
      : sharedSprite("playlist.windowBackgroundInactive");
    sharedShade = active
      ? sharedSprite("playlist.shadeBackgroundActive")
      : sharedSprite("playlist.shadeBackgroundInactive");
  }

  const resolvedBackground = skinBackground ?? sharedBackground;
  const resolvedTitlebar = skinTitlebar ?? sharedTitlebar;
  const resolvedInactiveTitlebar = inactiveSkinTitlebar ?? sharedInactiveTitlebar;
  const resolvedShade = skinShadeBackground ?? sharedShade;
  const resolvedInactiveShade = inactiveSkinShadeBackground ?? sharedInactiveShade;

  const activeTitlebar = active
    ? resolvedTitlebar
    : resolvedInactiveTitlebar ?? resolvedTitlebar;
  const activeShade = active
    ? resolvedShade
    : resolvedInactiveShade ?? resolvedShade;
  const displayedBackground = shaded && activeShade ? activeShade : resolvedBackground;
  const displayedTitlebar =
    resolvedWindowId === "playlist" || (shaded && activeShade)
      ? null
      : activeTitlebar;
  const hasSkinBackground = Boolean(displayedBackground);
  const colors = sharedSkin?.playlistColors;

  const style: WindowStyle = {
    left: position.x,
    top: position.y,
    width,
    height: renderedHeight,
    backgroundImage: displayedBackground ? `url(${displayedBackground})` : undefined,
    backgroundSize: shaded ? `${width}px 14px` : undefined,
  };

  if (resolvedWindowId === "playlist" && colors) {
    style["--playlist-normal"] = colors.normal;
    style["--playlist-current"] = colors.current;
    style["--playlist-bg"] = colors.normalBackground;
    style["--playlist-selected-bg"] = colors.selectedBackground;
  }

  const spriteFor = (kind: ControlKind, pressed: boolean): string | null => {
    if (resolvedWindowId === "main") {
      if (kind === "minimize") {
        return sharedSprite(pressed ? "main.minimizePressed" : "main.minimize");
      }
      if (kind === "shade") {
        if (shaded) {
          return sharedSprite(pressed ? "main.unshadePressed" : "main.unshade");
        }
        return sharedSprite(pressed ? "main.shadePressed" : "main.shade");
      }
      return sharedSprite(pressed ? "main.closePressed" : "main.close");
    }

    if (resolvedWindowId === "equalizer") {
      if (kind === "shade") {
        return sharedSprite(
          pressed ? "eq.shadeButtonPressed" : shaded ? "eq.shadeButtonPressed" : "eq.shade",
        );
      }
      if (kind === "close") {
        return sharedSprite(pressed ? "eq.closePressed" : "eq.close");
      }
      return null;
    }

    if (kind === "shade") {
      return sharedSprite(pressed ? "playlist.shadePressed" : "playlist.shade");
    }
    if (kind === "close") {
      return sharedSprite(pressed ? "playlist.closePressed" : "playlist.close");
    }
    return null;
  };

  const onControl = (kind: ControlKind) => {
    if (kind === "shade") {
      if (shadeable) setShaded((value) => !value);
      return;
    }

    if (kind === "minimize" && resolvedWindowId === "main") {
      void minimizeHostWindow();
      return;
    }

    if (kind === "close") {
      if (resolvedWindowId === "main") {
        void hideHostWindowToTray();
      } else {
        window.dispatchEvent(
          new CustomEvent<WindowId>(WINDOW_CLOSE_EVENT, { detail: resolvedWindowId }),
        );
      }
    }
  };

  const controls: ControlKind[] =
    resolvedWindowId === "main" ? ["minimize", "shade", "close"] : ["shade", "close"];

  return (
    <section
      className={`amp-window ${hasSkinBackground ? "legacy-skinned-window" : ""} ${shaded ? "amp-window-shaded" : ""} ${active ? "amp-window-active" : "amp-window-inactive"} ${className}`}
      style={style}
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
          backgroundColor:
            resolvedWindowId === "playlist" && hasSkinBackground
              ? "transparent"
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
        <span className="classic-title-controls" data-window={resolvedWindowId}>
          {controls.map((kind) => {
            const image = spriteFor(kind, pressedControl === kind);
            const glyph = kind === "minimize" ? "_" : kind === "shade" ? (shaded ? "□" : "▱") : "×";
            const label =
              kind === "minimize"
                ? "Minimize AMP99"
                : kind === "shade"
                  ? shaded
                    ? `Unshade ${title}`
                    : `Shade ${title}`
                  : resolvedWindowId === "main"
                    ? "Hide AMP99 to tray"
                    : `Close ${title}`;

            return (
              <button
                key={kind}
                type="button"
                className={`classic-title-control classic-title-${kind}`}
                aria-label={label}
                title={label}
                style={{ backgroundImage: image ? `url(${image})` : undefined }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setPressedControl(kind);
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  setPressedControl(null);
                }}
                onPointerLeave={() => setPressedControl(null)}
                onPointerCancel={() => setPressedControl(null)}
                onDoubleClick={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onControl(kind);
                }}
              >
                {image ? "" : glyph}
              </button>
            );
          })}
        </span>
      </header>
      {!shaded && children}
    </section>
  );
}
