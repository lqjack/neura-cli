#!/usr/bin/env bash
# Load NEURA_* for demos — reuses llm-gateway config/neura-cli.env for API key.
set -euo pipefail

if [[ -n "${NEURA_API_KEY:-}" ]]; then
  export NEURA_SERVER_URL="${NEURA_SERVER_URL:-${NEURA_DEMO_SERVER_URL:-https://gateway.datapro.asia}}"
  echo "[setup-env] NEURA_API_KEY already set; server=$NEURA_SERVER_URL"
  return 0 2>/dev/null || exit 0
fi

CANDIDATES=(
  "${NEURA_CLI_ENV:-}"
  "$HOME/llm-gateway/config/neura-cli.env"
  "$HOME/Desktop/llm-gateway/config/neura-cli.env"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ENV="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd)/config/neura-cli.env"
if [[ -f "$MONOREPO_ENV" ]]; then
  CANDIDATES+=("$MONOREPO_ENV")
fi

for f in "${CANDIDATES[@]}"; do
  [[ -n "$f" && -f "$f" ]] || continue
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  if [[ -z "${NEURA_KEEP_LOCAL_SERVER:-}" ]]; then
    export NEURA_SERVER_URL="${NEURA_DEMO_SERVER_URL:-https://gateway.datapro.asia}"
  fi
  echo "[setup-env] loaded $f"
  echo "[setup-env] NEURA_SERVER_URL=$NEURA_SERVER_URL"
  return 0 2>/dev/null || exit 0
done

echo "Set NEURA_API_KEY, or place config at ~/llm-gateway/config/neura-cli.env"
return 1 2>/dev/null || exit 1
