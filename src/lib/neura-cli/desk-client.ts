import { NEURA_DEFAULT_GATEWAY_URL } from "@/lib/neura/branding"

export function resolveNeuraServerUrl(override?: string): string {
  const trimmed = override?.trim()
  const raw =
    trimmed ||
    process.env.NEURADESK_URL?.trim() ||
    process.env.NEURA_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    NEURA_DEFAULT_GATEWAY_URL
  return raw.replace(/\/$/, "")
}

export function buildCliAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const apiKey = process.env.NEURA_API_KEY
  const session = process.env.NEURA_SESSION ?? process.env.X_EAZO_SESSION
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  else if (session) headers["x-eazo-session"] = session
  return headers
}

export async function deskFetch<T>(
  path: string,
  init: RequestInit & { serverUrl?: string } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const base = resolveNeuraServerUrl(init.serverUrl)
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...buildCliAuthHeaders(), ...(init.headers as Record<string, string> | undefined) },
      signal: init.signal ?? AbortSignal.timeout(120_000),
    })
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
  const text = await res.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    return { ok: false, status: res.status, data: null, error: text || res.statusText }
  }
  if (!res.ok) {
    const err = (data as { error?: string } | null)?.error ?? text
    return {
      ok: false,
      status: res.status,
      data,
      error: err?.trim() || res.statusText || `HTTP ${res.status}`,
    }
  }
  return { ok: true, status: res.status, data }
}
