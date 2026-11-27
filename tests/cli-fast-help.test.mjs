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

test("positional help works without the integration modules and matches full help", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-help-"))
  try {
    mkdirSync(path.join(temp, "src/lib/neura"), { recursive: true })
    copyFileSync(path.join(root, "src/cli.ts"), path.join(temp, "src/cli.ts"))
    copyFileSync(path.join(root, "src/cli-help.ts"), path.join(temp, "src/cli-help.ts"))
    copyFileSync(path.join(root, "src/lib/neura/branding.ts"), path.join(temp, "src/lib/neura/branding.ts"))
    const fast = invoke(path.join(temp, "src/cli.ts"), ["help"], temp)
    const full = invoke(path.join(root, "src/cli-full.ts"), ["help"], temp)
    assert.equal(fast.status, 0)
    assert.equal(fast.stderr, "")
    assert.match(fast.stdout, /NeuraCLI/)
    assert.deepEqual(fast, full)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test("nonfast arguments retain the full entry's behavior", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "neura-full-"))
  try {
    for (const args of [[], ["--help"], ["bogus"], ["help", "extra"]]) {
      assert.deepEqual(invoke(path.join(root, "src/cli.ts"), args, temp),
        invoke(path.join(root, "src/cli-full.ts"), args, temp))
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
