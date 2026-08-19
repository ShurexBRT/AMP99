# AMP99 — AI Collaboration Protocol

> **Play it like it's 1999.**
>
> This file is the operating agreement for every AI coding agent and human contributor working on AMP99. Read it completely before changing code.

## 1. Project truth

AMP99 is a **free Windows desktop music player** that recreates the classic late-1990s Winamp-style workflow and interaction model while using Spotify as the planned music library/playback backend.

The product goal is not "a modern Spotify app with a retro theme". The goal is:

> **A classic late-90s desktop player that feels as if Spotify support had been added as a native plugin.**

Current product tagline:

> **Play it like it's 1999.**

AMP99 is an independent project. Do not add Winamp, Nullsoft, or Spotify logos, proprietary branding, or bundled third-party legacy skins.

Current AMP99 brand source:

- product name: **AMP99**;
- source app icon: `src-tauri/app-icon.png`;
- icon direction: original gunmetal hi-fi faceplate with phosphor-green `A99` LCD monogram and play indicator;
- the icon remains AMP99-owned branding even when the player UI is changed by a user-supplied `.wsz` skin.

---

## 2. Current technical baseline

The repository currently targets:

- **Tauri 2** for the Windows desktop shell and future Microsoft Store packaging.
- **React + TypeScript + Vite** for the application UI.
- **JSZip** for `.wsz` / ZIP skin archive parsing.
- Spotify integration will use official Spotify developer APIs and SDKs only.
- Spotify authentication must use **Authorization Code with PKCE**. No client secret belongs in the desktop app or repository.

Current UI foundation contains:

- Main Player window.
- Equalizer window.
- Playlist Editor window.
- Draggable window state.
- Basic snapping foundation.
- Persisted window positions.
- Demo playback state.
- Visual EQ controls.
- Initial `.wsz` archive detection / extraction logic.

Do not rewrite this stack or replace major dependencies without explicit approval from the repository owner.

---

## 3. Repository map

The intended ownership boundaries are:

```text
src/
├── components/       UI windows and reusable player controls
├── hooks/            UI interaction hooks such as dragging/docking
├── skins/            .wsz parsing, skin metadata and sprite rendering
├── spotify/          Spotify auth, API, playback and mapping code
├── state/            shared application/player/window state
├── types/            shared TypeScript domain types
├── App.tsx           composition only; keep business logic out
└── styles.css        current foundation styling; expected to evolve

src-tauri/
├── app-icon.png      original AMP99 app-icon source
├── src/              native Tauri/Rust integration
├── capabilities/     Tauri permissions
└── *.conf.json       desktop/store packaging configuration
```

If you introduce a new domain, create a focused directory instead of turning `App.tsx` or one service file into a dumping ground.

---

# 4. NON-NEGOTIABLE collaboration rules

These rules exist to prevent two AI agents from destroying each other's work.

## Rule 1 — Never develop directly on `main`

`main` is the integration branch.

Every implementation task must use its own branch.

Preferred format:

```text
agent/<agent-name>/<short-scope>
```

Examples:

```text
agent/codex/spotify-pkce
agent/claude/skin-renderer
agent/codex/window-docking
```

Small documentation-only fixes may go directly to `main` only when the repository owner explicitly asks for that.

## Rule 2 — Claim work before editing

Before changing code:

1. Pull/read the latest `main`.
2. Check open issues and open PRs.
3. Make sure another contributor is not already touching the same subsystem.
4. Claim the task using a GitHub issue or an existing assigned issue.
5. State which files/directories you expect to touch.

Suggested claim title:

```text
[CLAIM] Spotify PKCE authentication
```

Suggested claim body:

```text
Agent: <name>
Scope: <short description>
Expected files:
- src/spotify/*
- src/state/* only if required
Will not touch:
- src/skins/*
- src-tauri/*
```

If another active task overlaps materially, do not start editing. Split the responsibility first.

## Rule 3 — Do not edit the same file concurrently

This is the most important practical rule.

