import { useRef, useState } from "react";
import { useSkinManager } from "../skins/useSkinManager";
import { checkForAmp99Update } from "../updates/githubUpdates";
import { openOfficialAmp99Release } from "../updates/nativeUpdateLinks";
import { forgetNativeWindowPositions } from "../windowing/nativeWindowHost";
import {
  hidePreferencesWindow,
  startPreferencesWindowDrag,
  useAmp99Version,
} from "./nativePreferences";
import {
  resetPreferences,
  setPreference,
  usePreferences,
  type Amp99Preferences,
} from "./preferencesStore";
import "./preferences.css";

type PreferenceKey = keyof Amp99Preferences;

const CHECKBOXES: Array<{
  key: PreferenceKey;
  label: string;
  hint: string;
  section: "GENERAL" | "STARTUP";
}> = [
  {
    key: "alwaysOnTop",
    label: "Always on top",
    hint: "Keep the AMP99 player window group above normal windows.",
    section: "GENERAL",
  },
  {
    key: "rememberWindowPositions",
    label: "Remember window positions",
    hint: "Restore Main, EQ and Playlist positions after restart.",
    section: "GENERAL",
  },
  {
    key: "startMinimized",
    label: "Start minimized to tray",
    hint: "Launch AMP99 quietly and restore it from the tray icon.",
    section: "STARTUP",
  },
  {
    key: "restoreEqualizerOnStartup",
    label: "Restore Equalizer on startup",
    hint: "Show EQ when AMP99 starts if it was enabled for startup.",
    section: "STARTUP",
  },
  {
    key: "restorePlaylistOnStartup",
    label: "Restore Playlist on startup",
    hint: "Show Playlist Editor when AMP99 starts if it was enabled for startup.",
    section: "STARTUP",
  },
  {
    key: "resumeLastQueue",
    label: "Remember last queue",
    hint: "Restore the last queue and selected row, but never autoplay it.",
    section: "STARTUP",
  },
];

function PreferenceCheck({
  setting,
  checked,
  onChange,
}: {
  setting: (typeof CHECKBOXES)[number];
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="preferences-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="preferences-check-copy">
        <strong>{setting.label}</strong>
        <small>{setting.hint}</small>
      </span>
    </label>
  );
}

export function PreferencesWindow() {
  const preferences = usePreferences();
  const skin = useSkinManager();
  const version = useAmp99Version();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("READY");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const changePreference = (key: PreferenceKey, value: boolean) => {
    setPreference(key, value);
    if (key === "rememberWindowPositions" && !value) {
      forgetNativeWindowPositions();
      setStatus("SAVED WINDOW POSITIONS CLEARED");
      return;
    }
    setStatus("PREFERENCE SAVED");
  };

  const loadSkin = async (file?: File) => {
    if (!file) return;
    setStatus("LOADING SKIN...");
    try {
      const result = await skin.loadSkin(file);
      setStatus(`SKIN LOADED: ${result.name.toUpperCase()}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message.toUpperCase() : "SKIN LOAD FAILED",
      );
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    setReleaseUrl(null);
    setLatestVersion(null);
    setStatus("CHECKING FOR UPDATES...");
    try {
      const result = await checkForAmp99Update(version);
      if (result.status === "update-available") {
        setReleaseUrl(result.latest.releaseUrl);
        setLatestVersion(result.latest.version);
        setStatus(`UPDATE AVAILABLE: ${result.latest.version.toUpperCase()}`);
      } else {
        setLatestVersion(result.latest?.version ?? null);
        setStatus("AMP99 IS UP TO DATE");
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message.toUpperCase() : "UPDATE CHECK FAILED",
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const openRelease = async () => {
    if (!releaseUrl) return;
    try {
      await openOfficialAmp99Release(releaseUrl);
      setStatus("OPENED OFFICIAL AMP99 RELEASE PAGE");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message.toUpperCase() : "COULD NOT OPEN RELEASE PAGE",
      );
    }
  };

  const resetAll = () => {
    resetPreferences();
    forgetNativeWindowPositions();
    setStatus("PREFERENCES RESET");
  };

  return (
    <main className="preferences-root">
      <section className="preferences-window" aria-label="AMP99 Preferences">
        <header
          className="preferences-titlebar"
          onDoubleClick={() => undefined}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            void startPreferencesWindowDrag();
          }}
        >
          <span>AMP99 PREFERENCES</span>
          <button
            type="button"
            aria-label="Close Preferences"
            title="Close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void hidePreferencesWindow()}
          >
            ×
          </button>
        </header>

        <div className="preferences-content">
          {(["GENERAL", "STARTUP"] as const).map((section) => (
            <fieldset key={section} className="preferences-group">
              <legend>{section}</legend>
              {CHECKBOXES.filter((setting) => setting.section === section).map(
                (setting) => (
                  <PreferenceCheck
                    key={setting.key}
                    setting={setting}
                    checked={preferences[setting.key]}
                    onChange={(value) => changePreference(setting.key, value)}
                  />
                ),
              )}
            </fieldset>
          ))}

          <fieldset className="preferences-group preferences-skins">
            <legend>SKINS</legend>
            <div className="preferences-skin-row">
              <button
                type="button"
                disabled={skin.loading}
                onClick={() => fileInput.current?.click()}
              >
                {skin.loading ? "LOADING..." : "LOAD SKIN..."}
              </button>
              <button
                type="button"
                onClick={() => {
                  skin.resetSkin();
                  setStatus("AMP99 DEFAULT SKIN RESTORED");
                }}
              >
                USE DEFAULT
              </button>
              <input
                ref={fileInput}
                className="preferences-hidden-file"
                type="file"
                accept=".wsz,.zip"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void loadSkin(file);
                }}
              />
            </div>
            <small>User-supplied classic .wsz skins only. AMP99 does not bundle legacy skins.</small>
          </fieldset>

          <fieldset className="preferences-group preferences-updates">
            <legend>UPDATES</legend>
            <div className="preferences-skin-row">
              <button type="button" disabled={checkingUpdate} onClick={() => void checkForUpdates()}>
                {checkingUpdate ? "CHECKING..." : "CHECK FOR UPDATES"}
              </button>
              {releaseUrl ? (
                <button type="button" onClick={() => void openRelease()}>
                  OPEN RELEASE PAGE
                </button>
              ) : null}
            </div>
            <small>
              {latestVersion
                ? `Latest published AMP99 release: ${latestVersion}. `
                : "Checks official AMP99 GitHub Releases. "}
              Updates are never downloaded or installed automatically.
            </small>
          </fieldset>

          <fieldset className="preferences-group preferences-about">
            <legend>ABOUT</legend>
            <div><strong>AMP99 {version}</strong></div>
            <div>Play it like it&apos;s 1999.</div>
            <small>Closed alpha · Windows desktop build</small>
          </fieldset>

          <div className="preferences-footer">
            <span>{status}</span>
            <button type="button" onClick={resetAll}>RESET SETTINGS</button>
          </div>
        </div>
      </section>
    </main>
  );
}
