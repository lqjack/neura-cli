import { describe, expect, test } from "bun:test"
import { getOpencliStatus } from "./opencli"
import { resolveWxInvocation } from "./wx-direct"

describe("opencli helpers", () => {
  test("getOpencliStatus returns shape", () => {
    const s = getOpencliStatus()
    expect(s).toHaveProperty("opencli")
    expect(s).toHaveProperty("wx")
    expect(s).toHaveProperty("wxVia")
    expect(s).toHaveProperty("openclawZero")
    expect(typeof s.daemonHint).toBe("string")
  })

  test("resolveWxInvocation prefers env override", () => {
    const prev = process.env.WX_CLI_BIN
    process.env.WX_CLI_BIN = "/tmp/fake-wx"
    try {
      expect(resolveWxInvocation()).toEqual({ bin: "/tmp/fake-wx", prefixArgs: [] })
    } finally {
      if (prev === undefined) delete process.env.WX_CLI_BIN
      else process.env.WX_CLI_BIN = prev
    }
  })
})