If Agent A owns `src/skins/*`, Agent B must not "clean up" or refactor those files while Agent A has an active branch/PR.

If a task unexpectedly requires a file owned by another active task:

- stop,
- document the dependency in the issue/PR,
- either move the change into the owning agent's branch or wait until that work lands.

Never silently overwrite or recreate another agent's implementation.

## Rule 4 — No drive-by refactors

Do not refactor unrelated code because it "looks cleaner".

A task touching Spotify authentication must not also redesign the playlist component, rename state APIs, replace CSS conventions, upgrade dependencies, or reorganize directories unless those changes are necessary for the task and clearly documented.

Small diffs merge. Heroic rewrites collide.

## Rule 5 — Preserve other contributors' work

Never:

- revert code simply because you did not write it,
- delete an unfamiliar feature without understanding why it exists,
- reset files to an older version,
- force-push over another contributor's branch,
- replace a whole file when a focused patch is enough,
- remove TODOs belonging to another active task unless resolved.

Before changing a file, inspect its current version from the latest target branch.

## Rule 6 — One concern per PR

Good:

```text
Spotify PKCE authentication
Classic window docking
.WSZ sprite renderer
Playlist create/edit API
```

Bad:

```text
Spotify + skins + CSS cleanup + dependency upgrades + new settings
```

If the PR title needs the word "and" three times, it is probably too large.

---

# 5. Required workflow for every coding task

## Before coding

Every agent must:

1. Read `AGENTS.md`.
2. Read `README.md`.
3. Inspect the current implementation related to the task.
4. Inspect open PRs/issues for overlap.
5. Claim the scope.
6. Create a feature branch.

## While coding

- Stay inside the claimed scope.
- Prefer focused components/services over monolithic files.
- Do not commit secrets.
- Do not change package versions unless required.
- Do not add a new dependency when a small native implementation is reasonable.
- Keep Spotify API concerns out of visual components.
- Keep skin decoding/rendering out of Spotify code.
- Keep platform-specific native logic behind Tauri boundaries.

## Before pushing

Run the most relevant checks available:

```bash
npm install
npm run build
```

For native/Tauri changes also run, when the environment supports it:

```bash
npm run tauri:build
```

If a check cannot be run, say exactly why in the PR. Never report a check as passing unless it actually ran.

## Pull request

Every feature branch should end in a PR to `main`.

PR description must include:

```text
## What changed

## Why

## Files / modules touched

## What I intentionally did not change

## Validation performed

## Known limitations / follow-up

## Coordination notes for the next agent
```

Do not merge an overlapping PR until dependent work is rebased/updated and conflicts are understood.

---

# 6. Ownership boundaries for parallel work

When two agents are working simultaneously, prefer splitting work by subsystem.

Safe parallel examples:

| Agent A | Agent B |
|---|---|
| `src/spotify/*` | `src/skins/*` |
| Tauri packaging | Playlist visual polish |
| Window docking | Spotify API mapping |
| Tests for Spotify services | `.wsz` compatibility fixtures |

Risky parallel examples:

| Agent A | Agent B |
|---|---|
| editing `useAmp99State.ts` | editing `useAmp99State.ts` |
| redesigning `PlaylistEditor.tsx` | wiring Spotify into `PlaylistEditor.tsx` |
| changing global CSS tokens | implementing pixel-perfect player CSS |
| changing package versions | adding features relying on current versions |

When unavoidable, nominate one branch as the owner and make the second task depend on it.

---

# 7. Product rules — classic player fidelity

AMP99 should preserve the recognizable classic desktop-player interaction model.

Default product shape:

1. **Main Player**
2. **Equalizer**
3. **Playlist Editor**

These are independent movable windows/panels that should dock/snap together and remember positions.

Do not introduce modern Spotify-style application chrome unless explicitly approved.

Avoid by default:

- permanent left navigation sidebars,
- large album cards,
- modern dashboard layouts,
- rounded SaaS cards,
- Spotify-green visual branding,
- mobile-first navigation patterns on the desktop experience.

