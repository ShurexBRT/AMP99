# AMP99

> **Play it like it's 1999.**

AMP99 is a free Windows desktop music player built around the classic late-90s three-window desktop-player workflow, with Spotify integration and user-supplied Winamp-compatible `.wsz` skins.

The product goal is **not** to build a modern Spotify client with a retro theme. AMP99 should feel like a classic desktop player that gained connected-music support as a native plugin.

> **AI contributors:** read [`AGENTS.md`](./AGENTS.md) before changing code. It defines task claiming, branch ownership, architecture boundaries and handoff rules for parallel agent work.

## Brand

- Product: **AMP99**
- Tagline: **Play it like it's 1999.**
- App icon: original gunmetal hi-fi faceplate with phosphor-green `A99` LCD monogram and play indicator
- Visual direction: graphite / black hardware surfaces, phosphor LCD green, restrained brushed-metal detail

The scalable app-icon source lives at `src-tauri/app-icon.svg`. Tauri generates native and Store icon assets from that source.

## Current project status

| Area | Status | Notes |
|---|---|---|
| Tauri 2 desktop shell | **Implemented / Windows smoke-tested** | Raw EXE and MSI-installed EXE pass CI startup tests |
| React + TypeScript + Vite UI | **Implemented** | Main Player, Equalizer and Playlist Editor |
| Classic dragging / snapping | **Implemented foundation** | Persisted positions, inter-window edge snapping and viewport clamping |
| Active/inactive + shade mode | **Implemented foundation** | Classic windows track focus; titlebar double-click toggles shade |
| 1x / 2x display | **Implemented foundation** | Classic windows and snap calculations support both sizes |
| `.wsz` archive loading | **Implemented / hardened** | Case-insensitive lookup, traversal protection, extraction limits and fallbacks |
| `.wsz` Main Player rendering | **Implemented** | Classic Main Player sheets and controls render from compatible skins |
| `.wsz` EQ rendering | **Implemented foundation** | EQMAIN / EQ_EX geometry and classic controls supported |
| `.wsz` Playlist rendering | **Implemented foundation** | Composed PLEDIT chrome plus `PLEDIT.TXT` colors |
| `.wsz` Windows file association | **Implemented / CI-tested** | MSI registers `.wsz`; second launch hands skin to existing AMP99 instance |
| System tray / Always on Top | **Implemented / native build-tested** | Show, topmost toggle and Quit actions |
| Hardware media keys | **Implemented best-effort** | Native global media-key bridge; conflicts do not block startup |
| Windows Media Session bridge | **Implemented best-effort** | Uses Web Media Session when exposed by WebView2 |
| DPI / multi-monitor resilience | **Implemented foundation** | Child windows clamp back into viewport on resize/visual-viewport changes |
| Spotify Authorization Code + PKCE | **Implemented for browser/dev callback** | Native installed-app callback remains a separate gate |
| Spotify library browsing | **Implemented** | User playlists, Liked Songs and playlist tracks |
| Spotify playlist creation/editing | **Implemented** | Create, search, add, remove and move/reorder flows |
| Spotify Web Playback SDK | **Implemented in frontend** | Real packaged WebView2/EME audio still needs physical runtime proof |
| MSI / NSIS development artifacts | **Implemented / smoke-tested** | CI builds, installs, launches, tests `.wsz` handoff and uninstalls |
| Microsoft Store MSIX pipeline | **Structural preflight implemented** | Parameterized Store manifest + MakeAppx pack/unpack verification; final Partner Center identity is external |
| Privacy / Store / release docs | **Implemented** | See `PRIVACY.md` and `docs/` |

## Classic desktop experience

AMP99 currently provides:

- Main Player, Equalizer and Playlist Editor as independent classic windows;
- persisted window positions;
- edge-to-edge snapping between the three windows;
- active/inactive titlebar behavior;
- double-click shade mode;
- 1x / 2x display foundation;
- play/pause/stop/previous/next;
- seek and volume;
- shuffle and repeat;
- classic Playlist Editor menus and interactions;
- system tray controls;
- native Always on Top;
- best-effort hardware media keys;
- Web Media Session integration where the Windows WebView runtime exposes it.

The Equalizer is intentionally visual-only for Spotify playback. AMP99 does not DSP or alter the Spotify audio stream.

## Legacy `.wsz` skins

Legacy skin support is a first-class AMP99 feature.

Current infrastructure includes:

- `.wsz` / ZIP parsing with JSZip;
- case-insensitive legacy asset lookup;
- nested-path compatibility;
- archive/path validation and ZIP traversal protection;
- file/archive extraction limits;
- classic Main Player sprite sheets and control states;
- EQMAIN / EQ_EX rendering foundation;
- PLEDIT chrome composition and `PLEDIT.TXT` colors;
- browser-side pixel-art sprite extraction;
- shared skin state separated from playback/Spotify state;
- graceful fallback for optional assets;
- Windows `.wsz` file association;
- single-instance handoff when a skin is opened while AMP99 is already running;
- native validation of associated `.wsz` paths/files before JS archive processing.

AMP99 does **not** bundle third-party legacy skins. Users supply their own compatible `.wsz` files.

## Spotify status

