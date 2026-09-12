# AMP99 ↔ Forge bridge

AMP99 keeps its existing root `AGENTS.md` as the authoritative repository-specific collaboration contract.

Forge adds only the work-truth layer:

- ticket identity uses the `AMP-<n>` project key;
- ticket scope and acceptance criteria come from Forge;
- branch/PR work still follows the existing AMP99 collaboration rules;
- Planner, Builder, Reviewer, QA, Browser/Runtime and Release handoffs should be written back to the Forge ticket;
- Forge must never be used to bypass AMP99's Windows-native CI, Tauri/runtime checks, version consistency, installer smoke tests or physical QA requirements.

Until Forge Cloud is connected, existing GitHub `[CLAIM]` issues and PR handoffs remain the temporary work-truth mechanism.

When the two documents differ, root `AGENTS.md` wins on AMP99 product/runtime constraints. Forge wins only for ticket state and cross-agent handoff coordination.
