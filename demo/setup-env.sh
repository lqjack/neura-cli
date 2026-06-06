#!/usr/bin/env bash
# Load NEURA_* for demos — reuses llm-gateway config/neura-cli.env when present.
set -euo pipefail

if [[ -n "${NEURA_API_KEY:-}" && -n "${NEURA_SERVER_URL:-}" ]]; then
  echo "[setup-env] NEURA_* already set"
  exit 0
fi

CANDIDATES=(
  "${NEURA_CLI_ENV:-}"
  "$HOME/llm-gateway/config/neura-cli.env"
  "$HOME/Desktop/llm-gateway/config/neura-cli.env"
  "$(cd "$(dirname "$0")/../../.." && pwd)/config/neura-cli.env"
)

for f in "${CANDIDATES[@]}"; do
  [[ -n "$f" && -f "$f" ]] || continue
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  echo "[setup-env] loaded $f"
  echo "[setup-env] NEURA_SERVER_URL=${NEURA_SERVER_URL:-<unset>}"
  exit 0
done

echo "Set NEURA_API_KEY + NEURA_SERVER_URL, or place config at ~/llm-gateway/config/neura-cli.env"
exit 1
