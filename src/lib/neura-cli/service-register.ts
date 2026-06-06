/** Build body for invest-ai Gateway `POST /api/services/catalog/register`. */

export type ServiceRegisterInput = {
  serviceId: string
  description?: string
  workingDir?: string
  entryPoint?: string
  schemaRef?: string
  manifestRef?: string
  ports?: Record<string, number>
  autoAllocate?: boolean
  overwrite?: boolean
  startable?: boolean
}

export function buildServiceRegisterBody(input: ServiceRegisterInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    service_id: input.serviceId.trim(),
    description: input.description ?? "",
    auto_allocate: input.autoAllocate !== false,
    overwrite: input.overwrite === true,
  }
  if (input.workingDir) body.working_dir = input.workingDir
  if (input.entryPoint) body.entry_point = input.entryPoint
  if (input.schemaRef) body.schema_ref = input.schemaRef
  if (input.manifestRef) body.manifest_ref = input.manifestRef
  if (input.ports && Object.keys(input.ports).length) {
    body.ports = input.ports
    body.auto_allocate = false
  }
  if (input.startable !== undefined) body.startable = input.startable
  return body
}

export async function registerCatalogService(
  gatewayUrl: string,
  input: ServiceRegisterInput,
  timeoutMs = 30_000,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  const url = `${gatewayUrl.replace(/\/$/, "")}/api/services/catalog/register`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildServiceRegisterBody(input)),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {
    /* plain */
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data === "string" ? data : JSON.stringify(data),
    }
  }
  return { ok: true, data }
}
