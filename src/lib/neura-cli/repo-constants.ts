/** Default Neura plugin bundle for CLI repo workspace + connector catalog (not routing). */
export { SOFTWARE_EVOL_OS_PLUGIN_SLUG } from "@/lib/plugins/software-evol-repo-workspace"

import { SOFTWARE_EVOL_OS_PLUGIN_SLUG } from "@/lib/plugins/software-evol-repo-workspace"

export type ResolveCliWorkspacePluginOpts = {
  pluginFlag?: string | null
  githubRepo?: string | null
}

/**
 * Workspace / connector catalog plugin slug — explicit --plugin, else software-evol when --repo is set.
 * Does not override server-side domain routing.
 */
export function resolveCliWorkspacePluginSlug(opts: ResolveCliWorkspacePluginOpts): string | undefined {
  const explicit = opts.pluginFlag?.trim()
  if (explicit) return explicit
  if (opts.githubRepo?.trim()) return SOFTWARE_EVOL_OS_PLUGIN_SLUG
  return undefined
}
