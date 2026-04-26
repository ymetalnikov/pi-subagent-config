#!/usr/bin/env bash
set -euo pipefail

PROFILE_LINE='export PI_SUBAGENT_PROFILE=claude-only'
SHELL_RC="$HOME/.zshrc"
if [[ -n "${SHELL:-}" && "$SHELL" == *"bash"* ]]; then
  SHELL_RC="$HOME/.bashrc"
fi

if ! grep -Fq "$PROFILE_LINE" "$SHELL_RC" 2>/dev/null; then
  echo "$PROFILE_LINE" >> "$SHELL_RC"
  echo "Added to $SHELL_RC: $PROFILE_LINE"
else
  echo "Already present in $SHELL_RC"
fi

echo "Run: source $SHELL_RC"
echo "Then run in pi: /reload"
