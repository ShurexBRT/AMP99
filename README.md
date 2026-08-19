# AMP99

> **Play it like it's '99.**

AMP99 is a free Windows desktop music player that recreates the classic late-90s three-window desktop-player workflow while using Spotify as its music library and playback backend.

The product goal is **not** to build a modern Spotify client with a retro theme. AMP99 should feel like a classic desktop player that gained Spotify support as a native plugin.

> **AI contributors:** read [`AGENTS.md`](./AGENTS.md) completely before changing code. It defines task claiming, branch ownership, conflict prevention, architecture boundaries and handoff rules for parallel agent work.

## Current project status

| Area | Status | Notes |
|---|---|---|
| Tauri 2 desktop shell | Implemented / Windows smoke-tested | Raw release EXE and MSI-installed EXE both pass CI startup smoke tests |
| React + TypeScript + Vite UI | Implemented | Main Player, Equalizer and Playlist Editor |
| Classic draggable windows | Implemented foundation | Persisted positions and basic snapping/docking behavior |
| `.wsz` archive loading | Implemented | Legacy ZIP/WSZ parsing, validation and normalized asset lookup |
| `.wsz` Main Player rendering | Implemented | Imported compatible skins can render classic Main Player assets/sprites |
| Full EQ / Playlist Editor skin fidelity | In progress | Main Player is ahead of the other classic windows |
| Spotify Authorization Code + PKCE | Implemented for browser/dev callback | No Spotify Client Secret belongs in AMP99 |
| Spotify library browsing | Implemented | User playlists, Liked Songs and playlist tracks |
| Spotify playlist creation/editing | Implemented | Create, search, add, remove and index-based move/reorder flows |
| Spotify Web Playback SDK integration | Implemented in frontend | Packaged Windows startup is proven; real WebView2/EME Spotify playback is not yet proven |
| Native Tauri OAuth loopback callback | Not on `main` yet | Required before installed-app Spotify login is considered complete |
| Windows MSI/NSIS CI artifacts | Implemented / smoke-tested | CI builds both formats and validates raw EXE plus MSI install/launch/uninstall |
| Microsoft Store release packaging/signing | Not started | Development installers are not Store-ready packages |

## Current feature set on `main`

### Classic player shell

- Main Player, Equalizer and Playlist Editor windows
- draggable window state with persisted positions
- basic classic-size snapping/docking foundation
- play/pause/stop/previous/next controls
- seek and volume controls
- shuffle and repeat controls
- classic Playlist Editor interactions
- visual EQ controls

The EQ is intentionally visual-only for Spotify playback. AMP99 does not DSP or alter the Spotify audio stream.

### Spotify library and playlists

Spotify integration is isolated under `src/spotify/` and uses official Spotify developer APIs/SDKs only.

Current capabilities include:

- Authorization Code with PKCE
- access-token refresh and session persistence
- current Spotify user profile
- current user's playlists
- Liked Songs / saved tracks
- playlist track loading
- Spotify track search
- create a Spotify playlist
- add tracks to editable playlists
- remove tracks from editable playlists
- reorder/move playlist items using Spotify snapshot-aware operations
- typed API/auth errors including playlist-access restrictions
- normalized Spotify tracks mapped into AMP99 queue models

AMP99 deliberately protects unsafe playlist-edit cases. For example, operations that could target the wrong Spotify item because of unsupported/non-track entries or ambiguous duplicate handling are disabled rather than silently doing the wrong thing.

### Spotify playback

The frontend contains an official Spotify Web Playback SDK integration and Spotify Connect device flow.

AMP99 remains the owner of its classic queue behavior while Spotify provides the playback device/state. The integration supports the playback path for:

- starting a selected Spotify track URI
- play / resume
- pause
- stop-style AMP99 behavior
- previous / next AMP99 queue selection
- seek
- volume
- shuffle
- repeat
- Spotify playback state reflected back into the classic UI

**Important:** Windows packaging and application startup are now proven in CI, but that still does **not** prove Spotify playback works inside packaged Tauri/WebView2. Native installed-app OAuth and a real Spotify Premium WebView2/EME/DRM playback smoke test remain required before Windows Spotify playback is declared complete.

### Legacy `.wsz` skins

Legacy skin support is a first-class AMP99 feature.

Current skin infrastructure includes:

