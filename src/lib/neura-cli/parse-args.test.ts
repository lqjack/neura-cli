import { describe, expect, test } from "bun:test"

/** Mirror of scripts/neura-cli.ts parseArgs for regression tests. */
function parseArgs(argv: string[], captureSub = true) {
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  const rest = [...argv]
  let sub: string | undefined
  if (captureSub && rest[0] && !rest[0].startsWith("-")) sub = rest.shift()
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = rest[i + 1]
      if (next && !next.startsWith("-")) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else if (a.startsWith("-") && a.length === 2) {
      const key = a.slice(1)
      const next = rest[i + 1]
      if (next && !next.startsWith("-")) {
        flags[key] = next
        i++
      } else flags[key] = true
    } else positional.push(a)
  }
  return { sub, positional, flags }
}

describe("neura-cli parseArgs send", () => {
  test("keeps full message when captureSub=false", () => {
    const p = parseArgs(["小红书增长：分析竞品", "--timeout", "600"], false)
    expect(p.positional.join(" ")).toBe("小红书增长：分析竞品")
    expect(p.flags.timeout).toBe("600")
  })

  test("wx still captures subcommand", () => {
    const p = parseArgs(["watch", "--interval", "5"], true)
    expect(p.sub).toBe("watch")
    expect(p.flags.interval).toBe("5")
  })
})
