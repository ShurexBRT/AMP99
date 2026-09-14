# AMP99 Project Context

- ChatGPT Project: AMP99
- Forge key: AMP
- Repository: ShurexBRT/AMP99
- Code truth: GitHub repository
- Work truth: Forge tickets
- Knowledge/product context: ChatGPT Project `AMP99`
- Product direction: Defined
- Escalation: Agent -> Orchestrator -> PM -> Owner

## Product truth
AMP99 is a native-feeling Tauri Windows desktop music player with separate Main, Equalizer and Playlist windows plus Preferences. It supports local/Spotify playback and Winamp-style skin workflows.

## Mandatory execution context
Root `AGENTS.md` is authoritative for native Windows/Tauri collaboration rules. Forge adds ticket state, ownership and handoff coordination but never weakens Windows runtime, installer, Store, updater, Spotify or WSZ validation gates.

## Product decision rule
Do not turn AMP99 into a web dashboard or broaden it into unrelated media/productivity scope. Major changes to native windowing, skinning, Spotify architecture or distribution require PM/owner decision.