- `.wsz` / ZIP archive parsing with JSZip
- case-insensitive legacy asset lookup
- nested-path compatibility handling
- archive/path validation and ZIP traversal protection
- archive/file extraction limits
- support for classic bitmap/image sheets used by compatible skins
- sprite metadata for classic Main Player controls
- browser-side sprite extraction/rendering
- skin state separated from player/Spotify state
- imported skin rendering for the Main Player

AMP99 does **not** bundle third-party legacy skins. Users supply their own compatible `.wsz` files.

### Windows packaging and smoke validation

AMP99 now has a Windows GitHub Actions pipeline that builds both development installer formats:

- MSI (`AMP99_0.1.0_x64_en-US.msi`)
- NSIS setup EXE (`AMP99_0.1.0_x64-setup.exe`)

The pipeline also performs automated Windows startup/install validation. The successful validation that promoted this pipeline to `main` proved:

1. the raw Tauri release `amp99.exe` launched and stayed alive for the startup observation window;
2. the generated MSI installed silently into an isolated test directory;
3. the MSI-installed `amp99.exe` launched and stayed alive for the startup observation window;
4. the MSI uninstalled successfully;
5. both MSI and NSIS artifacts were produced and uploaded by CI.

This is a **desktop packaging/startup smoke test**, not an end-to-end Spotify test. It does not yet prove native OAuth, Spotify Premium playback, audio output, or EME/DRM behavior inside WebView2.

## Development configuration

### Spotify

1. Create a Spotify app in the Spotify Developer Dashboard.
2. Add the current development redirect URI to the app allowlist:

```text
http://127.0.0.1:5173/callback
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Set the public development Client ID and redirect URI:

```text
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
```

`.env` is local-only and must never contain a Spotify Client Secret, access token, refresh token, or test-user credentials.

The `:5173` callback is only the current browser/development flow. Installed Windows builds require a native Tauri loopback OAuth callback before Spotify login is considered production-ready.

## Run the frontend

```bash
npm install
npm run dev
```

Production frontend check:

```bash
npm run build
```

## Run as a Tauri app

Install the current Tauri prerequisites on Windows (Rust/MSVC/WebView2), then:

```bash
npm install
npm run tauri:dev
```

The repository CI now also builds MSI and NSIS development installers and performs a raw-EXE plus MSI install/launch/uninstall smoke test. These development bundles are useful for runtime testing but are **not** Microsoft Store release packages.

## What we are working on next

Order matters. Windows packaging/startup has been proven; the next priority is proving the real Spotify path inside the installed desktop application.

1. Finish the native Tauri loopback OAuth callback and connect it to the existing PKCE frontend session flow.
2. Install AMP99 on Windows with a Spotify Premium development user and smoke-test login plus Web Playback/EME in WebView2.
3. Fix any runtime-specific playback/auth issues found by that test.
4. Continue full classic `.wsz` fidelity for the Equalizer and Playlist Editor.
5. Add Windows media-key / tray integration and packaging polish.
6. Design the final Microsoft Store packaging/signing/release flow.

## Repository architecture

```text
src/
├── components/       classic player UI windows and controls
├── hooks/            UI interaction hooks
├── skins/            .wsz parsing, validation, sprite metadata and rendering
├── spotify/          Spotify auth, Web API, playlist and playback integration
├── state/            shared player/window state
├── types/            shared AMP99 domain types
└── App.tsx           application composition

src-tauri/
├── src/              native Tauri/Rust integration
├── capabilities/     Tauri permissions
└── *.conf.json       desktop / future Store packaging configuration
```

Keep Spotify network/API concerns out of visual components and keep `.wsz` parsing/rendering out of Spotify code.

## Free / open-source foundations

AMP99 aims to use free and open-source tooling wherever practical while keeping Spotify integration on documented official APIs/SDKs.

Current foundations include:

- Tauri 2
- React
- TypeScript
- Vite
- JSZip
- GitHub Actions ecosystem for CI/build automation
- browser platform APIs such as Canvas / ImageBitmap for skin rendering

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for compatibility references and third-party notices tracked by the project.

## Legal / branding

AMP99 is an independent project and is not affiliated with Winamp, Nullsoft, Spotify, or their respective owners.

- The default AMP99 visual identity must remain original.
- Do not add Winamp, Nullsoft or Spotify logos/proprietary branding to the product.
- Do not bundle third-party legacy skins in the repository or installer.
- Spotify production code must use documented official developer APIs/SDKs only.
- No Spotify Client Secret belongs in a distributed desktop application.
