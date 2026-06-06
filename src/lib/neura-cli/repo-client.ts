import { deskFetch } from "@/lib/neura-cli/desk-client"

export type CliDeliveryRepoConfig = {
  provider: string
  repoUrl: string
  owner: string
  repo: string
  slug: string
  defaultBranch: string
  clonePath: string | null
  defaultRunnerId: string | null
  hasToken: boolean
}

export type CliDeliveryRepoConnector = {
  id: string
  label: string
  status: string
  required: boolean
}

export type CliDeliveryRepoResponse = {
  ok: boolean
  config: CliDeliveryRepoConfig | null
  connectors?: CliDeliveryRepoConnector[]
  orchestrationPlugin?: string | null
  suggestedWorkspace?: string | null
}

export type FetchCliDeliveryRepoOpts = {
  serverUrl?: string
  /** Include connector status from plugin catalog */
  connectors?: boolean
  /** Plugin bundle for connectors.yaml + default .workspace path */
  pluginSlug?: string
  /** owner/repo — use without saved Desk config (pairs with connectors) */
  repo?: string
}

function deliveryRepoQuery(opts: FetchCliDeliveryRepoOpts): string {
  const q = new URLSearchParams()
  if (opts.connectors) q.set("connectors", "1")
  if (opts.pluginSlug?.trim()) q.set("pluginSlug", opts.pluginSlug.trim())
  if (opts.repo?.trim()) q.set("repo", opts.repo.trim())
  const s = q.toString()
  return s ? `?${s}` : ""
}

/** Single GET for delivery repo — pass `connectors: true` instead of a separate fetch. */
export async function fetchCliDeliveryRepo(opts: FetchCliDeliveryRepoOpts = {}) {
  return deskFetch<CliDeliveryRepoResponse>(`/api/cli/delivery-repo${deliveryRepoQuery(opts)}`, {
    serverUrl: opts.serverUrl,
  })
}

/** Alias: `fetchCliDeliveryRepo({ connectors: true, repo, pluginSlug })` */
export async function fetchCliRepoConnectors(
  opts: Omit<FetchCliDeliveryRepoOpts, "connectors"> = {},
) {
  return fetchCliDeliveryRepo({ ...opts, connectors: true })
}

export async function saveCliDeliveryRepo(
  patch: {
    repo: string
    defaultBranch?: string
    clonePath?: string | null
    defaultRunnerId?: string | null
    repoToken?: string
    pluginSlug?: string
  },
  opts: { serverUrl?: string } = {},
) {
  return deskFetch<{
    ok: boolean
    config: CliDeliveryRepoConfig
    parsed?: { slug: string }
    orchestrationPlugin?: string | null
    suggestedWorkspace?: string | null
  }>("/api/cli/delivery-repo", {
    method: "PUT",
    serverUrl: opts.serverUrl,
    body: JSON.stringify(patch),
  })
}
