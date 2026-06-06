#!/usr/bin/env bash
# Demo 2 — software delivery with --repo (marketing ~120s)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${NEURA_CLI_BIN:-bun run neura}"
cd "$ROOT"

# shellcheck disable=SC1091
source "$(dirname "$0")/setup-env.sh"
REPO="${NEURA_DEMO_REPO:-octocat/Hello-World}"

echo "══ NeuraCLI Demo 2: repo-bound software goal ══"
echo "Repo: $REPO"
echo ""

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  $CLI repo ensure "$REPO" || true
fi

$CLI send --repo "$REPO" \
  "Software: skim README and list 3 release risks before merge" \
  --force-run \
  --timeout 300 \
  --poll 2
