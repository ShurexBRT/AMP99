# AMP99 — AI Collaboration Protocol

> **Play it like it's 1999.**
>
> This is the operating agreement for every AI agent and human contributor working on AMP99. Read it before changing code.

## 1. Product truth

AMP99 is a **free Windows desktop music player** built around the classic late-1990s three-window player workflow, user-supplied Winamp-compatible `.wsz` skins, and an official Spotify integration layer.

The goal is not a modern Spotify dashboard with a retro theme. The goal is:

> **A classic late-90s desktop player that feels as if connected-music support had been added as a native plugin.**

Brand:

- Product: **AMP99**
- Tagline: **Play it like it's 1999.**
- Source icon: `src-tauri/app-icon.svg`
- Do not add Winamp, Nullsoft or Spotify proprietary logos/assets without explicit permission.
- Do not bundle third-party legacy skins.

---

## 2. NON-NEGOTIABLE desktop architecture

The packaged Tauri application uses **three real native OS windows**:

```text
AMP99 process
├── main        275 × 116   Main Player
├── equalizer   275 × 116   Equalizer
└── playlist    275 × 232   Playlist Editor
```

These are **not panels inside a large shared React/Tauri canvas**.

### Hard rules

- Never reintroduce a large 900×620-style host window containing fake Main/EQ/Playlist panels in the packaged desktop app.
- Main, Equalizer and Playlist must remain independently movable native Tauri/Windows windows.
- Native dragging, native sizing and native outer positions are authoritative for desktop window behavior.
- Docking/snapping must operate between OS windows.
- Shade mode changes the actual native window height.
- 1× / 2× changes native window dimensions and pixel scaling.
- Main EQ/PL controls show/hide the corresponding native windows.
- EQ and Playlist can be hidden independently.
- Main close hides the AMP99 window group to tray; explicit tray Quit exits the process.
- Browser `npm run dev` may keep a single-page fallback for convenience, but that fallback is **not** product architecture and is not valid proof of Windows UX.

### Multi-webview ownership

The three Tauri windows are three webviews in one AMP99 process.

- **Main** is the authoritative application controller.
- Main owns player state, Spotify session state and Spotify playback initialization.
- **Never initialize Spotify Web Playback SDK independently in EQ or Playlist.**
- Equalizer and Playlist send typed commands to Main and consume Main snapshots through `src/windowing/`.
- Shared `.wsz` skin selection must synchronize across all three windows.
- Do not move Spotify API calls into auxiliary-window components to avoid using the bridge.

Windows CI contains a Win32 top-level-window probe. A desktop-windowing change is not complete if CI cannot prove Main, Equalizer and Playlist are separate windows in one AMP99 process.

---

## 3. Technical baseline

Current stack:

- Tauri 2
- React + TypeScript + Vite
- JSZip for `.wsz` / ZIP skin input
- official Spotify developer APIs / SDKs only
- Spotify Authorization Code with PKCE; no client secret in the desktop app

Repository map:

```text
src/
├── components/       classic player UI surfaces and controls
├── hooks/            browser/fallback interaction hooks
├── platform/         Windows/WebView integration
├── skins/            .wsz parsing, validation, sprite metadata/rendering
├── spotify/          auth, API, playlist and playback code
├── state/            Main-owned application/player state
├── types/            shared domain types
├── windowing/        native roles, state/command bridge, sizing, snapping, persistence
└── App.tsx           role-based composition / orchestration

src-tauri/
├── app-icon.svg
├── src/              native Rust/Tauri integration
├── capabilities/
└── tauri.conf.json   declares Main/EQ/Playlist native windows

store/                Microsoft Store package templates
scripts/              packaging/release scripts
docs/                 Store/release QA runbooks
```

Do not replace the major stack or architecture without explicit repository-owner approval.

---

## 4. Collaboration rules

### Rule 1 — never develop directly on `main`

Every implementation task gets its own branch:

```text
agent/<agent-name>/<short-scope>
```

Small docs-only changes may go directly to `main` only when the repository owner explicitly requests it.

