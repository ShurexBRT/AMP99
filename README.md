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

## Spotify foundation

The Spotify integration is being built around the official Spotify Web API only.

Current service-layer capabilities:

- Authorization Code with PKCE
- access-token refresh and session persistence
- current Spotify user profile
- current user's playlists
- Liked Songs / saved tracks
- playlist item loading
- typed API/auth errors including playlist-access `403` handling

No Spotify Client Secret belongs in this desktop application.

### Development configuration

1. Create a Spotify app in the Spotify Developer Dashboard.
2. Add this exact development redirect URI to the app allowlist:

```text
http://127.0.0.1:5173/callback
```

3. Copy the example environment file:

```bash
cp .env.example .env
```

4. Set your development Client ID in `.env`:

```text
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
```

`.env` is local-only and must never contain a Spotify Client Secret, access token, refresh token, or test-user credentials.

The browser redirect above is the development callback. The Windows/Tauri loopback callback will be implemented as a separate native integration task before Store packaging.

## Planned next

1. Finish classic `.wsz` sprite rendering (MAIN/EQ/PLEDIT assets)
2. Wire Spotify login and library data into the classic Playlist Editor
3. Add Spotify Web Playback SDK
4. Create/edit Spotify playlists
5. Windows media keys, tray and packaging polish
6. Replace the browser-only OAuth callback with the native Tauri loopback flow

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

## Legal / branding

AMP99 is an independent project and is not affiliated with Winamp, Nullsoft, Spotify, or their respective owners. The default AMP99 skin uses original project styling. Users will be able to import their own compatible `.wsz` skin files; AMP99 will not bundle third-party legacy skins.
