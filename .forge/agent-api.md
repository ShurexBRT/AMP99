# Forge agent runtime

Project key: `AMP`
Gateway: `https://yljhffprkprbgjdaarqi.supabase.co/functions/v1/agent-gateway`
Secret: `FORGE_AGENT_TOKEN`

Root `AGENTS.md` remains authoritative for AMP99 product/runtime rules. Forge coordinates ticket state and handoffs only.

Standard loop: `next_ticket` -> `claim` -> work -> `handoff`.

Use `decision_request` instead of inventing native UX/product decisions. Never use browser-only evidence to bypass Tauri/Windows validation, and never store or print the raw agent token.

Gateway details and handoff schema are documented in the Forge repository under `docs/AGENT-GATEWAY.md`.