### Rule 2 — claim work first

Before editing:

1. Read latest `README.md` and `AGENTS.md`.
2. Check open issues and PRs.
3. Make sure no other agent owns the same subsystem/files.
4. Open or use a `[CLAIM]` issue.
5. State expected files and explicit non-goals.
6. Create the feature branch.

### Rule 3 — no concurrent edits to the same owned files

If another active task owns a file/subsystem, do not "helpfully" refactor it. Stop and coordinate.

### Rule 4 — no drive-by refactors

Do not rename, reorganize, dependency-upgrade or redesign unrelated code because it looks cleaner.

### Rule 5 — preserve existing work

Never silently revert, overwrite, delete or reconstruct unfamiliar code. Understand it first.

### Rule 6 — one concern per PR

Good:

```text
Native window docking
Spotify PKCE
.WSZ sprite renderer
Playlist API edits
```

Bad:

```text
Spotify + skins + state rewrite + CSS cleanup + dependency upgrades
```

---

## 5. Required task workflow

Before coding:

- read repo truth;
- inspect implementation;
- inspect active work;
- claim scope;
- branch.

While coding:

- stay inside scope;
- keep platform-specific code behind `src/windowing/`, `src/platform/` or Tauri/Rust boundaries;
- keep Spotify network concerns under `src/spotify/`;
- keep skin decoding under `src/skins/`;
- do not commit credentials or tokens;
- avoid new dependencies if current platform APIs solve the problem cleanly.

Before merge:

```bash
npm install
npm run build
```

For Tauri/windowing/installer changes, Windows native CI is mandatory. A browser build alone is insufficient.

PR description must state:

```text
## What changed
## Why
## Files/modules touched
## What I intentionally did not change
## Validation performed
## Known limitations/follow-up
## Coordination notes
```

Never report a check as passing unless it actually ran.

---

## 6. High-conflict areas

Treat these as explicitly owned per task:

```text
src/App.tsx
src/windowing/
src/state/
src/types/
src/styles.css
src/native-windows.css
package.json
src-tauri/src/lib.rs
src-tauri/tauri.conf.json
src-tauri/capabilities/
```

Safe parallel examples:

| Agent A | Agent B |
|---|---|
| `src/spotify/*` | `.wsz` sprite work |
| Store docs | playlist visual polish |
| Spotify API tests | skin fixtures |

Risky parallel examples:

| Agent A | Agent B |
|---|---|
| native window bridge | `App.tsx` orchestration |
| native docking | `tauri.conf.json` window definitions |
| playlist UI redesign | Spotify wiring in Playlist Editor |
| state migration | another state migration |

---

## 7. Classic player fidelity

Product surfaces:

1. Main Player
2. Equalizer
3. Playlist Editor

Preserve:

- classic compact dimensions;
- bitmap/pixel rendering;
- active/inactive titlebars;
- pressed controls;
- shade behavior;
- dense Playlist Editor;
- OS-window docking/snapping;
- 1× / 2× behavior.

Avoid unless explicitly approved:

- permanent modern sidebars;
- large album-card dashboards;
- rounded SaaS layouts;
- Spotify-green branding;
- mobile-first desktop navigation.

Spotify functionality should appear through classic menus/workflows rather than replacing the classic UI model.

---

## 8. Spotify rules

Use only documented official Spotify APIs/SDKs in production code.

Never commit:

- access tokens;
- refresh tokens;
- Client Secrets;
- credentials;
- private tester data.

Only a public Client ID belongs in client configuration.

Current phase intentionally supports Spotify Development Mode and its limited tester pool. Never implement limit-bypass hacks.

Preferred data path:

```text
Spotify response
  ↓
src/spotify service/mapper
  ↓
AMP99 domain model
  ↓
Main state/controller
  ↓
window snapshot / classic UI
```

For native multi-window mode:

```text
Playlist/EQ webview
  ↓ typed command
Main webview
  ↓
src/spotify
```

Do not let auxiliary webviews become independent Spotify clients.

The visual EQ must not alter Spotify audio unless Spotify rules explicitly permit it.

