# AMP99 V1 Release QA Checklist

This checklist separates **automated evidence**, **manual Windows QA**, **Store certification work**, and the intentionally separate **Spotify release gates**.

Do not call V1 release-ready while a required gate is unknown.

## 1. Automated CI gates

Every release candidate must pass the repository workflows for the exact candidate commit.

### Frontend

- [ ] TypeScript compilation passes.
- [ ] Vite production build passes.

### Native Windows bundle

- [ ] Tauri release executable builds.
- [ ] MSI builds.
- [ ] NSIS setup EXE builds.
- [ ] Raw `amp99.exe` starts and remains alive for the smoke observation window.
- [ ] MSI installs silently into an isolated test directory.
- [ ] MSI-installed `amp99.exe` starts and remains alive.
- [ ] `.wsz` association is registered by MSI.
- [ ] Secondary launch with a `.wsz` path hands off to the existing primary instance.
- [ ] Primary instance remains alive during single-instance handoff.
- [ ] MSI uninstall succeeds.

### Microsoft Store MSIX structural preflight

- [ ] Store icon assets regenerate from `src-tauri/app-icon.svg`.
- [ ] Release executable builds.
- [ ] `scripts/build-store-msix.ps1` finds Windows SDK `MakeAppx.exe`.
- [ ] Unsigned development-identity MSIX packs successfully.
- [ ] MSIX unpacks successfully into a clean verification directory.
- [ ] Unpacked manifest identity matches requested CI identity.
- [ ] Unpacked package contains `amp99.exe`.
- [ ] Unpacked manifest contains `.wsz` file association.
- [ ] MSIX artifact uploads in CI.

The CI MSIX is a structural preflight only. It is not a substitute for final Partner Center identity/certification.

## 2. Manual classic-player QA

### Main Player

- [ ] Play, pause, stop, previous and next controls respond correctly.
- [ ] Seek control remains usable in 1x and 2x modes.
- [ ] Volume control remains usable in 1x and 2x modes.
- [ ] Shuffle/repeat indicators reflect state.
- [ ] EQ and Playlist visibility controls remain synchronized with window visibility.
- [ ] Active/inactive titlebar state changes when focus moves between classic windows.
- [ ] Double-click titlebar toggles shade mode.

### Updates

- [ ] An installed older build checks for updates at startup without downloading an artifact.
- [ ] A newer signed release shows the update notification.
- [ ] Dismissing the notification does not download or install the update.
- [ ] Choosing to review the update exposes the explicit `INSTALL UPDATE` action.

### Equalizer

- [ ] Default AMP99 EQ remains usable.
- [ ] Compatible legacy `EQMAIN` artwork renders without stretched interpolation.
- [ ] ON/AUTO controls show selected states.
- [ ] All 11 classic EQ sliders remain movable.
- [ ] Missing optional EQ skin assets fall back safely.
- [ ] Shade/unshade does not corrupt the window layout.

### Playlist Editor

- [ ] Default AMP99 Playlist Editor remains usable.
- [ ] Compatible legacy `PLEDIT.BMP` chrome composes cleanly.
- [ ] `PLEDIT.TXT` text/background colors are applied when valid.
- [ ] Invalid/missing `PLEDIT.TXT` falls back to safe default colors.
- [ ] Track selection remains readable for dark and light legacy skins.
- [ ] Popup menus remain clickable above legacy chrome.
- [ ] Shade/unshade preserves the queue and current selection.

## 3. Windowing, DPI and multi-monitor QA

Test at minimum:

- [ ] Windows scaling 100%.
- [ ] Windows scaling 125%.
- [ ] Windows scaling 150%.
- [ ] Windows scaling 200%.
- [ ] Two monitors with matching scale.
- [ ] Two monitors with different scale factors, if hardware is available.

For each relevant setup:

- [ ] Main/EQ/Playlist can be dragged independently.
- [ ] Windows snap edge-to-edge within the classic snap threshold.
- [ ] Snapping works in both 1x and 2x modes.
- [ ] Child windows remain inside the usable host viewport after resize/DPI changes.
- [ ] Persisted positions do not leave a classic child window permanently unreachable.
- [ ] Pixel-art skin rendering remains crisp enough at supported scales.

## 4. Tray / Always on Top / media controls

