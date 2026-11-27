#!/usr/bin/env bash
# Read-only package preparation: never publishes, installs, or changes tags.
set -eu
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
