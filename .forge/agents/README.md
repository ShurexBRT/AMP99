# AMP99 agent team

Repository-local execution team: Planner -> Builder -> Reviewer -> QA -> Runtime -> Release.

Product truth: native Windows Tauri desktop player with separate Main/EQ/Playlist windows, legacy `.wsz` support and Spotify integration. Browser fallback is not authoritative for native behavior.

All agents read root `AGENTS.md`, `.forge/project.json`, `.forge/agent-api.md`, and the Forge ticket before acting.
