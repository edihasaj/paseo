#!/usr/bin/env bash
# Fix workspace-local lockfile entries and update its reviewed Nix input hash.
# Requires: node, npm
#
# Usage:
#   ./scripts/update-nix.sh          # fix lockfile + update hash
#   ./scripts/update-nix.sh --check  # verify everything is up to date (CI mode)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCK_FILE="$ROOT_DIR/package-lock.json"
HASH_FILE="$ROOT_DIR/nix/npm-deps.hash"

CHECK_MODE=false
case "${1:-}" in
  "") ;;
  --check) CHECK_MODE=true ;;
  *)
    echo "Usage: $0 [--check]" >&2
    exit 2
    ;;
esac

TEMP_LOCK_FILE=""

cleanup() {
  [[ -z "$TEMP_LOCK_FILE" ]] || rm -f "$TEMP_LOCK_FILE"
}
trap cleanup EXIT

# 1. Fix lockfile (add resolved/integrity for workspace-local entries)
#    Workaround for https://github.com/npm/cli/issues/4460
if $CHECK_MODE; then
  echo "Checking lockfile..."
  TEMP_LOCK_FILE="$(mktemp)"
  cp "$LOCK_FILE" "$TEMP_LOCK_FILE"
  node "$SCRIPT_DIR/fix-lockfile.mjs" "$TEMP_LOCK_FILE"

  if ! cmp -s "$LOCK_FILE" "$TEMP_LOCK_FILE"; then
    echo "ERROR: package-lock.json is stale." >&2
    diff -u "$LOCK_FILE" "$TEMP_LOCK_FILE" || true
    echo "Run ./scripts/update-nix.sh to fix." >&2
    exit 1
  fi
else
  echo "Fixing lockfile..."
  node "$SCRIPT_DIR/fix-lockfile.mjs" "$LOCK_FILE"
fi

# 2. Hash the normalized dependency input. importNpmLock verifies each fetched
#    package against the integrity recorded in package-lock.json; this sidecar
#    makes any lockfile change an explicit, reviewable repository change.
echo "Hashing normalized lockfile..."
NEW_HASH="$(shasum -a 256 "$LOCK_FILE" | awk '{print $1}')"
echo "Computed hash: $NEW_HASH"

# 3. Read current hash from the sidecar file
CURRENT_HASH="$(tr -d '[:space:]' < "$HASH_FILE")"

if [[ "$NEW_HASH" == "$CURRENT_HASH" ]]; then
  echo "Hash is already up to date."
else
  if $CHECK_MODE; then
    echo "ERROR: Nix lockfile hash is stale."
    echo "  current: $CURRENT_HASH"
    echo "  correct: $NEW_HASH"
    echo "Run ./scripts/update-nix.sh to fix."
    exit 1
  fi

  echo "Updating nix/npm-deps.hash..."
  printf '%s\n' "$NEW_HASH" > "$HASH_FILE"
  echo "Updated: $CURRENT_HASH -> $NEW_HASH"
fi
