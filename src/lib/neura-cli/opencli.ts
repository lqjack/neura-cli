/**
 * OpenCLI hub helpers — wx + openclaw-zero extensions (local machine).
 * NeuraCLI prefers native `wx` when present; otherwise `opencli wx`.
 */
import { spawnSync } from "node:child_process"

const OPENCLI_PKG = process.env.OPENCLI_NPM_PACKAGE ?? "@jackwener/opencli"
const WX_PKG = process.env.WX_CLI_NPM_PACKAGE ?? "@jackwener/wx-cli"

export function commandExists(bin: string): boolean {
  const which = spawnSync("which", [bin], { encoding: "utf8", stdio: "pipe", timeout: 2000 })
  return which.status === 0 && Boolean(which.stdout?.trim())
}

export function cliVersion(bin: string): string | null {
  const r = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 3000,
  })
  if (r.status !== 0) return null
  const line = (r.stdout || r.stderr || "").trim().split("\n")[0]?.trim()
  return line || null
}

export type OpencliStatus = {
  opencli: string | null
  wx: string | null
  wxVia: "wx" | "opencli" | null
  openclawZero: string | null
  daemonHint: string
}

export function getOpencliStatus(): OpencliStatus {
  const opencli = commandExists("opencli") ? cliVersion("opencli") : null
  let wx: string | null = null
  let wxVia: OpencliStatus["wxVia"] = null
  if (commandExists("wx")) {
    wx = cliVersion("wx")
    wxVia = "wx"
  } else if (opencli) {
    const r = spawnSync("opencli", ["wx", "--version"], {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 3000,
    })
    if (r.status === 0) {
      wx = (r.stdout || "").trim().split("\n")[0]?.trim() || "opencli-wx"
      wxVia = "opencli"
    }
  }
  let openclawZero: string | null = null
  if (opencli) {
    const r = spawnSync("opencli", ["openclaw-zero", "version"], {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 3000,
    })
    if (r.status === 0) {
      openclawZero = (r.stdout || "").trim().split("\n")[0]?.trim() || "installed"
    }
  }
  return {
    opencli,
    wx,
    wxVia,
    openclawZero,
    daemonHint: opencli
      ? "opencli daemon start | opencli openclaw-zero start"
      : `npm i -g ${OPENCLI_PKG} && opencli daemon start`,
  }
}

function runInherit(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status ?? 1})`)
  }
}

/** Install OpenCLI hub + wx extension; optionally probe openclaw-zero. */
export function setupOpencli(opts?: { skipWx?: boolean; skipOpenclaw?: boolean }): OpencliStatus {
  if (!commandExists("opencli")) {
    console.log(`>>> npm install -g ${OPENCLI_PKG}@latest`)
    runInherit("npm", ["install", "-g", `${OPENCLI_PKG}@latest`])
  }
  try {
    spawnSync("opencli", ["daemon", "restart"], { stdio: "ignore" })
  } catch {
    spawnSync("opencli", ["daemon", "start"], { stdio: "ignore" })
  }
  if (!opts?.skipWx && !commandExists("wx")) {
    console.log(`>>> npm install -g ${WX_PKG}@latest (opencli wx extension)`)
    runInherit("npm", ["install", "-g", `${WX_PKG}@latest`])
  }
  if (!opts?.skipWx && commandExists("opencli")) {
    try {
      runInherit("opencli", ["wx", "doctor"])
    } catch {
      console.log(">>> opencli wx doctor reported issues — run: sudo wx init (WeChat desktop)")
    }
  }
  if (!opts?.skipOpenclaw && commandExists("opencli")) {
    try {
      spawnSync("opencli", ["openclaw-zero", "start"], { stdio: "inherit", encoding: "utf8" })
    } catch {
      console.log(">>> openclaw-zero start skipped — install extension or start manually")
    }
  }
  return getOpencliStatus()
}

export function printOpencliStatus(s: OpencliStatus = getOpencliStatus()): void {
  console.log(`opencli:        ${s.opencli ?? "(missing)"}`)
  console.log(`wx:             ${s.wx ?? "(missing)"}${s.wxVia ? ` via ${s.wxVia}` : ""}`)
  console.log(`openclaw-zero:  ${s.openclawZero ?? "(missing)"}`)
  console.log(`hint:           ${s.daemonHint}`)
}
