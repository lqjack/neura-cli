/** Neura product identifiers — brand names are locale-invariant. */

export const NEURA = {
  os: "NeuraOS",
  cli: "NeuraCLI",
  runner: "NeuraRunner",
  server: "NeuraServer",
  agent: "NeuraAgent",
  plugin: "NeuraPlugin",
  desk: "NeuraDesk",
} as const

export type NeuraProductId = keyof typeof NEURA
export type NeuraProduct = (typeof NEURA)[NeuraProductId]

export const NEURA_PRODUCT_PATHS: Record<NeuraProductId, string[]> = {
  os: ["src/lib/sop/"],
  server: ["src/app/api/gateway/", "src/app/api/collab/", "src/app/api/mcp/"],
  desk: ["src/app/", "src/components/"],
  agent: ["src/app/api/collab/", "plugins/*/assets/agents/"],
  /** Local daemon — connects a computer to NeuraServer; NOT the user CLI. */
  runner: ["packages/runner/", "src/app/api/gateway/runners/"],
  /** User-facing CLI — deploy, register, verify via package.json scripts. */
  cli: ["package.json scripts"],
  plugin: ["plugins/", "config/plugins/", "src/lib/plugins/"],
}

/** npm package for NeuraRunner (legacy name retained). */
export const NEURA_RUNNER_PACKAGE = "@llm-gateway/runner"
export const NEURA_RUNNER_BIN = "llm-gateway-runner"
