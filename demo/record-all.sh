#!/usr/bin/env bash
# Record all demos with asciinema (requires: asciinema, NEURA_* env)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

for script in 01-send-mcn.sh 02-send-repo-software.sh 03-send-json-ci.sh; do
  base="${script%.sh}"
  echo "Recording $script → /tmp/neura-cli-${base}.cast"
  asciinema rec -c "bash $DIR/$script" -t "NeuraCLI: $base"
done

echo "Upload: asciinema upload /tmp/neura-cli-01-send-mcn.cast"
