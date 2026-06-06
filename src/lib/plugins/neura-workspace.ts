/**
 * Neura user workspace — cloned target repos live under ~/.neura/.workspace/ by default.
 * Plugin bundles (skills/commands) are registered via src/lib/plugins/* + getPluginsRoot().
 */
import os from "os"
import path from "path"

const DEFAULT_NEURA_HOME = path.join(os.homedir(), ".neura")

/** User-level Neura home (~/.neura). Override with NEURA_HOME. */
export function getNeuraHomeDir(): string {
  const raw = process.env.NEURA_HOME?.trim()
  return raw ? raw.replace(/^~/, os.homedir()) : DEFAULT_NEURA_HOME
}

/** Root for cloned GitHub/GitLab targets. Default ~/.neura/.workspace */
export function getNeuraWorkspaceRoot(): string {
  const raw = process.env.NEURA_WORKSPACE_ROOT?.trim()
  if (raw) return raw.replace(/^~/, os.homedir())
  return path.join(getNeuraHomeDir(), ".workspace")
}

export function repoWorkspaceDir(owner: string, repo: string): string {
  const safe = `${owner}-${repo}`.replace(/[^a-zA-Z0-9._-]+/g, "-")
  return path.join(getNeuraWorkspaceRoot(), safe)
}
