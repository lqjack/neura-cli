import { spawnSync } from "child_process"

const WX_BIN = process.env.WX_CLI_BIN ?? "wx"

export function runWxJson(args: string[], timeoutMs = 120_000): { ok: boolean; data?: unknown; error?: string } {
  const r = spawnSync(WX_BIN, [...args, "--json"], {
    encoding: "utf-8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  })
  const stderr = (r.stderr ?? "").trim()
  const stdout = (r.stdout ?? "").trim()
  if (r.status !== 0) {
    return { ok: false, error: stderr || stdout || `wx exit ${r.status}` }
  }
  if (!stdout) return { ok: true, data: null }
  try {
    return { ok: true, data: JSON.parse(stdout) }
  } catch {
    return { ok: false, error: `invalid JSON from wx: ${stdout.slice(0, 200)}` }
  }
}
