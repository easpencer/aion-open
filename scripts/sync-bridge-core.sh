#!/usr/bin/env bash
#
# Sync the compiled @aion-health/core into aion-open's vendored copy.
#
# aion-open vendors the shared bridge library so it is fully self-contained:
# Railway builds with context = aion-open/, and the repo can later be extracted
# without a sibling aion-web/ checkout. The vendored copy is COMMITTED source,
# not a build artifact.
#
# Run this at commit time whenever shared/ changes — NEVER inside the Railway
# build (that would reintroduce the cross-directory dependency this removes).
#
# Usage:  ./scripts/sync-bridge-core.sh         (from aion-open/)
#         npm run sync:core
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"           # aion-open/
SRC="$HERE/../aion-web/src/services/bridge/shared"                 # source of truth
DEST="$HERE/vendor/aion-health-core"

if [ ! -d "$SRC/dist" ]; then
  echo "error: $SRC/dist not found. Build the shared lib first:" >&2
  echo "       (cd $SRC && npm run build)" >&2
  exit 1
fi

echo "Syncing @aion-health/core → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy the compiled output and the package.json. The package.json is REQUIRED:
# it declares "type":"commonjs" so Node parses the vendored CJS dist correctly
# under aion-open's own "type":"module".
cp -R "$SRC/dist" "$DEST/dist"
cp "$SRC/package.json" "$DEST/package.json"

VER="$(node -e "console.log(require('$DEST/package.json').version)")"
echo "Synced @aion-health/core@$VER ($(find "$DEST/dist" -name '*.js' | wc -l | tr -d ' ') js files)"
