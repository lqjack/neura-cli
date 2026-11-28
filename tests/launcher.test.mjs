import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const launcher = fileURLToPath(new URL("../bin/neura.js", import.meta.url))
const posix = process.platform === "win32" ? { skip: "POSIX executable fixture" } : {}

function run(commands, args = ["help"]) {
  const dir = mkdtempSync(path.join(tmpdir(), "neura-launcher-"))
  try {
    for (const [name, [body, mode = 0o755, interpreter = "/bin/sh"]] of Object.entries(commands)) {
      const file = path.join(dir, name)
      writeFileSync(file, `#!${typeof interpreter === "function" ? interpreter(dir) : interpreter}\n` + body)
      chmodSync(file, mode)
    }
    const r = spawnSync(process.execPath, [launcher, ...args], {
      env: { PATH: dir, HOME: dir }, cwd: dir, encoding: "utf8", timeout: 5000,
    })
    assert.ifError(r.error)
    return r
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const code of [0, 1, 2]) {
  test(`preserves child exit ${code} and stderr without triggering bunx`, posix, () => {
    const out = run({ bun: [`echo child-out; echo child-message >&2; exit ${code}`], bunx: ["echo unexpected; exit 99"] })
    assert.equal(out.status, code)
    assert.equal(out.stdout, "child-out\n")
    assert.equal(out.stderr, "child-message\n")
  })
}

test("absent Bun falls back and forwards the original arguments", posix, () => {
  const out = run({ bunx: ['[ "$1" = bun ] && [ -z "${4-}" ] && [ "$3" = "two words" ] || exit 97; echo fallback; exit 2'] }, ["two words"])
  assert.equal(out.status, 2)
  assert.equal(out.stdout, "fallback\n")
  assert.equal(out.stderr, "")
})

test("Bun with a missing interpreter falls back on spawn ENOENT", posix, () => {
  const out = run({
    bun: ["echo must-not-run; exit 99", 0o755, dir => path.join(dir, "missing-interpreter")],
    bunx: ['[ "$1" = bun ] && [ "$3" = "two words" ] && [ -z "${4-}" ] || exit 97; echo fallback; exit 2'],
  }, ["two words"])
  assert.equal(out.status, 2)
  assert.equal(out.signal, null)
  assert.equal(out.stdout, "fallback\n")
  assert.equal(out.stderr, "")
})

test("diagnoses both missing launchers", posix, () => {
  const out = run({})
  assert.equal(out.status, 1)
  assert.match(out.stderr, /requires Bun/)
})

test("inaccessible Bun is not missing and never falls back", posix, () => {
  const out = run({ bun: ["exit 0", 0o644], bunx: ["echo unexpected; exit 99"] })
  assert.equal(out.status, 1)
  assert.equal(out.stdout, "")
  assert.match(out.stderr, /Could not start bun \(EACCES\)/)
  assert.doesNotMatch(out.stderr, /requires Bun/)
})

test("propagates child SIGINT without disguising it as missing Bun", posix, () => {
  const out = run({ bun: ['kill -s INT "$$"'], bunx: ["echo unexpected; exit 99"] })
  assert.equal(out.signal, "SIGINT")
  assert.equal(out.status, null)
  assert.equal(out.stdout, "")
  assert.equal(out.stderr, "")
})
