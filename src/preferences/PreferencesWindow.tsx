import { useEffect, useRef, useState } from "react";
import { useSkinManager } from "../skins/useSkinManager";
import { checkForAmp99Update } from "../updates/githubUpdates";
import { openOfficialAmp99Release } from "../updates/nativeUpdateLinks";
import {
  checkForNativeAmp99Update,
  getLastNativeAmp99Update,
  installNativeAmp99Update,
  subscribeNativeAmp99Updates,
} from "../updates/nativeUpdater";
import { isTauri } from "@tauri-apps/api/core";
import type { Update } from "@tauri-apps/plugin-updater";
import { forgetNativeWindowPositions } from "../windowing/nativeWindowHost";
import {
  hidePreferencesWindow,
  startPreferencesWindowDrag,
  startPreferencesWindowResize,
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
type PreferenceSection =
  | "GENERAL"
  | "PLAYBACK"
  | "SPOTIFY"
  | "APPEARANCE"
  | "HOTKEYS"
  | "UPDATES"
  | "ABOUT";

const PREFERENCE_SECTIONS: Array<{ id: PreferenceSection; label: string; hint: string }> = [
  { id: "GENERAL", label: "General", hint: "Window behavior" },
  { id: "PLAYBACK", label: "Playback", hint: "Startup and queue" },
  { id: "SPOTIFY", label: "Spotify", hint: "Library connection" },
  { id: "APPEARANCE", label: "Appearance", hint: "Skins and display" },
  { id: "HOTKEYS", label: "Hotkeys", hint: "Keyboard shortcuts" },
  { id: "UPDATES", label: "Updates", hint: "Release channel" },
  { id: "ABOUT", label: "About", hint: "AMP99 alpha.20" },
];

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
    key: "closeToTray",
    label: "Keep running in tray when closed",
    hint: "Keep AMP99 running in the system tray when the Main window is closed.",
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
  const [section, setSection] = useState<PreferenceSection>("GENERAL");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [nativeUpdate, setNativeUpdate] = useState<Update | null>(() =>
    getLastNativeAmp99Update(),
  );

  useEffect(() => {
    const unsubscribe = subscribeNativeAmp99Updates(setNativeUpdate);
    if (isTauri()) {
      void checkForNativeAmp99Update().catch(() => undefined);
    }
    return unsubscribe;
  }, []);

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
    setNativeUpdate(null);
    setStatus("CHECKING FOR UPDATES...");
    try {
      if (isTauri()) {
        const update = await checkForNativeAmp99Update();
        setNativeUpdate(update);
        setLatestVersion(update?.version ?? null);
        setStatus(update ? `UPDATE AVAILABLE: ${update.version.toUpperCase()}` : "AMP99 IS UP TO DATE");
        return;
      }

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

  const installUpdate = async () => {
    if (!nativeUpdate) return;
    setCheckingUpdate(true);
    setStatus(`DOWNLOADING AMP99 ${nativeUpdate.version.toUpperCase()}...`);
    try {
      await installNativeAmp99Update(nativeUpdate, (downloaded, contentLength) => {
        if (contentLength) {
          setStatus(
            `DOWNLOADING ${Math.round((downloaded / contentLength) * 100)}%...`,
          );
        }
      });
    } catch (error) {
      if (isTauri()) {
        try {
          const fallback = await checkForAmp99Update(version);
          if (fallback.status === "update-available") {
            setReleaseUrl(fallback.latest.releaseUrl);
            setLatestVersion(fallback.latest.version);
            setStatus("SIGNED UPDATE UNAVAILABLE — OPEN THE OFFICIAL RELEASE PAGE");
            return;
          }
        } catch {
          // Preserve the primary updater error below when the manual fallback is unavailable.
        }
      }
      setStatus(
        error instanceof Error ? error.message.toUpperCase() : "UPDATE INSTALL FAILED",
      );
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

  const sectionMeta = PREFERENCE_SECTIONS.find((item) => item.id === section) ?? PREFERENCE_SECTIONS[0];

  const renderSection = () => {
    if (section === "GENERAL") {
      return (
        <fieldset className="preferences-group">
          <legend>WINDOW BEHAVIOR</legend>
          {CHECKBOXES.filter((setting) => setting.section === "GENERAL").map((setting) => (
            <PreferenceCheck
              key={setting.key}
              setting={setting}
              checked={preferences[setting.key]}
              onChange={(value) => changePreference(setting.key, value)}
            />
          ))}
        </fieldset>
      );
    }

    if (section === "PLAYBACK") {
      return (
        <fieldset className="preferences-group">
          <legend>STARTUP AND QUEUE</legend>
          {CHECKBOXES.filter((setting) => setting.section === "STARTUP").map((setting) => (
            <PreferenceCheck
              key={setting.key}
              setting={setting}
              checked={preferences[setting.key]}
              onChange={(value) => changePreference(setting.key, value)}
            />
          ))}
        </fieldset>
      );
    }

    if (section === "APPEARANCE") {
      return (
        <fieldset className="preferences-group preferences-skins">
          <legend>PLAYER SKIN</legend>
          <div className="preferences-skin-card">
            <div>
              <strong>{skin.activeSkin}</strong>
              <small>User-supplied classic .wsz skins only.</small>
            </div>
            <span className="preferences-chip">{skin.loading ? "LOADING" : "ACTIVE"}</span>
          </div>
          <div className="preferences-skin-row">
            <button type="button" disabled={skin.loading} onClick={() => fileInput.current?.click()}>
              {skin.loading ? "LOADING..." : "LOAD SKIN..."}
            </button>
            <button type="button" onClick={() => { skin.resetSkin(); setStatus("AMP99 DEFAULT SKIN RESTORED"); }}>
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
          <small>AMP99 does not bundle legacy skins. A selected skin applies to the player windows only.</small>
        </fieldset>
      );
    }

    if (section === "SPOTIFY") {
      return (
        <div className="preferences-info-card">
          <span className="preferences-info-kicker">OFFICIAL INTEGRATION</span>
          <h2>Spotify library and playback</h2>
          <p>Connect, browse playlists, load Liked Songs and manage playlist edits from the classic Playlist Editor.</p>
          <p className="preferences-muted">Use LIST OPTS → Connect Spotify... to start an Authorization Code with PKCE session.</p>
        </div>
      );
    }

    if (section === "HOTKEYS") {
      return (
        <div className="preferences-empty-state">
          <span className="preferences-empty-icon">⌘</span>
          <h2>Custom hotkeys are not configurable yet</h2>
          <p>This alpha keeps keyboard control intentionally small while the native player workflow is finalized.</p>
        </div>
      );
    }

    if (section === "UPDATES") {
      return (
        <fieldset className="preferences-group preferences-updates">
          <legend>RELEASE CHANNEL</legend>
          <div className="preferences-skin-row">
            <button type="button" disabled={checkingUpdate} onClick={() => void checkForUpdates()}>
              {checkingUpdate ? "CHECKING..." : "CHECK FOR UPDATES"}
            </button>
            {releaseUrl ? <button type="button" onClick={() => void openRelease()}>OPEN RELEASE PAGE</button> : null}
            {nativeUpdate ? <button type="button" onClick={() => void installUpdate()} disabled={checkingUpdate}>INSTALL UPDATE</button> : null}
          </div>
          <small>
            {latestVersion ? `Latest published AMP99 release: ${latestVersion}. ` : "Checks official AMP99 GitHub Releases. "}
            {isTauri() ? "Updates are signed and downloaded only after you confirm installation." : "Updates are never downloaded or installed automatically in browser mode."}
          </small>
        </fieldset>
      );
    }

    return (
      <div className="preferences-about-card">
        <span className="preferences-info-kicker">ABOUT THIS BUILD</span>
        <strong>AMP99 {version}</strong>
        <p>Play it like it&apos;s 1999.</p>
        <small>Closed alpha · Windows desktop build</small>
      </div>
    );
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
          <nav className="preferences-nav" aria-label="Preference sections">
            <span className="preferences-nav-label">SETTINGS</span>
            <div className="preferences-nav-list">
              {PREFERENCE_SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === section ? "selected" : ""}
                  onClick={() => setSection(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            <div className="preferences-nav-footer">
              <strong>AMP99</strong>
              <span>AMP99 {version}</span>
              <span>PLAY IT LIKE IT&apos;S 1999</span>
            </div>
          </nav>
          <section className="preferences-pane" aria-live="polite">
            <div className="preferences-pane-heading">
              <span className="preferences-info-kicker">AMP99 CONTROL PANEL</span>
              <h1>{sectionMeta.label}</h1>
              <p>{sectionMeta.hint}</p>
            </div>
            <div className="preferences-pane-scroll">{renderSection()}</div>
          </section>
          <footer className="preferences-footer">
            <span>{status}</span>
            {section !== "UPDATES" ? (
              <button type="button" disabled={checkingUpdate} onClick={() => void checkForUpdates()}>
                {checkingUpdate ? "CHECKING..." : "CHECK FOR UPDATES"}
              </button>
            ) : null}
            {section !== "UPDATES" && releaseUrl ? (
              <>
                <button type="button" onClick={() => void openRelease()}>OPEN RELEASE PAGE</button>
                <span className="preferences-update-note">{isTauri()
                  ? "Updates are signed and downloaded only after you confirm installation."
                  : "Updates are never downloaded or installed automatically in browser mode."}</span>
              </>
            ) : null}
            <button type="button" onClick={resetAll}>RESET SETTINGS</button>
          </footer>
          <button
            type="button"
            className="preferences-resize-handle"
            aria-label="Resize Preferences"
            title="Drag to resize Preferences"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void startPreferencesWindowResize();
            }}
          />
        </div>
      </section>
    </main>
  );
}
