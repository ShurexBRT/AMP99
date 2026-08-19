import { useState } from "react";
import type { WindowPosition } from "../types/player";
import { WindowFrame } from "./WindowFrame";

const bands = ["PRE", "60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];

export function Equalizer({ position, onMove }: { position: WindowPosition; onMove: (position: WindowPosition) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState(() => bands.map((_, index) => index % 3 === 0 ? 70 : index % 2 ? 48 : 58));

  const change = (index: number, value: number) => {
    setValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  return (
    <WindowFrame title="AMP99 EQUALIZER" position={position} width={275} height={116} onMove={onMove} className="equalizer-window">
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
