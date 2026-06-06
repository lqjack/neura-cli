/**
 * CLI standalone slice — connector catalog from local plugin bundles only (no DB).
 * Synced to independent neura-cli repo as plugin-repo-workspace.ts.
 */
import { existsSync, readFileSync } from "fs"
import path from "path"
import type { ParsedRepository } from "@/lib/delivery/parse-repo-url"
import { getNeuraHomeDir } from "@/lib/plugins/neura-workspace"
import { repoWorkspaceDir } from "@/lib/plugins/neura-workspace"
import { parseYamlCompat } from "@/lib/utils/parse-yaml-compat"

export type PluginConnectorDef = {
  id: string
  label: string
  description: string
  required: boolean
  mcpServer?: string
  requiredEnv: string[]
  envSource: string
}

export type PluginConnectorCatalog = {
  version: string
  reference: string
  connectors: PluginConnectorDef[]
}

const catalogCache = new Map<string, PluginConnectorCatalog>()

/** Root for plugin bundles — set NEURA_PLUGIN_BUNDLE_ROOT to llm-gateway/plugins in dev. */
export function pluginBundleRoot(pluginSlug: string): string {
  const root =
    process.env.NEURA_PLUGIN_BUNDLE_ROOT?.trim() ||
    path.join(getNeuraHomeDir(), "plugins")
  return path.join(root, pluginSlug)
}

export function defaultWorkspacePath(
  _pluginSlug: string | null | undefined,
  owner: string,
  repo: string,
): string {
  return repoWorkspaceDir(owner, repo)
}

export function loadPluginConnectorCatalog(pluginSlug: string): PluginConnectorCatalog | null {
  const slug = pluginSlug.trim()
  const cached = catalogCache.get(slug)
  if (cached) return cached

  const file = path.join(pluginBundleRoot(slug), "assets", "connectors", "connectors.yaml")
  if (!existsSync(file)) return null

  const parsed = parseYamlCompat(readFileSync(file, "utf-8")) as Record<string, unknown>
  const rows = (parsed.connectors ?? []) as Array<Record<string, unknown>>
  const catalog: PluginConnectorCatalog = {
    version: String(parsed.version ?? "1"),
    reference: String(parsed.reference ?? ""),
    connectors: rows.map((c) => ({
      id: String(c.id),
      label: String(c.label ?? c.id),
      description: String(c.description ?? ""),
      required: Boolean(c.required),
      mcpServer: c.mcp_server ? String(c.mcp_server) : undefined,
      requiredEnv: Array.isArray(c.required_env) ? c.required_env.map(String) : [],
      envSource: String(c.env_source ?? "optional"),
    })),
  }
  catalogCache.set(slug, catalog)
  return catalog
}

export function buildConnectorEnvForRepo(
  parsed: ParsedRepository,
  hasToken: boolean,
): Record<string, string> {
  const env: Record<string, string> = {}
  if (parsed.provider === "github") {
    env.GITHUB_REPOSITORY = parsed.slug
    if (hasToken) env.GITHUB_TOKEN = "__configured__"
  }
  return env
}
