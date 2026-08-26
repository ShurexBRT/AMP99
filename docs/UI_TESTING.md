# AMP99 UI testing

AMP99 uses two automated UI layers. Neither layer uses a real Spotify account or a client secret.

## Browser fallback smoke

Run the deterministic browser smoke suite locally with:

```bash
npm run test:ui
```

The suite starts the Vite browser fallback and verifies:

- Main, Playlist Editor and Equalizer controls render;
- Playlist can be hidden and shown again;
- elapsed/remaining time toggles from the Main display;
- Preferences opens from `LIST OPTS`;
- the manual GitHub release check reports a mocked newer version;
- browser mode explicitly does not download or install updates automatically.

The GitHub Releases response is mocked inside the test. Spotify is intentionally not connected.

## Windows native smoke

`.github/workflows/windows-tauri.yml` continues to own the packaged desktop checks. Its MSI smoke launch sets `AMP99_SMOKE_ALWAYS_ON_TOP=1` and probes the Win32 extended window style on Main, Equalizer and Playlist. This opt-in flag exists only for CI and is not a persisted user preference.

The native workflow also keeps the existing checks for three independent windows, minimize/restore, `.wsz` handoff, association and MSI uninstall. Spotify playback and OAuth remain owner/manual QA because CI must not contain personal credentials.
