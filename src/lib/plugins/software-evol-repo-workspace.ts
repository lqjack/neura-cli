/** Standalone stub — synced from llm-gateway. */
export const SOFTWARE_EVOL_OS_PLUGIN_SLUG = "software-evol-os-plugin"

export {
  pluginBundleRoot as pluginRootDir,
  defaultWorkspacePath,
  loadPluginConnectorCatalog as loadSoftwareEvolConnectorCatalog,
  buildConnectorEnvForRepo,
  type PluginConnectorCatalog as SoftwareEvolConnectorCatalog,
  type PluginConnectorDef as SoftwareEvolConnectorDef,
} from "@/lib/plugins/plugin-repo-workspace"

export function isDeliveryExecutionMessage(message: string): boolean {
  return /部署|发布|ci\/cd|github actions|merge|pull request|热修复.*上线|canary deploy/i.test(
    message,
  )
}
