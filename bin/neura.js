#!/usr/bin/env node
/**
 * NeuraCLI entry — prefers Bun; falls back to `bunx` if bun is on PATH via npx shim.
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "src", "cli.ts")
const args = process.argv.slice(2)

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: process.cwd(), env: process.env })
  if (r.error) return { ok: false, error: r.error.message }
  return { ok: r.status === 0, status: r.status ?? 1 }
}

let result = run("bun", [cli, ...args])
if (!result.ok && result.error?.includes("ENOENT")) {
  result = run("bunx", ["bun", cli, ...args])
}
if (!result.ok) {
  console.error(
    "NeuraCLI requires Bun >= 1.1. Install: https://bun.sh — then rerun `neura`.",
  )
  process.exit(result.status ?? 1)
}