Spotify code remains isolated under `src/spotify/` and uses official developer APIs/SDKs only.

Already implemented:

- Authorization Code with PKCE;
- token refresh/session persistence;
- current user profile;
- playlists and Liked Songs;
- playlist track loading;
- search;
- create/add/remove/reorder playlist operations;
- official Web Playback SDK / Spotify Connect device path;
- AMP99 queue-to-Spotify playback controls;
- API error/restriction handling.

**Still not proven for a public packaged release:**

- installed-app native OAuth callback;
- real Spotify Premium audio in packaged Tauri/WebView2 EME/DRM;
- final token/session security review for the packaged application;
- current Spotify public-distribution/quota approval requirements.

Those remain explicit Spotify release gates. The current non-Spotify V1 platform pass does not pretend otherwise.

## Windows installers and automated smoke tests

The main Windows workflow builds:

- MSI (`AMP99_0.1.0_x64_en-US.msi`)
- NSIS setup EXE (`AMP99_0.1.0_x64-setup.exe`)

CI verifies:

1. release `amp99.exe` starts and stays alive;
2. MSI installs into an isolated test directory;
3. `.wsz` association is registered;
4. installed AMP99 starts and stays alive;
5. a secondary launch with a `.wsz` argument exits after handing the request to the existing instance;
6. the primary instance remains alive during the handoff;
7. MSI uninstall succeeds;
8. both MSI and NSIS artifacts are produced.

These are development/runtime artifacts. The intended Microsoft Store route is MSIX.

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

The Store preflight pipeline uses a **development identity** to prove that the package can be built and unpacked structurally. It verifies the executable, requested identity and `.wsz` file association.

The final Store package must use the exact **Identity Name**, **Publisher** and **Publisher display name** supplied by Microsoft Partner Center. Do not submit the CI development identity.

See [`docs/MICROSOFT_STORE.md`](./docs/MICROSOFT_STORE.md) for the handoff and [`docs/RELEASE_QA.md`](./docs/RELEASE_QA.md) for release gates.

## Privacy

The current privacy policy is [`PRIVACY.md`](./PRIVACY.md).

It documents local preferences, user-supplied skin handling and the current connected-service session behavior. Keep it synchronized with any future data-handling change.

## Development

### Frontend

```bash
npm install
npm run dev
```

Production frontend check:

```bash
npm run build
```

### Tauri desktop

Install current Tauri Windows prerequisites, then:

```bash
npm install
npm run tauri:dev
```

`npm run tauri:dev` and `npm run tauri:build` regenerate platform icons from `src-tauri/app-icon.svg` before native execution/build.

### Store MSIX structural package

After building the release executable on Windows:

```powershell
./scripts/build-store-msix.ps1 `
  -IdentityName "<PARTNER_CENTER_IDENTITY_NAME>" `
  -Publisher "<PARTNER_CENTER_PUBLISHER>" `
  -PublisherDisplayName "<PUBLISHER_DISPLAY_NAME>" `
  -Version "0.1.0.0"
```

See the Store guide before using a final identity.

## Repository architecture

```text
src/
├── components/       classic UI windows and controls
├── hooks/            interaction / window behavior
├── platform/         desktop/WebView platform integrations
├── skins/            .wsz parsing, validation, geometry and rendering
├── spotify/          Spotify auth, API, playlist and playback integration
├── state/            shared player/window state
├── types/            shared AMP99 domain types
└── App.tsx           application composition

src-tauri/
├── app-icon.svg      scalable original AMP99 app icon
├── src/              native Rust/Tauri integrations
├── capabilities/     Tauri permissions
└── tauri.conf.json   native desktop installer configuration

store/                Microsoft Store manifest/template assets
scripts/              release/packaging scripts
docs/                 Store and release QA runbooks
```

Keep Spotify network/API concerns out of visual/platform components and keep `.wsz` parsing/rendering out of Spotify code.

## Free / open-source foundations

AMP99 uses free/open-source tooling wherever practical:

- Tauri 2;
- official Tauri single-instance and global-shortcut plugins;
- React;
- TypeScript;
- Vite;
- JSZip;
- GitHub Actions ecosystem;
- browser platform APIs such as Canvas / ImageBitmap / Media Session.

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for tracked licenses/references.

## What remains before a public release

The non-Spotify Windows/platform foundation is intentionally close to frozen for V1. Do not keep piling on features.

Remaining release gates are primarily:

1. complete and physically test the installed-app Spotify flow;
2. resolve all current Spotify public-distribution requirements;
3. run the manual matrix in `docs/RELEASE_QA.md`, especially DPI/multi-monitor/media-key/skin compatibility;
4. reserve **AMP99** in Partner Center and insert the real Store identity values;
5. capture real final Store screenshots;
6. pass final Store certification.

## Legal / branding

AMP99 is an independent project and is not affiliated with Winamp, Nullsoft, Spotify, or their respective owners.

- Default AMP99 branding must remain original.
- Do not add Winamp, Nullsoft or Spotify proprietary logos/assets without permission.
- Do not bundle third-party legacy skins in the repository or installer.
- Spotify production code must use documented official developer APIs/SDKs only.
- No Spotify Client Secret belongs in a distributed desktop application.