---

## 9. Playlist behavior

Playlist Editor is a core product surface.

Expected workflow where the official Spotify API permits it:

```text
LIST OPTS
→ Spotify Playlists
→ choose list
→ load into classic Playlist Editor
```

Supported/target capabilities include browse, Liked Songs, create, search, add, remove and reorder. Ownership/403 restrictions must be represented honestly. Disable unsafe actions rather than failing mysteriously after click.

---

## 10. `.wsz` compatibility and security

User-supplied `.wsz` is untrusted input.

Compatibility assets include classic sheets such as:

```text
main.bmp
titlebar.bmp
cbuttons.bmp
shufrep.bmp
volume.bmp
balance.bmp
numbers.bmp
playpaus.bmp
eqmain.bmp
eq_ex.bmp
pledit.bmp
pledit.txt
viscolor.txt
```

Rules:

- do not bundle third-party skins;
- default skin remains original AMP99 branding;
- validate paths/file types;
- prevent ZIP traversal;
- enforce archive/file-size limits;
- gracefully handle missing optional assets;
- revoke generated Blob URLs when no longer needed;
- skin parsing/rendering belongs under `src/skins/`;
- a selected skin must propagate to all native AMP99 windows.

Test at least valid archive, invalid archive, missing assets, optional missing assets and case/path variations.

---

## 11. State rules

Do not turn `useAmp99State.ts` into a god object.

Keep conceptual separation between:

```text
player/queue
Spotify session
playlist editing
skin
native window state
preferences
```

Native window position is an OS-window concern. Do not reintroduce virtual `left/top` as the authoritative packaged-desktop position model.

A state-library migration (Zustand/Redux/etc.) requires explicit approval and its own task.

---

## 12. Security

Treat as untrusted:

- `.wsz` files;
- Spotify responses;
- playlist/track metadata;
- URLs;
- inter-window messages;
- Tauri commands/arguments.

Expose only required Tauri permissions. Never globally disable security controls to make development easier.

---

## 13. Dependency rules

Before adding a dependency, answer:

1. Why is it needed?
2. Can existing APIs solve it?
3. Is it maintained?
4. What native/bundle complexity does it add?
5. Is its license appropriate for a free Store app?

Do not upgrade unrelated packages inside a feature PR.

---

## 14. Definition of done

A feature is not done because code was generated.

Minimum:

- TypeScript compiles;
- relevant frontend CI passes;
- native CI passes when desktop behavior changed;
- real interaction is implemented, not decorative only;
- failures are handled;
- no secret committed;
- scope matches claim;
- README/AGENTS/docs updated for architecture/setup changes.

For native windowing work additionally verify:

- three top-level native windows still exist;
- they share one AMP99 process;
- Main/EQ/Playlist move independently;
- EQ/PL show/hide works;
- Main group tray behavior works;
- native snapping and position persistence are not regressed;
- 1×/2× and shade resize native windows;
- MSI/NSIS smoke remains green.

---

## 15. Handoff protocol

Every completed PR should leave:

```text
HANDOFF

Completed:
- ...

Touched:
- ...

Important decisions:
- ...

Known issues:
- ...

Do not change yet:
- ...

Recommended next task:
- ...
```

Important decisions belong in the repository, not only in chat history.

---

## 16. Conflict priority

When instructions disagree:

1. repository owner's explicit current instruction;
2. current `AGENTS.md`;
3. merged architecture decisions;
4. current claim/PR scope;
5. agent preference.

Agent preference loses every time.

---

## 17. Current V1 posture

The non-Spotify platform feature set is close to frozen. Prefer QA, fidelity fixes and bug fixes over feature creep.

The remaining major release gates are Spotify packaged-runtime validation, manual Windows QA, final Partner Center identity/screenshots and Store certification.

Do not rebuild completed subsystems just because another approach is aesthetically preferable.

---

## 18. Final rule

**Do not optimize for how much code an agent can produce. Optimize for how safely the next contributor can continue.**

AMP99 should grow as one coherent product, not as agents taking turns rebuilding each other's work.
