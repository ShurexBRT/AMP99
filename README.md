# AMP99

> **Play it like it's '99.**

AMP99 is a free Windows desktop player project that recreates the classic late-90s three-window music-player workflow while using Spotify as the planned playback and library backend.

> **AI contributors:** read [`AGENTS.md`](./AGENTS.md) completely before changing code. It defines task claiming, branch ownership, conflict prevention, architecture boundaries and handoff rules for parallel agent work.

## v0.1 foundation

- Tauri 2 + React + TypeScript + Vite
- Main Player, Equalizer and Playlist Editor shells
- Draggable windows with basic edge/classic-size snapping
- Saved window positions
- Play/pause/previous/next demo state
- Seek, volume, shuffle and repeat demo controls
- EQ sliders (visual only — Spotify audio will not be modified)
- Classic playlist editor interactions
- `.wsz` / ZIP skin archive detection and asset extraction foundation
- Microsoft Store-specific Tauri config foundation

## Planned next

1. Finish classic `.wsz` sprite rendering (MAIN/EQ/PLEDIT assets)
2. Add Spotify OAuth Authorization Code + PKCE
3. Add Spotify Web Playback SDK
4. Browse Liked Songs and user playlists in Playlist Editor
5. Create/edit Spotify playlists
6. Windows media keys, tray and packaging polish

## Run the frontend

```bash
npm install
npm run dev
```

## Run as a Tauri app

Install the current Tauri prerequisites (Rust/MSVC/WebView2 on Windows), then:

```bash
npm install
npm run tauri:dev
```

## Spotify configuration

Copy `.env.example` to `.env` when the Spotify integration lands and set the Spotify development Client ID and redirect URI.

## Legal / branding

AMP99 is an independent project and is not affiliated with Winamp, Nullsoft, Spotify, or their respective owners. The default AMP99 skin uses original project styling. Users will be able to import their own compatible `.wsz` skin files; AMP99 will not bundle third-party legacy skins.
