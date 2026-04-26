# Contributing

Thanks for contributing.

## Scope
This repo stores Pi configuration meant to be installed into `~/.pi/agent`:
- `.pi/AGENTS.md`
- `.pi/extensions/*.ts`
- `scripts/*.sh`
- docs

## Local test flow
1. Install in symlink mode:
   ```bash
   ./scripts/install.sh --link
   ```
2. Start `pi` and run:
   ```text
   /reload
   /sub-agent-route
   ```
3. Smoke test:
   - run one `sub_agent` task,
   - verify live status updates every ~10s,
   - verify cumulative spend status line,
   - verify fallback behavior by selecting a model not available in your environment.

## Versioning
- Use SemVer tags: `vMAJOR.MINOR.PATCH`.
- Update `CHANGELOG.md` for each release.
- Keep `README.md` compatibility notes in sync.

## Commit conventions (recommended)
- `feat:` new behavior
- `fix:` bug fix
- `docs:` documentation only
- `chore:` maintenance

## Security / privacy
- Never commit credentials (`auth.json`, API keys, tokens).
- Keep machine-local secrets out of this repo.
