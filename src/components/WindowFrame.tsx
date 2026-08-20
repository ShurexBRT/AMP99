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
import { requestMain } from "../windowing/bridge";
import {
  applyNativeShade,
  hideCurrentNativeWindow,
  isNativeHostFor,
  startNativeWindowDrag,
} from "../windowing/nativeWindowHost";

const WINDOW_FOCUS_EVENT = "amp99-window-focus";
const WINDOW_CLOSE_EVENT = "amp99-window-close";

type WindowStyle = CSSProperties & {
  "--playlist-normal"?: string;
  "--playlist-current"?: string;
  "--playlist-bg"?: string;
  "--playlist-selected-bg"?: string;
};

type PlaylistChromeStyle = Pick<
  CSSProperties,
  "backgroundImage" | "backgroundPosition" | "backgroundRepeat" | "backgroundSize"
>;

type ControlKind = "minimize" | "shade" | "close";

function buildPlaylistChromeStyle(
  sprite: (name: string) => string | null,
  active: boolean,
): PlaylistChromeStyle | null {
  const layers = [
    {
      image: sprite(
        active ? "playlist.topCenterActive" : "playlist.topCenterInactive",
      ),
      position: "center top",
      repeat: "no-repeat",
      size: "100px 20px",
    },
    {
      image: sprite(active ? "playlist.topLeftActive" : "playlist.topLeftInactive"),
      position: "left top",
      repeat: "no-repeat",
      size: "25px 20px",
    },
    {
      image: sprite(active ? "playlist.topRightActive" : "playlist.topRightInactive"),
      position: "right top",
      repeat: "no-repeat",
      size: "25px 20px",
    },
    {
      image: sprite("playlist.bottomLeft"),
      position: "left bottom",
      repeat: "no-repeat",
      size: "125px 38px",
    },
    {
      image: sprite("playlist.bottomRight"),
      position: "right bottom",
      repeat: "no-repeat",
      size: "150px 38px",
    },
    {
      image: sprite(
        active ? "playlist.topMiddleActive" : "playlist.topMiddleInactive",
      ),
      position: "left top",
      repeat: "repeat-x",
      size: "25px 20px",
    },
    {
      image: sprite("playlist.leftSide"),
      position: "left 0 top 20px",
      repeat: "repeat-y",
      size: "25px 29px",
    },
    {
      image: sprite("playlist.rightSide"),
      position: "right 0 top 20px",
      repeat: "repeat-y",
      size: "25px 29px",
    },
    {
      image: sprite("playlist.bottomMiddle"),
      position: "left bottom",
      repeat: "repeat-x",
      size: "25px 38px",
    },
  ];

  if (layers.some((layer) => !layer.image)) return null;

  return {
    backgroundImage: layers.map((layer) => `url(${layer.image})`).join(", "),
    backgroundPosition: layers.map((layer) => layer.position).join(", "),
    backgroundRepeat: layers.map((layer) => layer.repeat).join(", "),
    backgroundSize: layers.map((layer) => layer.size).join(", "),
  };
}

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
  const nativeHost = isNativeHostFor(resolvedWindowId);
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
    if (nativeHost) {
      const onFocus = () => setActive(true);
      const onBlur = () => setActive(false);
      setActive(document.hasFocus());
      window.addEventListener("focus", onFocus);
      window.addEventListener("blur", onBlur);
      return () => {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
      };
    }

    const listener = (event: Event) => {
      const focusedId = (event as CustomEvent<WindowId>).detail;
      setActive(focusedId === resolvedWindowId);
    };
    window.addEventListener(WINDOW_FOCUS_EVENT, listener);
    return () => window.removeEventListener(WINDOW_FOCUS_EVENT, listener);
  }, [nativeHost, resolvedWindowId]);

  const activate = () => {
    if (nativeHost) {
      setActive(true);
      return;
    }
    window.dispatchEvent(
      new CustomEvent<WindowId>(WINDOW_FOCUS_EVENT, { detail: resolvedWindowId }),
    );
  };

  const onTitlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    activate();
    if (nativeHost) {
      event.preventDefault();
      void startNativeWindowDrag(resolvedWindowId);
      return;
    }
    drag.onPointerDown(event);
  };

  const toggleShade = () => {
    if (!shadeable) return;
    setShaded((current) => {
      const next = !current;
      if (nativeHost) void applyNativeShade(resolvedWindowId, next);
      return next;
    });
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
  const playlistChrome =
    resolvedWindowId === "playlist" && !shaded
      ? buildPlaylistChromeStyle(sharedSprite, active)
      : null;
  const displayedBackground =
    shaded && activeShade ? activeShade : playlistChrome ? null : resolvedBackground;
  const displayedTitlebar =
    resolvedWindowId === "playlist" || (shaded && activeShade)
      ? null
      : activeTitlebar;
  const hasSkinBackground = Boolean(displayedBackground || playlistChrome);
  const colors = sharedSkin?.playlistColors;

  const style: WindowStyle = {
    left: nativeHost ? 0 : position.x,
    top: nativeHost ? 0 : position.y,
    width,
    height: renderedHeight,
    backgroundImage: displayedBackground ? `url(${displayedBackground})` : undefined,
    backgroundSize: shaded ? `${width}px 14px` : undefined,
    ...playlistChrome,
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
      toggleShade();
      return;
    }

    if (kind === "minimize" && resolvedWindowId === "main") {
      void minimizeHostWindow();
      return;
    }

    if (kind === "close") {
      if (resolvedWindowId === "main") {
        void hideHostWindowToTray();
      } else if (nativeHost) {
        void hideCurrentNativeWindow();
        void requestMain(
          resolvedWindowId,
          resolvedWindowId === "equalizer"
            ? "setEqualizerVisible"
            : "setPlaylistVisible",
          false,
        ).catch(() => undefined);
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
      className={`amp-window ${nativeHost ? "native-host-window" : ""} ${hasSkinBackground ? "legacy-skinned-window" : ""} ${shaded ? "amp-window-shaded" : ""} ${active ? "amp-window-active" : "amp-window-inactive"} ${className}`}
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
        onPointerMove={nativeHost ? undefined : drag.onPointerMove}
        onPointerUp={nativeHost ? undefined : drag.onPointerUp}
        onDoubleClick={toggleShade}
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
