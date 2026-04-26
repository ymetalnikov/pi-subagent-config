# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-26

### Added
- Initial repo structure for repo-managed Pi configuration.
- Global policy file: `.pi/AGENTS.md`.
- Extension: `.pi/extensions/routed-sub-agents.ts` with:
  - role-based subagent routing,
  - model fallback chains,
  - `PI_SUBAGENT_PROFILE` support (`default`, `claude-only`),
  - 10-second live token/cost status updates,
  - cumulative subagent spend status.
- Extension: `.pi/extensions/context-usage-icon.ts` (`🟢/🟡/🔴` context indicator).
- Installer script: `scripts/install.sh` (`--copy` / `--link`).
- Claude profile helper: `scripts/setup-claude-profile.sh`.
- Setup docs in `README.md` including version compatibility guidance.
