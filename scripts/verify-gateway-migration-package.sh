#!/usr/bin/env bash
# Offline package verification; optional install stays inside the temporary directory.
set -eu
smoke=false
dependency_archives=()
if [ "${1:-}" = "--smoke" ]; then
  smoke=true
  shift
  [ "$#" -gt 0 ] || { echo 'Smoke test requires local dependency tarballs' >&2; exit 2; }
  command -v bun >/dev/null || { echo 'Smoke test requires Bun on PATH' >&2; exit 2; }
  for archive in "$@"; do
    case "$archive" in *.tgz) ;; *) echo 'Expected a local .tgz dependency archive' >&2; exit 2;; esac
    [ -f "$archive" ] || { printf 'Missing dependency archive: %s\n' "$archive" >&2; exit 2; }
    dependency_archives+=("$(node -p 'require("node:path").resolve(process.argv[1])' -- "$archive")")
  done
elif [ "$#" -ne 0 ]; then
  echo 'Usage: verify-gateway-migration-package.sh [--smoke <local-dependency.tgz> ...]' >&2
  exit 2
fi
repo="$(cd -- "$(dirname -- "$0")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir "$scratch/one" "$scratch/two" "$scratch/cache"
cd "$repo"
name="$(node -p 'require("./package.json").name')"
test "$name" = '@neuradesk/cli'
for dir in one two; do
  npm_config_cache="$scratch/cache" npm pack --offline --ignore-scripts --json --pack-destination "$scratch/$dir" >"$scratch/$dir/result.json"
done
filename="$(node -p 'require(process.argv[1])[0].filename' "$scratch/one/result.json")"
case "$filename" in neuradesk-cli-*.tgz) ;; *) echo 'Unexpected npm archive name' >&2; exit 1;; esac
cmp -- "$scratch/one/$filename" "$scratch/two/$filename"
node - "$scratch/one/result.json" "$scratch/one/$filename" <<'JS'
const [manifest, archive] = process.argv.slice(2);
const fs = require('node:fs'), crypto = require('node:crypto');
const [p] = JSON.parse(fs.readFileSync(manifest, 'utf8'));
for (const path of ['package.json','bin/neura.js','tsconfig.json','src/cli.ts','src/lib/neura-cli/send-client.ts']) {
  if (!p.files.some(file => file.path === path)) throw Error('missing package entry: ' + path);
}
const digest = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
console.log(JSON.stringify({ name: p.name, version: p.version, digest, files: p.files.length }));
JS

if [ "$smoke" = true ]; then
  mkdir "$scratch/home" "$scratch/install"
  # Clear credentials, project/user config and runtime overrides. Install only
  # local tarballs, then exercise npm's installed bin from an unrelated cwd.
  (
    cd "$scratch/home"
    env -i PATH="$PATH" HOME="$scratch/home" npm_config_cache="$scratch/cache" \
      npm --prefix "$scratch/install" install --offline --ignore-scripts --no-audit --no-fund \
      --no-package-lock "$scratch/one/$filename" "${dependency_archives[@]}" >&2
    env -i PATH="$PATH" HOME="$scratch/home" "$scratch/install/node_modules/.bin/neura" help >"$scratch/help.txt"
  )
  grep -Fx 'NeuraCLI' "$scratch/help.txt" >/dev/null
  grep -F '  send <message>' "$scratch/help.txt" >/dev/null
  printf '%s\n' '{"installedCliSmoke":"passed"}'
fi