- [ ] AMP99 tray icon is present while the app runs.
- [ ] Left-click tray icon restores/focuses AMP99.
- [ ] `Show AMP99` restores/focuses AMP99.
- [ ] `Toggle Always on Top` toggles native topmost behavior.
- [ ] `Quit AMP99` terminates the application cleanly.
- [ ] Hardware Play/Pause key routes to AMP99 when the key is available.
- [ ] Hardware Stop key routes to AMP99 when available.
- [ ] Hardware Previous/Next keys route to AMP99 when available.
- [ ] AMP99 still starts normally when another application owns a global media key.
- [ ] Windows media surface/Media Session metadata is checked on the target WebView2 runtime.

Native hardware shortcuts are best-effort. Failure to register a contested global media key must never become an AMP99 startup failure.

## 5. `.wsz` file-association QA

Test with AMP99 closed and already running.

- [ ] Double-click a valid `.wsz` with AMP99 closed: app starts and applies the skin.
- [ ] Double-click a valid `.wsz` with AMP99 running: existing instance receives it; no second long-lived player instance remains.
- [ ] `.WSZ` uppercase extension is accepted.
- [ ] Invalid ZIP archive is rejected without crashing AMP99.
- [ ] Valid ZIP missing required `MAIN` sheet is rejected/falls back safely.
- [ ] Skin with missing optional assets remains usable.
- [ ] Nested/case-varied legacy filenames resolve correctly.
- [ ] Archive path traversal attempt is rejected.
- [ ] Oversized native-associated skin file (>16 MiB) is rejected before JS archive processing.
- [ ] Repeated skin switching does not progressively break controls/layout.

Do not bundle third-party `.wsz` files merely to make Store screenshots or tests easier. QA fixtures must have clear licensing/provenance.

## 6. Privacy and data-handling QA

- [ ] `PRIVACY.md` accurately matches the release candidate's behavior.
- [ ] No analytics/telemetry claim is made unless corresponding code exists and is disclosed.
- [ ] No credentials, OAuth codes, tokens or test-user data are committed to Git.
- [ ] Local preference storage is documented.
- [ ] User-supplied `.wsz` files remain local to AMP99 processing.
- [ ] Disconnect behavior clears the Spotify session state currently owned by AMP99.
- [ ] Review the packaged Windows DPAPI Spotify token persistence against the final security threat model.

## 7. Microsoft Store manual gates

- [ ] AMP99 product name is reserved in Partner Center.
- [ ] Final Store `Identity Name` copied exactly from Partner Center.
- [ ] Final Store `Publisher` copied exactly from Partner Center.
- [ ] Final publisher display name confirmed.
- [ ] Final MSIX built with those exact values, not `AMP99.Dev`.
- [ ] Final version is a valid four-component MSIX version.
- [ ] Current Windows App Certification Kit / applicable Store tests pass.
- [ ] Package installs/launches on a clean Windows test account/machine.
- [ ] `.wsz` association works from the final packaged build.
- [ ] App icon and Start/Search presentation look correct.
- [ ] Store category is correct.
- [ ] Price is set to Free.
- [ ] Privacy URL resolves publicly.
- [ ] Support URL/contact is valid.
- [ ] Store screenshots are captured from a real approved release build.
- [ ] Screenshots do not contain unlicensed third-party skin artwork.
- [ ] Store copy does not claim a feature that failed release validation.

## 8. Spotify release gates — intentionally separate

The user explicitly excluded new Spotify implementation from the current non-Spotify V1 completion pass. These gates therefore remain visible and unresolved rather than being guessed away.

Before a public Spotify-powered release:

- [ ] Native installed-app OAuth flow is proven end-to-end.
- [ ] Real Spotify Premium playback works in packaged Windows WebView2/EME.
- [ ] Playlist/library behavior is smoke-tested against the release API behavior.
- [ ] Current Spotify developer quota/public-distribution requirements are satisfied.
- [ ] Current Spotify branding/platform policy requirements are satisfied.
- [ ] Spotify-specific Store description claims are finalized only after those gates pass.
- [ ] Token/session persistence receives the final security review for the packaged application.

## 9. Exit criteria

A non-Spotify AMP99 V1 platform/build candidate can be considered complete when Sections 1–7 pass, with Section 8 explicitly tracked as the separate connected-service release blocker.

A public Spotify-powered Microsoft Store release cannot be called ready until Section 8 also passes.
