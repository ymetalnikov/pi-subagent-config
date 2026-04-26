# Pi Subagent Config (Repo-managed)

Repository layout for keeping Pi global behavior in version control and installing it into `~/.pi/agent`.

## What is included

- `.pi/AGENTS.md`
  - Global policy: delegate-first to `sub_agent`.
- `.pi/extensions/routed-sub-agents.ts`
  - Routed `sub_agent` tool with:
    - role-based model routing,
    - model fallback chain,
    - 10-second live status updates with token/cost,
    - cumulative subagent spend status in footer.
- `.pi/extensions/context-usage-icon.ts`
  - Context indicator (`🟢/🟡/🔴`) in footer by token usage.
- `scripts/install.sh`
  - Installs files into `~/.pi/agent` (copy or symlink mode).
- `scripts/setup-claude-profile.sh`
  - Persists `PI_SUBAGENT_PROFILE=claude-only` in shell rc.

---

## Pi version compatibility

### Tested

- ✅ **Pi 0.70.2**

### Expected to work

- 🟡 **Pi 0.68.x – 0.70.x** (same extension API surface for this use-case)

### Not guaranteed

- ⚠️ **Pi < 0.68**
  - Could fail due to extension API differences (`execute` callback shape, UI status APIs, JSON event structure).

If something breaks, first check:

```bash
pi -v
```

---

## Installation

### 1) Clone/copy this repo

Example:

```bash
cd ~/Projects
git clone <your-repo-url> pi-subagent-config
cd pi-subagent-config
```

### 2) Install into global Pi config

#### Option A: copy files (stable)

```bash
./scripts/install.sh --copy
```

#### Option B: symlink files (best for active edits)

```bash
./scripts/install.sh --link
```

`install.sh` automatically creates timestamp backups for replaced files.

### 3) Reload Pi

In running Pi session:

```text
/reload
```

or restart Pi process.

---

## Claude-only setup (no Codex account)

### One-time persistent setup

```bash
./scripts/setup-claude-profile.sh
source ~/.zshrc   # or ~/.bashrc
```

### Or one-off per shell

```bash
export PI_SUBAGENT_PROFILE=claude-only
```

Then run in Pi:

```text
/reload
```

---

## Verify

In Pi, run:

```text
/sub-agent-route
```

You should see model chains per mode + active profile.

During long `sub_agent` calls you should see:

- live status every ~10s (`🟢/🟡/🔴`, tokens, current cost),
- cumulative status line like `🤖 subagents: $X.XXXX · N calls`.

---

## Team usage pattern

Recommended to keep this repo as source of truth and deploy from CI/bootstrap:

- dev machines: `./scripts/install.sh --link` for fast iteration;
- teammates: `./scripts/install.sh --copy` for stable setup.

If you need project-specific overrides, keep those in project-local `.pi/` and leave global `~/.pi/agent` minimal.
