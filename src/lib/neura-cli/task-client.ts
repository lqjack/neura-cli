import { deskFetch } from "@/lib/neura-cli/desk-client"

export type CollabActionResponse = {
  ok: boolean
  status?: string
  action?: string
  mcpServerId?: string
  mcpServerName?: string
  mode?: string
  result?: unknown
  error?: string
}

export async function runCollabTaskAction(input: {
  taskId: string
  action: string
  connectorId?: string
  payload?: Record<string, unknown>
  serverUrl?: string
}): Promise<{ ok: boolean; status: number; data: CollabActionResponse | null; error?: string }> {
  return deskFetch<CollabActionResponse>(`/api/collab/${encodeURIComponent(input.taskId)}/actions`, {
    method: "POST",
    serverUrl: input.serverUrl,
    body: JSON.stringify({
      action: input.action,
      connectorId: input.connectorId,
      payload: input.payload,
    }),
  })
}
