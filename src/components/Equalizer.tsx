import { useState, type CSSProperties } from "react";
import { useCurrentSkin } from "../skins/useSkinManager";
import type { WindowPosition } from "../types/player";
import { WindowFrame } from "./WindowFrame";

const bands = ["PRE", "60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];
const legacySliderX = [22, 79, 97, 115, 133, 151, 169, 187, 205, 223, 241];

type Props = {
  position: WindowPosition;
  onMove: (position: WindowPosition) => void;
  skinSprites?: ReadonlyMap<string, string> | null;
};

type LegacyEqButtonProps = {
  className: string;
  label: string;
  normal?: string;
  pressed?: string;
  selected?: string;
  active?: boolean;
  onClick?: () => void;
};

type EqSliderStyle = CSSProperties & {
  "--eq-thumb"?: string;
};

function LegacyEqButton({
  className,
  label,
  normal,
  pressed,
  selected,
  active = false,
  onClick,
}: LegacyEqButtonProps) {
  const [down, setDown] = useState(false);
  const image = down && pressed ? pressed : active && selected ? selected : normal;
  return (
    <button
      className={`legacy-eq-button ${className}`}
      aria-label={label}
      title={label}
      style={{ backgroundImage: image ? `url(${image})` : undefined }}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={onClick}
    >
      {!image ? label : ""}
    </button>
  );
}

function LegacyEqualizer({
  position,
  onMove,
  sprites,
}: Omit<Props, "skinSprites"> & { sprites: ReadonlyMap<string, string> }) {
  const [enabled, setEnabled] = useState(true);
  const [auto, setAuto] = useState(false);
  const [values, setValues] = useState<number[]>(() =>
    bands.map((_, index) => (index % 3 === 0 ? 70 : index % 2 ? 48 : 58)),
  );
  const sprite = (name: string) => sprites.get(name);
  const sliderStyle = {
    "--eq-thumb": sprite("eq.sliderThumb")
      ? `url(${sprite("eq.sliderThumb")})`
      : undefined,
  } as EqSliderStyle;

  const change = (index: number, value: number) => {
    setValues((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  return (
    <WindowFrame
      windowId="equalizer"
      title="AMP99 EQUALIZER"
      position={position}
      width={275}
      height={116}
      onMove={onMove}
      className="equalizer-window legacy-equalizer"
      skinBackground={sprite("eq.windowBackground")}
      skinTitlebar={sprite("eq.titlebarActive")}
      inactiveSkinTitlebar={sprite("eq.titlebarInactive")}
      skinShadeBackground={sprite("eq.shadeActive")}
      inactiveSkinShadeBackground={sprite("eq.shadeInactive")}
    >
      <div className={`legacy-eq-body ${enabled ? "" : "legacy-eq-disabled"}`}>
        <LegacyEqButton
          className="legacy-eq-on"
          label="EQ on/off"
          normal={sprite("eq.on")}
          pressed={sprite("eq.onPressed")}
          selected={sprite("eq.onSelected")}
          active={enabled}
          onClick={() => setEnabled((value) => !value)}
        />
        <LegacyEqButton
          className="legacy-eq-auto"
          label="Auto"
          normal={sprite("eq.auto")}
          pressed={sprite("eq.autoPressed")}
          selected={sprite("eq.autoSelected")}
          active={auto}
          onClick={() => setAuto((value) => !value)}
        />
        <LegacyEqButton
          className="legacy-eq-presets"
          label="Presets"
          normal={sprite("eq.preset")}
          pressed={sprite("eq.presetPressed")}
        />

        {bands.map((band, index) => (
          <input
            key={band}
            className="legacy-eq-slider"
            style={{ ...sliderStyle, left: legacySliderX[index] }}
            type="range"
            min="0"
            max="100"
            value={values[index]}
            aria-label={`${band} equalizer band`}
            disabled={!enabled}
            onChange={(event) => change(index, Number(event.target.value))}
          />
        ))}
      </div>
    </WindowFrame>
  );
}

function DefaultEqualizer({ position, onMove }: Omit<Props, "skinSprites">) {
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState<number[]>(() =>
    bands.map((_, index) => (index % 3 === 0 ? 70 : index % 2 ? 48 : 58)),
  );

  const change = (index: number, value: number) => {
    setValues((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  return (
    <WindowFrame
      windowId="equalizer"
      title="AMP99 EQUALIZER"
      position={position}
      width={275}
      height={116}
      onMove={onMove}
      className="equalizer-window"
    >
      <div className="eq-toolbar">
        <button className={enabled ? "active" : ""} onClick={() => setEnabled((value) => !value)}>ON</button>
        <button>AUTO</button>
        <button>PRESETS</button>
      </div>
      <div className={`eq-bands ${enabled ? "" : "disabled"}`}>
        {bands.map((band, index) => (
          <label key={band}>
            <input type="range" min="0" max="100" value={values[index]} onChange={(event) => change(index, Number(event.target.value))} />
            <span>{band}</span>
          </label>
        ))}
      </div>
    </WindowFrame>
  );
}

export function Equalizer(props: Props) {
  const sharedSkin = useCurrentSkin();
  const sprites = props.skinSprites ?? sharedSkin?.sprites ?? null;

  if (sprites?.get("eq.windowBackground")) {
    return (
      <LegacyEqualizer
        position={props.position}
        onMove={props.onMove}
        sprites={sprites}
      />
    );
  }
  return <DefaultEqualizer position={props.position} onMove={props.onMove} />;
}
