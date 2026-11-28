#!/usr/bin/env node
/**
 * NeuraCLI entry — prefers Bun; falls back to `bunx` if bun is on PATH via npx shim.
 */
import { spawnSync } from "node:child_process"
import { constants } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "src", "cli.ts")
const args = process.argv.slice(2)

function run(cmd, cmdArgs) {
  return spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: process.cwd(), env: process.env })
}

let command = "bun"
let result = run(command, [cli, ...args])
if (result.error?.code === "ENOENT") {
  command = "bunx"
  result = run(command, ["bun", cli, ...args])
}

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error("NeuraCLI requires Bun >= 1.1. Install: https://bun.sh — then rerun `neura`.")
  } else {
    console.error(`Could not start ${command} (${result.error.code ?? "unknown error"}).`)
  }
  process.exitCode = 1
} else if (result.signal) {
  const number = constants.signals[result.signal]
  process.exitCode = number ? 128 + number : 1
  // Let POSIX callers observe the same termination signal as the child.
  if (process.platform !== "win32") {
    try {
      process.kill(process.pid, result.signal)
    } catch {
      // Some signals cannot be raised by the wrapper. Preserve the exit code.
    }
  }
} else {
  process.exitCode = result.status ?? 1
}
