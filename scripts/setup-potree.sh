#!/usr/bin/env bash
# Thin wrapper — delegates to the cross-platform Node script so we have one source of truth.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${SCRIPT_DIR}/setup-potree.mjs" "$@"
