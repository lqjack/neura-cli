import { existsSync, readFileSync } from "fs"
import path from "path"

/** Env keys NeuraCLI loads from config/neura-cli.env (never overrides already-set vars). */
const CLI_ENV_KEYS = new Set([
  "NEURA_API_KEY",
  "NEURA_SESSION",
  "NEURA_SERVER_URL",
  "NEURADESK_URL",
  "GITHUB_TOKEN",
  "X_EAZO_SESSION",
])

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function applyFile(file: string): void {
  if (!existsSync(file)) return
  const parsed = parseEnvFile(readFileSync(file, "utf8"))
  for (const [key, val] of Object.entries(parsed)) {
    if (!CLI_ENV_KEYS.has(key)) continue
    if (process.env[key]?.trim()) continue
    process.env[key] = val
  }
}

/** Load NeuraCLI secrets/URLs from repo config before dotenv/.env. */
export function loadNeuraCliEnv(cwd = process.cwd()): void {
  const candidates: string[] = []
  if (process.env.NEURA_CLI_ENV?.trim()) {
    candidates.push(process.env.NEURA_CLI_ENV.trim())
  }
  candidates.push(
    path.join(cwd, "config", "neura-cli.env"),
    path.join(process.env.HOME ?? "", ".config", "neura", "cli.env"),
  )
  for (const file of candidates) applyFile(file)
}
