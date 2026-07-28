import { deskFetch } from "@/lib/neura-cli/desk-client"
import { parseKolCsvText } from "@/lib/kol-sync/parse-csv"
import type { KolPlatform } from "@/lib/kol-discovery/types"

export const KOL_GATEWAY_PATHS = {
  discover: "/api/apps/mcn-incubation/extensions/discover",
  sync: "/api/apps/mcn-incubation/extensions/sync",
  outreach: "/api/apps/mcn-incubation/extensions/outreach",
} as const

export type KolCliDiscoverParams = {
  appSlug?: string
  keyword?: string
  platforms?: KolPlatform[]
  minFollowers?: number
  maxFollowers?: number
  pages?: number
  upsert?: boolean
  serverUrl?: string
}

export type KolCliSyncParams = {
  appSlug?: string
  csvPath?: string
  csvText?: string
  rows?: Record<string, unknown>[]
  dryRun?: boolean
  serverUrl?: string
}

export type KolCliOutreachParams = {
  appSlug?: string
  dryRun?: boolean
  dailyLimit?: number
  fromKollead?: boolean
  statusFilter?: string
  serverUrl?: string
}

export function parseKolPlatforms(raw?: string): KolPlatform[] | undefined {
  if (!raw?.trim()) return undefined
  const allowed = new Set<KolPlatform>(["xhs", "douyin", "bilibili"])
  const out = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is KolPlatform => allowed.has(p as KolPlatform))
  return out.length ? out : undefined
}

export function buildKolDiscoverBody(params: KolCliDiscoverParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    appSlug: params.appSlug ?? "ai-vlogger-bd",
    upsert: params.upsert !== false,
  }
  if (params.keyword) body.keyword = params.keyword
  if (params.platforms?.length) body.platforms = params.platforms
  if (params.minFollowers != null) body.min_followers = params.minFollowers
  if (params.maxFollowers != null) body.max_followers = params.maxFollowers
  if (params.pages != null) body.pages = params.pages
  return body
}

export async function kolGatewayDiscover(params: KolCliDiscoverParams) {
  return deskFetch<Record<string, unknown>>(KOL_GATEWAY_PATHS.discover, {
    method: "POST",
    body: JSON.stringify(buildKolDiscoverBody(params)),
    serverUrl: params.serverUrl,
  })
}

export async function kolGatewaySync(params: KolCliSyncParams) {
  let rows = params.rows
  if (!rows?.length && params.csvText) {
    rows = parseKolCsvText(params.csvText)
  }
  const body: Record<string, unknown> = {
    appSlug: params.appSlug ?? "ai-vlogger-bd",
    rows: rows ?? [],
  }
  if (params.dryRun === true || params.dryRun === false) body.dry_run = params.dryRun
  return deskFetch<Record<string, unknown>>(KOL_GATEWAY_PATHS.sync, {
    method: "POST",
    body: JSON.stringify(body),
    serverUrl: params.serverUrl,
  })
}

export async function kolGatewayOutreach(params: KolCliOutreachParams) {
  const body: Record<string, unknown> = {
    appSlug: params.appSlug ?? "ai-vlogger-bd",
    from_kollead: params.fromKollead !== false,
  }
  if (params.dryRun === true || params.dryRun === false) body.dry_run = params.dryRun
  if (params.dailyLimit != null) body.daily_limit = params.dailyLimit
  if (params.statusFilter) body.status_filter = params.statusFilter
  return deskFetch<Record<string, unknown>>(KOL_GATEWAY_PATHS.outreach, {
    method: "POST",
    body: JSON.stringify(body),
    serverUrl: params.serverUrl,
  })
}
