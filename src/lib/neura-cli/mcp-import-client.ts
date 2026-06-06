import { deskFetch } from "@/lib/neura-cli/desk-client"

export async function importNeuraPluginMcp(
  pluginSlug: string,
  opts: { serverUrl?: string; services?: string[] } = {},
) {
  return deskFetch<{
    ok: boolean
    pluginSlug: string
    summary: { imported: number; pending_url: number; skipped: number; total: number }
    results: Array<{ service: string; status: string; id?: string }>
  }>("/api/cli/mcp/import-neura-plugin", {
    method: "POST",
    serverUrl: opts.serverUrl,
    body: JSON.stringify({
      pluginSlug,
      ...(opts.services?.length ? { services: opts.services } : {}),
    }),
  })
}
