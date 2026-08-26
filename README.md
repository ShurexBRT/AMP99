# AMP99

> **Play it like it's 1999.**

AMP99 is a free Windows desktop music player that recreates the classic late-90s three-window player workflow with user-supplied Winamp-compatible `.wsz` skins and a Spotify-backed library/playback layer.

The product is **not** a modern music dashboard wearing a retro theme. The packaged Windows app is deliberately built as three small, independent desktop windows that behave like the classic player did.

> **AI contributors:** read [`AGENTS.md`](./AGENTS.md) before changing code. Task claiming, branch ownership and subsystem boundaries are mandatory.

## Current release track

- App version: **0.2.0-alpha.15**
- Phase: **closed alpha / physical QA**
- MSIX numeric package version: **0.2.0.15**
- Installer release: [`v0.2.0-alpha.15`](https://github.com/ShurexBRT/AMP99/releases/tag/v0.2.0-alpha.15)
- Version consistency is checked by `npm run version:check` and is part of the normal production build.

Planned progression:

```text
0.2.x-alpha  -> bug fixing and owner QA
0.3.x-beta   -> small external tester group
0.9.x-rc     -> Store release candidate
1.0.0        -> public release
```

Prerelease builds must use a numeric suffix such as `alpha.1`, because AMP99 maps that final numeric identifier to the fourth numeric MSIX revision component.

## Brand

- Product: **AMP99**
- Tagline: **Play it like it's 1999.**
- App icon: original gunmetal hi-fi faceplate with phosphor-green `A99` LCD monogram and play indicator
- App-icon source: `src-tauri/app-icon.svg`

AMP99 is independent and does not bundle Winamp/Nullsoft/Spotify proprietary logos or third-party legacy skins.

## The desktop architecture — do not regress this

The packaged Tauri build uses **three real native Windows windows**:

```text
AMP99 process
├── main        330 × 116   Main Player (default skin; user-resizable)
├── equalizer   275 × 116   Equalizer
└── playlist    275 × 232   Playlist Editor
```

The default Main Player can be resized between 330×116 and 660×320. Its dimensions are remembered between launches; user-supplied legacy `.wsz` Main skins retain their classic 275×116 geometry.

These are not React panels drawn inside one large host canvas.

The large shared-window layout may remain only as a browser-development fallback. It is **not the product architecture** and must never replace the native Windows layout.

### Ownership model

- **Main Player window** owns shared application state and is the only webview that initializes Spotify session/playback logic.
- **Equalizer** and **Playlist Editor** are presentation/control webviews.
- `src/windowing/` provides the typed state/command bridge between the three webviews.
- A Spotify playback SDK must never be independently initialized inside EQ or Playlist.
- `.wsz` skin changes synchronize across all three windows.

### Native window behavior

- each auxiliary window can move independently as an OS window;
- real native window dragging is used instead of moving a fake `<div>`;
- edge snapping/docking is calculated from native outer window positions/sizes;
- dragging Main moves the complete currently-connected docked window group, including transitive Main -> EQ -> Playlist chains;
- pulling EQ or Playlist away immediately returns that auxiliary window to independent movement;
- physical window positions persist;
- EQ and Playlist can be independently shown/hidden;
- Main `EQ` / `PL` buttons control the real auxiliary windows;
- shade mode resizes the actual native window;
- 1× / 2× changes native window dimensions;
- closing Main quits AMP99 by default; an optional preference keeps the window group in the system tray;
- minimizing Main also minimizes the currently docked EQ/Playlist group;
- EQ / Playlist close independently;
- tray restores Main and previously-visible auxiliary windows;
- Always on Top applies to the player window group.

Windows CI explicitly enumerates Win32 top-level windows for the AMP99 process and fails unless Main, Equalizer and Playlist Editor all exist as separate windows.

## Current status

| Area | Status | Notes |
|---|---|---|
| Three native Tauri windows | **Implemented / CI-gated / physically tested** | Main, EQ and Playlist are separate OS windows |
| Native dragging / snapping | **Implemented / physically tested** | Independent aux movement + Main-root dock group movement |
| Position persistence | **Implemented** | Native window positions are remembered |
| Playlist resize | **Implemented / physically tested** | Mouse resize with persisted dimensions |
| Main resize | **Implemented / CI-gated** | Default Main resize grip with persisted dimensions; legacy `.wsz` Main geometry remains fixed |
| Shade / active states | **Implemented foundation** | Native resize + classic skin states |
| 1× / 2× | **Implemented foundation** | Native dimensions + pixel scaling |
| `.wsz` loading | **Implemented / hardened / physically tested** | Validation, limits, path-traversal protection |
| `.wsz` Main rendering | **Implemented / physically tested** | Classic Main sheets and control states |
| `.wsz` EQ rendering | **Implemented foundation** | `EQMAIN` / `EQ_EX` geometry |
| `.wsz` Playlist rendering | **Implemented foundation** | `PLEDIT` chrome + `PLEDIT.TXT` colors |
| Cross-window skin sync | **Implemented** | Same skin is applied across native webviews |
| `.wsz` file association | **Implemented / CI-tested** | Double-click handoff to running AMP99 |
| System tray | **Implemented** | Show, Always on Top, Quit, optional close-to-tray behavior |
| Hardware media keys | **Implemented best-effort** | Conflicts never block startup |
| Media Session bridge | **Implemented best-effort** | Used where WebView2 exposes it |
| Realtime playback clock | **Implemented / physically tested** | Interpolated while playing |
| Realtime volume | **Implemented / physically tested** | Applies during drag, not on release |
| Queue auto-next | **Implemented / physically tested** | AMP99 advances at track end |
| MSI / NSIS | **Implemented / smoke-tested** | Build, install, launch, handoff, uninstall |
| Preferences | **Implemented** | Separate native utility window with persisted player/window settings |
| Alpha update/release channel | **Implemented / signing setup required** | Startup check shows a user-confirmed update notification; signed Tauri updater plus official GitHub release-page fallback; see `docs/UPDATER_SIGNING.md` |
| Store MSIX preflight | **Implemented** | MakeAppx pack/unpack structural verification |
| Privacy / release docs | **Implemented** | `PRIVACY.md`, `docs/` |
| Spotify library/playlists | **Implemented / physically tested** | Browse, Liked Songs, search, create/edit |
| Spotify Web Playback SDK | **Implemented / physically tested on Windows** | Packaged WebView2 playback works in owner QA |
| Installed-app Spotify OAuth | **Implemented / physically tested** | Native loopback PKCE login works in packaged build |

## Classic player features

AMP99 currently includes:

- Main Player;
- Equalizer;
- Playlist Editor;
- play / pause / stop / previous / next;
- realtime elapsed-time display;
- click the time display to toggle elapsed and remaining time;
- seek;
- realtime volume;
- balance UI;
- shuffle / repeat;
- queue auto-advance;
- classic Playlist Editor menus;
- resizable Playlist Editor;
- shade mode;
- active/inactive titlebars;
- native snapping/docking;
- Main-root movement for connected docked window groups;
- 1× / 2× scaling foundation;
- tray + Always on Top;
- hardware media-key bridge;
- Windows `.wsz` association.

The Equalizer is intentionally visual-only for Spotify playback. AMP99 does not DSP or alter Spotify audio.

The spectrum/VU-style display is a deterministic playback-reactive visualization. Spotify Web Playback SDK does not expose raw PCM/FFT data, so AMP99 intentionally does not use undocumented audio-interception hacks.

## Legacy `.wsz` skins

Legacy skin support is first-class.

Current infrastructure includes:

- `.wsz` / ZIP parsing with JSZip;
- case-insensitive asset lookup;
- nested-path compatibility;
- ZIP traversal protection;
- archive/file extraction limits;
- classic sprite extraction/rendering;
- Main Player sheets and pressed/selected states;
- EQ sheets;
- Playlist Editor chrome;
- `PLEDIT.TXT` colors;
- graceful fallback for optional assets;
- synchronization of a user-selected skin across Main/EQ/Playlist;
- Windows file association and single-instance handoff.

AMP99 does **not** ship third-party `.wsz` skins. Users supply their own files.

## Spotify status

Spotify implementation remains isolated under `src/spotify/` and uses official developer APIs/SDKs only.

Already implemented and physically exercised in the packaged Windows app:

- Authorization Code with PKCE for browser development;
- native packaged-app PKCE flow using the system browser and `127.0.0.1` loopback callback;
- token refresh/session persistence;
- profile, playlists and Liked Songs;
- playlist track loading and search;
- create/add/remove/reorder playlist operations;
- official Web Playback SDK / Spotify Connect device path;
- AMP99 playback controls mapped to Spotify;
- realtime playback clock/volume and queue auto-next;
- API restriction/error handling.

The packaged desktop flow binds only to `127.0.0.1:43821`, accepts only `/callback`, times out after five minutes and never uses a Spotify Client Secret. The exact redirect URI used to start PKCE is persisted with the transaction and reused during code exchange.

Still explicit release gates:

- packaged token/session security review;
- current Spotify public-distribution/quota requirements;
- broader tester coverage across Windows machines before public release.

Main owns Spotify. EQ and Playlist proxy commands to it and never initialize duplicate Spotify playback sessions.

### Spotify development app

AMP99 contains its public Spotify Client ID as the default application identifier. A Client ID is not a secret. Contributors can override it with `VITE_SPOTIFY_CLIENT_ID` when deliberately testing another Spotify development application.

The Spotify Developer Dashboard must allow both callbacks:

```text
http://127.0.0.1:5173/callback
http://127.0.0.1:43821/callback
```

The first is the Vite/browser development callback. The second is the packaged AMP99 Windows loopback callback.

No Spotify Client Secret belongs in AMP99 or in the repository.

## Windows CI

The Windows workflow builds MSI and NSIS installers and verifies:

1. release `amp99.exe` starts;
2. one AMP99 process exposes **three separate visible top-level Windows windows**;
3. their titles identify Main Player, Equalizer and Playlist Editor;
4. MSI installs successfully;
5. installed AMP99 again exposes the three native windows;
6. `.wsz` is registered;
7. secondary `.wsz` launch hands off to the existing process;
8. the original process survives the handoff;
9. MSI uninstalls successfully;
10. MSI and NSIS artifacts are uploaded.

Native Spotify OAuth code is compiled and packaged by this gate. Real account/audio behavior is additionally covered by physical owner QA because CI must not contain personal Spotify credentials.

## Microsoft Store preflight

Store-related files:

```text
store/AppxManifest.template.xml
scripts/build-store-msix.ps1
.github/workflows/store-msix-preflight.yml
docs/MICROSOFT_STORE.md
docs/RELEASE_QA.md
PRIVACY.md
```

The CI MSIX uses a development identity for structural verification only. A final Store submission must use the exact Identity Name / Publisher values issued by Partner Center.

## Development

### Browser fallback

```bash
npm install
npm run dev
```

This is useful for frontend work, but it is not authoritative for desktop window behavior.

### Real desktop build

```bash
npm install
npm run tauri:dev
```

For any windowing, docking, `.wsz` association, tray, DPI, OAuth or multi-monitor change, **test the Tauri build**. A browser screenshot is not sufficient validation.

Production frontend check:

```bash
npm run build
```

Frontend tests:

```bash
npm test
```

Version consistency check:

```bash
npm run version:check
```

## Repository architecture

```text
src/
├── components/       classic player UI surfaces and controls
├── hooks/            browser/fallback interaction hooks
├── platform/         Windows/WebView integrations, including native Spotify OAuth bridge
├── skins/            .wsz parsing, validation and rendering
├── spotify/          Spotify auth/API/playback
├── state/            Main-owned application/player state
├── types/            shared domain types
├── windowing/        native-window roles, bridge, sizing, snapping, persistence
└── App.tsx           role-based composition

src-tauri/
├── app-icon.svg
├── src/              Rust/Tauri integrations and loopback listener
├── capabilities/
└── tauri.conf.json   declares Main/EQ/Playlist native windows

store/                Store manifest/template assets
scripts/              packaging/version scripts
docs/                 Store and release QA runbooks
```

## Free / open-source foundations

- Tauri 2
- React
- TypeScript
- Vite
- JSZip
- Tauri single-instance/global-shortcut plugins
- GitHub Actions
- browser APIs such as Canvas / ImageBitmap / BroadcastChannel / Media Session

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## What remains before public release

Do not add feature creep to V1. The remaining gates are primarily:

1. continue owner QA on real Windows hardware across DPI/scaling states and a large set of legacy skins;
2. run a small closed external tester round with the packaged alpha build;
3. resolve Spotify public-distribution requirements;
4. complete legal/branding/attribution review before Store submission;
5. run `docs/RELEASE_QA.md` across the tester pool;
6. reserve AMP99 in Partner Center and insert final Store identity values;
7. capture release screenshots;
8. pass Store certification.

## Legal / branding

AMP99 is not affiliated with Winamp, Nullsoft, Spotify, or their owners.

- Default AMP99 branding remains original.
- Do not bundle proprietary logos/assets or third-party legacy skins.
- Spotify production code must stay on documented official APIs/SDKs.
- No Spotify Client Secret belongs in a distributed desktop app.
