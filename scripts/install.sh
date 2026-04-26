#!/usr/bin/env bash
set -euo pipefail

# Installs repo-managed Pi config into ~/.pi/agent
# Usage:
#   ./scripts/install.sh                 # copy mode
#   ./scripts/install.sh --link          # symlink mode (recommended for active development)
#   ./scripts/install.sh --profile claude-only

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_HOME="${HOME}/.pi/agent"
SRC_PI_DIR="${ROOT_DIR}/.pi"
EXT_DIR="${PI_HOME}/extensions"

MODE="copy"
PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --link)
      MODE="link"
      shift
      ;;
    --copy)
      MODE="copy"
      shift
      ;;
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$PI_HOME" "$EXT_DIR"

backup_if_exists() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    local backup="${path}.bak.$(date +%Y%m%d-%H%M%S)"
    mv "$path" "$backup"
    echo "Backed up: $path -> $backup"
  fi
}

install_file() {
  local src="$1"
  local dst="$2"
  backup_if_exists "$dst"
  if [[ "$MODE" == "link" ]]; then
    ln -s "$src" "$dst"
    echo "Linked: $dst -> $src"
  else
    cp "$src" "$dst"
    echo "Copied: $src -> $dst"
  fi
}

install_file "${SRC_PI_DIR}/AGENTS.md" "${PI_HOME}/AGENTS.md"
install_file "${SRC_PI_DIR}/extensions/routed-sub-agents.ts" "${EXT_DIR}/routed-sub-agents.ts"
install_file "${SRC_PI_DIR}/extensions/context-usage-icon.ts" "${EXT_DIR}/context-usage-icon.ts"

if [[ -n "$PROFILE" ]]; then
  case "$PROFILE" in
    claude-only|default)
      echo
      echo "Set this env var in your shell:"
      echo "  export PI_SUBAGENT_PROFILE=${PROFILE}"
      ;;
    *)
      echo "Unsupported profile: $PROFILE (allowed: default, claude-only)" >&2
      exit 1
      ;;
  esac
fi

echo
echo "Done. Restart pi or run /reload in active session."
