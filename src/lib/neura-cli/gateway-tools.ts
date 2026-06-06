import { checkDataproaiGatewayHealth, getDataproaiGatewayUrl } from "@/lib/dataproai-gateway/client"

const DIRECT: Record<string, string> = {
  wx_cli: process.env.WX_CLI_API_URL ?? "http://127.0.0.1:10475",
  tts: process.env.TTS_API_URL ?? "http://127.0.0.1:10320",
  youtube: process.env.YOUTUBE_API_URL ?? "http://127.0.0.1:10340",
}

export function resolveGatewayUrl(override?: string): string {
  const raw = override ?? getDataproaiGatewayUrl() ?? "http://127.0.0.1:8001"
  return ((typeof raw === "string" ? raw.trim() : "") || "http://127.0.0.1:8001").replace(/\/$/, "")
}

async function postTool(url: string, toolName: string, args: Record<string, unknown>, timeoutMs: number) {
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: toolName, arguments: args }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: msg }
  }
  const text = await res.text()
  let data: unknown = text
  try { data = JSON.parse(text) } catch { /* plain */ }
  if (!res.ok) return { ok: false as const, error: typeof data === "string" ? data : JSON.stringify(data) }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>
    if ("result" in o) return { ok: true as const, data: o.result }
    if (o.success === false) return { ok: false as const, error: String(o.error ?? JSON.stringify(o)) }
  }
  return { ok: true as const, data }
}

export async function gatewayToolCall(
  gatewayUrl: string,
  server: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 120_000
) {
  const gw = await postTool(`${gatewayUrl}/${server}/api/tools/call`, toolName, args, timeoutMs)
  if (gw.ok) return { ...gw, via: "gateway" as const }
  const base = DIRECT[server]
  if (base && gw.error?.includes("No service found")) {
    const direct = await postTool(`${base.replace(/\/$/, "")}/api/tools/call`, toolName, args, timeoutMs)
    return direct.ok
      ? { ...direct, via: "direct" as const }
      : { ...direct, error: `gateway: ${gw.error}; direct: ${direct.error}` }
  }
  return gw
}

export async function serviceHealth(baseUrl: string): Promise<boolean> {
  try {
    return (await fetch(`${baseUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(8000) })).ok
  } catch {
    return false
  }
}

export async function checkGatewayHealth(gatewayUrl?: string) {
  const prev = process.env.DATAPROAI_GATEWAY_URL
  if (gatewayUrl) process.env.DATAPROAI_GATEWAY_URL = gatewayUrl
  try {
    return await checkDataproaiGatewayHealth()
  } finally {
    if (gatewayUrl) {
      if (prev === undefined) delete process.env.DATAPROAI_GATEWAY_URL
      else process.env.DATAPROAI_GATEWAY_URL = prev
    }
  }
}
