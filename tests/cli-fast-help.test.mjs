import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const invoke = (entry, args, cwd) => {
  const p = spawnSync(process.env.BUN_BIN ?? "bun", [entry, ...args], {
    cwd, env: { PATH: process.env.PATH, HOME: cwd, USERPROFILE: cwd },
    encoding: "utf8", timeout: 5000,
  })
  assert.ifError(p.error)
  return { status: p.status, stdout: p.stdout, stderr: p.stderr }
}

test("top-level help aliases work without the integration modules and match full help", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-help-"))
  try {
    mkdirSync(path.join(temp, "src/lib/neura"), { recursive: true })
    copyFileSync(path.join(root, "src/cli.ts"), path.join(temp, "src/cli.ts"))
    copyFileSync(path.join(root, "src/cli-help.ts"), path.join(temp, "src/cli-help.ts"))
    copyFileSync(path.join(root, "src/lib/neura/branding.ts"), path.join(temp, "src/lib/neura/branding.ts"))
    const full = invoke(path.join(root, "src/cli-full.ts"), ["help"], temp)
    assert.equal(full.status, 0)
    assert.equal(full.stderr, "")
    assert.match(full.stdout, /NeuraCLI/)
    for (const arg of ["help", "--help", "-h"]) {
      const fast = invoke(path.join(temp, "src/cli.ts"), [arg], temp)
      assert.deepEqual(fast, full, `top-level ${arg}`)
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test("nonfast arguments retain the full entry's behavior", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-full-"))
  try {
    for (const args of [[], ["bogus"], ["send"], ["send", "--help"], ["task", "action"], ["help", "extra"], ["--help", "extra"], ["-h", "extra"]]) {
      assert.deepEqual(invoke(path.join(root, "src/cli.ts"), args, temp),
        invoke(path.join(root, "src/cli-full.ts"), args, temp))
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test("subcommand help does not consume or dispatch following arguments", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-subcommand-help-"))
  try {
    const entry = path.join(root, "src/cli.ts")
    const expected = invoke(entry, ["help"], temp)
    assert.equal(expected.status, 0)
    assert.equal(expected.stderr, "")
    assert.match(expected.stdout, /NeuraCLI/)
    for (const args of [
      ["connector", "list", "--help", "fixture"],
      ["connector", "--help", "list"],
      ["connector", "list", "-h"],
      ["connector", "-h", "list"],
    ]) {
      assert.deepEqual(invoke(entry, args, temp), expected, args.join(" "))
    }
    assert.deepEqual(invoke(entry, ["connector", "list", "--plugin", "missing-fixture", "--json"], temp),
      { status: 0, stdout: "null\n", stderr: "" })
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test("the end-of-options marker preserves literal option-looking arguments", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-option-end-"))
  try {
    const entry = path.join(root, "src/cli.ts")
    const list = ["connector", "list", "--plugin", "missing-fixture"]
    const ordinary = invoke(entry, list, temp)
    assert.equal(ordinary.status, 0)
    assert.equal(ordinary.stdout, "")
    assert.match(ordinary.stderr, /catalog \(missing-fixture\)/)
    for (const token of ["--help", "-h", "--json"]) {
      assert.deepEqual(invoke(entry, [...list, "--json", "--", token], temp),
        { status: 0, stdout: "null\n", stderr: "" }, token)
    }
    assert.deepEqual(invoke(entry, [...list, "--", "--json"], temp), ordinary)
    assert.deepEqual(invoke(entry, [...list, "--help", "--", "literal"], temp), invoke(entry, ["help"], temp))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
