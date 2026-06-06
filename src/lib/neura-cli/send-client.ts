import { deskFetch, resolveNeuraServerUrl } from "@/lib/neura-cli/desk-client"
import { validateCollabTaskAiOutput } from "@/lib/ai/mock-guard"

export type CliDeliveryRepoSummary = {
  slug: string
  remoteUrl?: string
  provider?: string
  workspacePath?: string
  orchestrationPlugin?: string
  connectors?: Array<{ id: string; label: string; status: string; required?: boolean }>
}

export type CliSendResult = {
  taskId: string
  status: string
  message?: string
  deskPath?: string
  deliveryRepo?: CliDeliveryRepoSummary
  intent?: {
    summary: string
    domain: string
    scenarioId: string
    pluginSlug: string | null
    confidence: string
  }
  workflow?: { name: string; skills: string[]; steps: string[] }
  workflowDispatch?: unknown
  reviewGate?: string
  collabAgentPlan?: {
    reportTitle: string
    agents: Array<{
      agentId: string
      agentName: string
      taskType: string
      skills: string[]
    }>
  }
  reused?: boolean
  similarCase?: { score: number; source: string; matchedTopic: string }
  finalReport?: string | null
}

export type CliTaskPollResult = {
  taskId: string
  status: string
  done: boolean
  currentStep?: number
  finalReport?: string | null
  errorMessage?: string | null
  agentOutputs?: unknown
  deskPath?: string
}

export async function sendMessage(
  message: string,
  opts: {
    serverUrl?: string
    useRunner?: boolean
    runnerId?: string
    workDir?: string
    /** owner/repo → githubRepo on POST /api/cli/send */
    githubRepo?: string
    pluginSlug?: string
    /** Persist repo + clonePath to delivery_repo_config after ensure (default when --repo) */
    saveRepo?: boolean
    /** Clone/pull before send (uses ~/.neura/.workspace when --repo set) */
    ensureRepo?: boolean
    onProgress?: (line: string) => void
    useGitHubActions?: boolean
    waitForGitHubActions?: boolean
    openGitHubPr?: boolean
    openGitLabMr?: boolean
    enrich?: boolean
    forceRun?: boolean
    noCache?: boolean
    workflowFailed?: boolean
    metricActuals?: Record<string, number>
    notifyChannel?: boolean
  } = {},
): Promise<CliSendResult> {
  let workDir = opts.workDir
  let githubRepo = opts.githubRepo?.trim()
  const { resolveCliWorkspacePluginSlug } = await import("./repo-constants")
  const workspacePlugin = resolveCliWorkspacePluginSlug({
    pluginFlag: opts.pluginSlug,
    githubRepo,
  })

  if (opts.ensureRepo && githubRepo) {
    const { ensurePluginRepoWorkspace, parseCliRepoSlug, saveCliDeliveryRepo } = await import(
      "./repo-workspace"
    )
    const parsed = parseCliRepoSlug(githubRepo)
    if (!parsed) throw new Error(`Invalid --repo: ${githubRepo}`)
    const ws = await ensurePluginRepoWorkspace(githubRepo, {
      pluginSlug: workspacePlugin,
      workspacePath: workDir,
      token: process.env.GITHUB_TOKEN,
      onProgress: opts.onProgress,
    })
    workDir = ws.workspacePath
    githubRepo = ws.slug
    opts.onProgress?.(`[send] githubRepo=${githubRepo} workDir=${workDir}`)
    if (opts.saveRepo !== false) {
      const saved = await saveCliDeliveryRepo(
        {
          repo: githubRepo,
          clonePath: workDir,
          pluginSlug: workspacePlugin ?? undefined,
          ...(process.env.GITHUB_TOKEN ? { repoToken: process.env.GITHUB_TOKEN } : {}),
        },
        { serverUrl: opts.serverUrl },
      )
      if (!saved.ok) {
        opts.onProgress?.(`[send] warn: could not save delivery repo — ${saved.error ?? "unknown"}`)
      } else {
        opts.onProgress?.(`[send] delivery repo saved → ${workDir}`)
      }
    }
  }

  const sendTimeoutMs =
    Number(process.env.NEURA_SEND_TIMEOUT ?? "600") * 1000 || 600_000
  const r = await deskFetch<CliSendResult>("/api/cli/send", {
    method: "POST",
    serverUrl: opts.serverUrl,
    signal: AbortSignal.timeout(sendTimeoutMs),
    body: JSON.stringify({
      message,
      useRunner: opts.useRunner,
      runnerId: opts.runnerId,
      workDir,
      githubRepo,
      useGitHubActions: opts.useGitHubActions,
      waitForGitHubActions: opts.waitForGitHubActions,
      openGitHubPr: opts.openGitHubPr,
      openGitLabMr: opts.openGitLabMr,
      notifyChannel: opts.notifyChannel,
      enrich: opts.enrich,
      forceRun: opts.forceRun,
      noCache: opts.noCache,
      workflowFailed: opts.workflowFailed,
      metricActuals: opts.metricActuals,
    }),
  })
  if (!r.ok || !r.data?.taskId) {
    throw new Error(r.error ?? `send failed HTTP ${r.status}`)
  }
  return r.data
}

export async function pollCliTask(
  taskId: string,
  opts: { serverUrl?: string } = {},
): Promise<CliTaskPollResult> {
  const r = await deskFetch<CliTaskPollResult>(`/api/cli/tasks/${encodeURIComponent(taskId)}`, {
    serverUrl: opts.serverUrl,
  })
  if (!r.ok || !r.data) {
    throw new Error(r.error ?? `poll failed HTTP ${r.status}`)
  }
  return r.data
}

export async function runSendMessage(
  message: string,
  opts: {
    serverUrl?: string
    pollMs?: number
    timeoutMs?: number
    useRunner?: boolean
    runnerId?: string
    workDir?: string
    githubRepo?: string
    ensureRepo?: boolean
    onProgress?: (line: string) => void
    useGitHubActions?: boolean
    waitForGitHubActions?: boolean
    openGitHubPr?: boolean
    openGitLabMr?: boolean
    enrich?: boolean
    forceRun?: boolean
    noCache?: boolean
    workflowFailed?: boolean
    metricActuals?: Record<string, number>
    notifyChannel?: boolean
    onStatus?: (s: CliTaskPollResult) => void
  } = {},
): Promise<{ submit: CliSendResult; result: CliTaskPollResult }> {
  const submit = await sendMessage(message, opts)
  const pollMs = opts.pollMs ?? 2000
  const deadline = Date.now() + (opts.timeoutMs ?? 600_000)

  while (Date.now() < deadline) {
    const snap = await pollCliTask(submit.taskId, opts)
    opts.onStatus?.(snap)
    if (snap.done) return { submit, result: snap }
    if (snap.status === "pending_review" || snap.status === "awaiting_approval") {
      return { submit, result: snap }
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }

  throw new Error(`task ${submit.taskId} timed out after ${opts.timeoutMs ?? 600_000}ms`)
}

export function formatTaskResult(result: CliTaskPollResult): string {
  const validated = validateCollabTaskAiOutput({
    status: result.status,
    finalReport: result.finalReport,
    errorMessage: result.errorMessage,
    agentOutputs: result.agentOutputs,
  })
  if (!validated.ok) {
    return validated.reason.startsWith("(") ? validated.reason : `ERROR: ${validated.reason}`
  }
  return validated.text
}

export { resolveNeuraServerUrl }