Spotify capabilities should appear through classic player interactions, menus and playlist workflows.

Example:

```text
LIST OPTS
├── Spotify Playlists
├── Liked Songs
├── Create Spotify Playlist...
├── Load Winamp Skin...
└── Clear Playlist
```

The application may be technically modern. It should not *feel* modern in ways that destroy the premise.

---

# 8. Spotify integration rules

Use only documented, official Spotify developer APIs / SDKs for production code.

## Authentication

Use Authorization Code with PKCE.

Never commit:

- access tokens,
- refresh tokens,
- Spotify Client Secrets,
- user credentials,
- private test-account data.

Only a public Spotify Client ID may be configured in the client environment.

Environment-specific values belong in ignored `.env` files. Keep `.env.example` secret-free.

## Development-mode assumption

For the current phase, AMP99 is intentionally designed around Spotify Development Mode and its limited tester pool. Do not build hacks to bypass Spotify user limits.

## API isolation

Spotify network calls belong under `src/spotify/`.

UI components should consume normalized AMP99 domain models instead of raw Spotify JSON wherever practical.

Preferred flow:

```text
Spotify API response
        ↓
src/spotify mapper/service
        ↓
AMP99 Track / Playlist model
        ↓
state
        ↓
classic UI components
```

Do not scatter `fetch("https://api.spotify.com/...`)` calls across React components.

## Playback

Use official playback capabilities only.

Do not use reverse-engineered Spotify playback clients for the Microsoft Store product.

## Equalizer

The classic EQ UI may exist as part of the player experience, but do not process or alter Spotify audio unless Spotify's current platform rules explicitly permit it.

---

# 9. Playlist behavior

The Playlist Editor is a core AMP99 product surface, not an afterthought.

Planned Spotify workflow:

```text
LIST OPTS
→ Spotify Playlists
→ choose playlist
→ load tracks into classic Playlist Editor
```

Planned capabilities where the official Spotify API permits them:

- browse user's Spotify playlists,
- browse Liked Songs,
- create a playlist,
- load playlist tracks,
- add tracks,
- remove tracks,
- reorder tracks,
- rename/update owned playlists,
- search Spotify and add a result to an editable playlist.

Spotify permissions and 403/ownership restrictions must be represented honestly in the UI. Do not make an unsupported action look available and fail mysteriously after click.

---

# 10. `.wsz` skin compatibility

Legacy skin support is a first-class feature.

The goal is:

> A user should be able to select a compatible legacy Winamp `.wsz` file and have AMP99 render from the assets contained in that archive.

Current foundation recognizes assets such as:

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
pledit.bmp
pledit.txt
viscolor.txt
```

Rules:

- Do not bundle third-party legacy skins in the repository or installer.
- Keep the default AMP99 skin original to AMP99.
- Treat `.wsz` input as untrusted user content.
- Validate archive paths and file types.
- Prevent ZIP path traversal.
- Set sensible archive/file-size limits before production release.
- Revoke generated Blob URLs when no longer needed.
- Gracefully fall back when optional skin assets are missing.

Skin parsing and sprite mapping belong in `src/skins/`, not inside player components.

---

# 11. State architecture

`src/state/useAmp99State.ts` is currently a lightweight foundation, **not permission to turn it into a 2,000-line global god object**.

As features grow, separate concerns:

```text
window/layout state
playback state
playlist state
spotify session state
skin state
preferences
```

An agent planning a major state refactor must claim that work explicitly because it affects almost every subsystem.

Do not independently perform two competing state-management migrations.

Adding Zustand, Redux or another state library requires explicit approval unless the current architecture has clearly become inadequate and the migration is its own reviewed task.

---

# 12. Styling and pixel fidelity

The current CSS is foundation styling, not the final skin implementation.

Long-term direction:

- classic dimensions and proportions,
- sharp bitmap-style rendering,
- no accidental antialiasing of skin sprites,
- correct title bars and shade states,
- classic button states,
- authentic playlist density,
- correct docking behavior,
- 1x and 2x display modes.

