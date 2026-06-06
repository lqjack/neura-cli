#!/usr/bin/env bash
# Demo 1 — MCN business goal (marketing asciinema ~90s)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${NEURA_CLI_BIN:-bun run neura}"
cd "$ROOT"

# shellcheck disable=SC1091
source "$(dirname "$0")/setup-env.sh"

echo "══ NeuraCLI Demo 1: MCN goal ══"
echo "Server: $NEURA_SERVER_URL"
echo ""

$CLI send \
  "MCN incubation: analyze top 3 competitor hooks in skincare vertical; output bullet summary" \
  --timeout 180 \
  --poll 2

echo ""
echo "→ Open deskPath from output for approval / structured cards"
