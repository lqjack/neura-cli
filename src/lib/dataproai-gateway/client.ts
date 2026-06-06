/**
 * Minimal DataproAI Gateway client for NeuraCLI standalone sync (wx optional paths).
 */
const GATEWAY_HEALTH_PATHS = ["/health", "/api/health", "/"]

export function getDataproaiGatewayUrl(): string | null {
  const url = process.env.DATAPROAI_GATEWAY_URL?.trim()
  return url || null
}

export async function checkDataproaiGatewayHealth(): Promise<{
  ok: boolean
  url: string | null
  message?: string
  healthPath?: string
}> {
  const url = getDataproaiGatewayUrl()
  if (!url) return { ok: false, url: null, message: "DATAPROAI_GATEWAY_URL not set" }
  let lastMessage: string | undefined
  for (const healthPath of GATEWAY_HEALTH_PATHS) {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}${healthPath}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) return { ok: true, url, healthPath }
      lastMessage = `HTTP ${res.status}`
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, url, message: lastMessage ?? "unreachable" }
}
