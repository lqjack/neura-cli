import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import path from "path"
import { loadNeuraCliEnv } from "./load-cli-env"

describe("loadNeuraCliEnv", () => {
  const prev = { ...process.env }

  afterEach(() => {
    process.env = { ...prev }
  })

  test("loads NEURA_API_KEY from config/neura-cli.env", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "neura-cli-env-"))
    mkdirSync(path.join(dir, "config"), { recursive: true })
    writeFileSync(
      path.join(dir, "config", "neura-cli.env"),
      "NEURA_API_KEY=gw-from-file\nNEURA_SERVER_URL=https://example.com\n",
    )
    delete process.env.NEURA_API_KEY
    delete process.env.NEURA_SERVER_URL
    loadNeuraCliEnv(dir)
    expect(process.env.NEURA_API_KEY).toBe("gw-from-file")
    expect(process.env.NEURA_SERVER_URL).toBe("https://example.com")
  })

  test("does not override existing NEURA_API_KEY", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "neura-cli-env-"))
    mkdirSync(path.join(dir, "config"), { recursive: true })
    writeFileSync(path.join(dir, "config", "neura-cli.env"), "NEURA_API_KEY=gw-file\n")
    process.env.NEURA_API_KEY = "gw-existing"
    loadNeuraCliEnv(dir)
    expect(process.env.NEURA_API_KEY).toBe("gw-existing")
  })
})
