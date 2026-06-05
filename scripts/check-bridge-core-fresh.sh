#!/usr/bin/env bash
#
# CI / pre-commit gate: fail if the vendored @aion-health/core is stale relative
# to the source of truth (aion-web/src/services/bridge/shared). Re-runs the sync
# and checks whether it changed anything tracked under vendor/.
#
# Usage:  ./scripts/check-bridge-core-fresh.sh   (from aion-open/)
#
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$HERE/scripts/sync-bridge-core.sh"

if ! git -C "$HERE" diff --quiet -- vendor/; then
  echo "" >&2
  echo "error: vendored @aion-health/core is STALE." >&2
  echo "       shared/ changed but vendor/ wasn't re-synced + committed." >&2
  echo "       Run: (cd ../aion-web/src/services/bridge/shared && npm run build) && npm run sync:core" >&2
  echo "       then commit the vendor/ changes." >&2
  exit 1
fi
echo "vendored @aion-health/core is up to date."
