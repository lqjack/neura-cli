#!/usr/bin/env bash
# Demo 3 — CI-friendly JSON (marketing ~60s)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${NEURA_CLI_BIN:-bun run neura}"
cd "$ROOT"

# shellcheck disable=SC1091
source "$(dirname "$0")/setup-env.sh"

echo "══ NeuraCLI Demo 3: --json for CI ══"

OUT=$($CLI send "Summarize one-line collab smoke test" --json --timeout 120 --poll 2)
echo "$OUT" | head -c 2000
echo ""
echo "… (truncated for demo)"

TASK_ID=$(echo "$OUT" | bun -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).submit?.taskId??JSON.parse(s).taskId??'')}catch{}})" 2>/dev/null || true)
if [[ -n "$TASK_ID" ]]; then
  echo "taskId=$TASK_ID"
fi