Prefer reusable geometry/tokens/sprite metadata rather than hundreds of unexplained magic numbers.

When working on pixel fidelity, document the reference behavior being matched.

---

# 13. Security rules

Treat all external input as untrusted:

- `.wsz` files,
- Spotify API responses,
- playlist names,
- track metadata,
- URLs,
- Tauri commands.

Never expose unnecessary Tauri permissions.

Do not disable security controls globally just to make development easier.

Do not commit secrets, personal Spotify tokens or test-user credentials.

---

# 14. Dependency rules

Before adding a package, answer:

1. Why is it needed?
2. Can existing dependencies/platform APIs do the job?
3. Is it actively maintained?
4. Does it materially increase bundle/native complexity?
5. Does it create licensing problems for a free Microsoft Store app?

Do not upgrade unrelated dependencies inside a feature PR.

---

# 15. Definition of done

A feature is not done because code was generated.

At minimum:

- TypeScript compiles.
- Frontend build passes.
- Core interaction works.
- Existing behavior was not silently broken.
- Error state is handled.
- No secret is committed.
- Scope matches the claimed task.
- README / AGENTS / relevant docs are updated if architecture or setup changed.

For UI work, manually verify the relevant interaction and visual state.

For Spotify work, test at least:

- logged out,
- successful login,
- expired/invalid token path where practical,
- API error,
- empty data,
- success data.

For skin work, test at least:

- valid `.wsz`,
- invalid archive,
- missing required asset,
- optional missing assets,
- unusual uppercase/lowercase filenames.

---

# 16. Handoff protocol

Every agent must leave the repository understandable for the next agent.

At the end of a task/PR, include:

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

Do not rely on chat history as project documentation. Important implementation decisions belong in GitHub issues, PRs, code comments where appropriate, or repository docs.

---

# 17. Conflict-resolution rule

When instructions disagree, use this priority:

1. Explicit instruction from the repository owner for the current task.
2. Current `AGENTS.md`.
3. Accepted architecture/design decisions already merged to `main`.
4. Current task's GitHub issue/PR scope.
5. Agent preference.

Agent preference loses every time.

If a requirement is genuinely ambiguous and changing it would create substantial rework, record the ambiguity instead of guessing and rewriting architecture.

---

# 18. Current recommended parallelization

Until the architecture changes, the cleanest two-agent split is:

### Track A — Spotify / platform

Primary directories:

```text
src/spotify/
src-tauri/
```

Typical tasks:

- PKCE authentication,
- token lifecycle,
- Spotify API client,
- playlist mapping,
- Web Playback SDK,
- Windows media integration,
- packaging.

### Track B — Classic UI / skins

Primary directories:

```text
src/components/
src/skins/
```

Typical tasks:

- `.wsz` rendering,
- sprite map,
- main/equalizer/playlist fidelity,
- docking,
- shade mode,
- classic menus,
- 1x/2x rendering.

### Shared / high-conflict areas

Treat these as explicitly owned per task:

```text
src/App.tsx
src/state/
src/types/
src/styles.css
package.json
src-tauri/tauri.conf.json
```

Two agents should not make architectural changes in these areas at the same time.

---

# 19. Current priority backlog

Unless the repository owner changes priorities, the rough sequence is:

1. Stabilize the three-window desktop shell.
2. Implement correct window docking/snapping and persistence.
3. Implement real classic `.wsz` sprite rendering.
4. Implement Spotify PKCE login/session handling.
5. Implement Spotify API client and normalized models.
6. Load Spotify playlists / Liked Songs into Playlist Editor.
7. Implement official Spotify playback.
8. Implement create/add/remove/reorder playlist operations.
9. Improve classic window/menu fidelity and shade mode.
10. Add Windows media keys/system integration.
11. Harden skin-file handling and security.
12. Package and validate Microsoft Store build.

---

# 20. Final rule

**Do not optimize for how much code an agent can produce. Optimize for how safely the next contributor can continue.**

AMP99 should grow as one coherent product, not as two AI agents taking turns rebuilding each other's work.