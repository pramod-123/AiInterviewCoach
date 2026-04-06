#!/usr/bin/env bash
# Copy consumer install data (SQLite + live-sessions + uploads) into this repo's server/data
# so dev API/extension see the same sessions as ~/.local/share/ai-interview-copilot (or $AI_INTERVIEW_COPILOT_HOME).
#
# Prereq: stop the dev server (and any tool holding server/data/app.db open).
#
# Usage:
#   ./scripts/sync-installed-data-to-workspace.sh
#   AI_INTERVIEW_COPILOT_HOME=/path/to/prefix ./scripts/sync-installed-data-to-workspace.sh

set -euo pipefail

SERVER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${AI_INTERVIEW_COPILOT_HOME:-${HOME}/.local/share/ai-interview-copilot}/data"
DEST="${SERVER_ROOT}/data"

if [[ ! -d "$SRC" ]]; then
  echo "sync-installed-data: missing source directory: $SRC" >&2
  echo "Set AI_INTERVIEW_COPILOT_HOME to your install prefix if it is not the default." >&2
  exit 1
fi

if [[ ! -f "${SRC}/app.db" ]]; then
  echo "sync-installed-data: no app.db under $SRC" >&2
  exit 1
fi

BACKUP="${SERVER_ROOT}/data.backup-$(date +%Y%m%d-%H%M%S)"
if [[ -d "$DEST" ]]; then
  mv "$DEST" "$BACKUP"
  echo "sync-installed-data: backed up previous data to $BACKUP"
fi

mkdir -p "$DEST"
cp -a "${SRC}/." "$DEST/"
echo "sync-installed-data: copied $SRC -> $DEST"
ls -la "$DEST"
