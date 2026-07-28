import { spawnSync } from "child_process"
import { commandExists } from "@/lib/neura-cli/opencli"

/** Prefer native `wx`; fall back to OpenCLI wx extension (`opencli wx …`). */
export function resolveWxInvocation(): { bin: string; prefixArgs: string[] } {
  const override = process.env.WX_CLI_BIN?.trim()
  if (override) return { bin: override, prefixArgs: [] }
  if (commandExists("wx")) return { bin: "wx", prefixArgs: [] }
  if (commandExists("opencli")) return { bin: "opencli", prefixArgs: ["wx"] }
  return { bin: "wx", prefixArgs: [] }
}

export function runWxJson(args: string[], timeoutMs = 120_000): { ok: boolean; data?: unknown; error?: string } {
  const { bin, prefixArgs } = resolveWxInvocation()
  const r = spawnSync(bin, [...prefixArgs, ...args, "--json"], {
    encoding: "utf-8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  })
  const stderr = (r.stderr ?? "").trim()
  const stdout = (r.stdout ?? "").trim()
  if (r.status !== 0) {
    const label = prefixArgs.length ? `${bin} ${prefixArgs.join(" ")}` : bin
    return { ok: false, error: stderr || stdout || `${label} exit ${r.status}` }
  }
  if (!stdout) return { ok: true, data: null }
  try {
    return { ok: true, data: JSON.parse(stdout) }
  } catch {
    return { ok: false, error: `invalid JSON from wx: ${stdout.slice(0, 200)}` }
  }
}
