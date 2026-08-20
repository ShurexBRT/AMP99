import fs from "node:fs";

function replaceExactly(path, from, to) {
  const source = fs.readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one patch target, found ${count}`);
  }
  fs.writeFileSync(path, source.replace(from, to));
}

// Native window host: Preferences utility role + startup/window-position preferences.
replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  'import type { Amp99NativeWindowRole } from "./bridge";\n',
  'import { getPreferencesSnapshot } from "../preferences/preferencesStore";\nimport type { Amp99NativeWindowRole } from "./bridge";\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  'export function currentNativeWindowRole(): Amp99NativeWindowRole | "browser" {\n  if (!isTauri()) return "browser";\n  const label = getCurrentWebviewWindow().label;\n  return isAmp99NativeWindowRole(label) ? label : "browser";\n}\n',
  'export function currentNativeWindowRole(): Amp99NativeWindowRole | "preferences" | "browser" {\n  if (!isTauri()) return "browser";\n  const label = getCurrentWebviewWindow().label;\n  if (isAmp99NativeWindowRole(label)) return label;\n  return label === "preferences" ? "preferences" : "browser";\n}\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  'function savePosition(role: Amp99NativeWindowRole, position: PhysicalPosition): void {\n  try {\n',
  'function savePosition(role: Amp99NativeWindowRole, position: PhysicalPosition): void {\n  if (!getPreferencesSnapshot().rememberWindowPositions) return;\n  try {\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  'function readSavedSizes(): SavedSizes {\n',
  'export function forgetNativeWindowPositions(): void {\n  try {\n    localStorage.removeItem(POSITION_STORAGE_KEY);\n    localStorage.removeItem("amp99.windowPositions.v1");\n  } catch {\n    // Forgetting positions is best-effort and never blocks the player.\n  }\n}\n\nfunction readSavedSizes(): SavedSizes {\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  'async function restoreAuxVisibility(): Promise<void> {\n  if (!isTauri()) return;\n  const saved = readAuxVisibility();\n  for (const role of ["equalizer", "playlist"] as const) {\n    const target = await WebviewWindow.getByLabel(role);\n    if (!target) continue;\n    if (saved[role]) await target.show();\n    else await target.hide();\n  }\n}\n',
  'async function restoreAuxVisibility(startup = false): Promise<void> {\n  if (!isTauri()) return;\n  const saved = readAuxVisibility();\n  const preferences = getPreferencesSnapshot();\n  for (const role of ["equalizer", "playlist"] as const) {\n    const target = await WebviewWindow.getByLabel(role);\n    if (!target) continue;\n    const startupEnabled =\n      role === "equalizer"\n        ? preferences.restoreEqualizerOnStartup\n        : preferences.restorePlaylistOnStartup;\n    const visible = startup ? startupEnabled && saved[role] : saved[role];\n    if (visible) await target.show();\n    else await target.hide();\n  }\n}\n\nasync function hidePlayerWindowGroup(): Promise<void> {\n  if (!isTauri()) return;\n  for (const role of ["main", "equalizer", "playlist"] as const) {\n    const target = await WebviewWindow.getByLabel(role);\n    if (target) await target.hide();\n  }\n}\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  '  const current = getCurrentWebviewWindow();\n  const saved = readSavedPositions()[role];\n  if (saved) {\n    await current.setPosition(new PhysicalPosition(saved.x, saved.y));\n  }\n',
  '  const current = getCurrentWebviewWindow();\n  const preferences = getPreferencesSnapshot();\n  const saved = preferences.rememberWindowPositions\n    ? readSavedPositions()[role]\n    : undefined;\n  if (saved) {\n    await current.setPosition(new PhysicalPosition(saved.x, saved.y));\n  }\n',
);

replaceExactly(
  "src/windowing/nativeWindowHost.ts",
  '  const onMainFocus = () => {\n    if (role === "main") void restoreAuxVisibility();\n  };\n  if (role === "main") {\n    window.addEventListener("focus", onMainFocus);\n    await restoreAuxVisibility();\n  }\n',
  '  const onMainFocus = () => {\n    if (role === "main") void restoreAuxVisibility(false);\n  };\n  if (role === "main") {\n    window.addEventListener("focus", onMainFocus);\n    await restoreAuxVisibility(true);\n    if (preferences.startMinimized) await hidePlayerWindowGroup();\n  }\n',
);

// App routing and live native preferences application.
replaceExactly(
  "src/App.tsx",
  'import { PlaylistEditor } from "./components/PlaylistEditor";\n',
  'import { PlaylistEditor } from "./components/PlaylistEditor";\nimport { PreferencesWindow } from "./preferences/PreferencesWindow";\nimport { useApplyNativePreferences } from "./preferences/nativePreferences";\n',
);

replaceExactly(
  "src/App.tsx",
  '  const amp = useAmp99State();\n  const skin = useSkinManager();\n  const spotify = useSpotifyLibrary();\n',
  '  const amp = useAmp99State();\n  const skin = useSkinManager();\n  const spotify = useSpotifyLibrary();\n  useApplyNativePreferences();\n',
);

replaceExactly(
  "src/App.tsx",
  '  if (role === "playlist") return <NativePlaylistWindow />;\n\n  return <MainController native={false} />;\n',
  '  if (role === "playlist") return <NativePlaylistWindow />;\n  if (role === "preferences") return <PreferencesWindow />;\n\n  return <MainController native={false} />;\n',
);

// Classic Playlist menu entry.
replaceExactly(
  "src/components/PlaylistEditor.tsx",
  'import { useRef, useState } from "react";\n',
  'import { useRef, useState } from "react";\nimport { showPreferencesWindow } from "../preferences/nativePreferences";\n',
);

replaceExactly(
  "src/components/PlaylistEditor.tsx",
  '              <button onClick={resetSkin}>Use AMP99 Default</button>\n              <span className="popup-separator" aria-hidden="true" />\n              <button onClick={clearQueue}>Clear Playlist</button>\n',
  '              <button onClick={resetSkin}>Use AMP99 Default</button>\n              <span className="popup-separator" aria-hidden="true" />\n              <button onClick={() => { setMenu(null); void showPreferencesWindow(); }}>Preferences...</button>\n              <span className="popup-separator" aria-hidden="true" />\n              <button onClick={clearQueue}>Clear Playlist</button>\n',
);

console.log("AMP99 Preferences integration patch applied.");
