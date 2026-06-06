/**
 * NeuraCLI — clone/pull target repo; workspace path under ~/.neura/.workspace by default.
 */
import { existsSync } from "fs"
import { mkdir } from "fs/promises"
import path from "path"
import { parseRepositoryInput } from "@/lib/delivery/parse-repo-url"
import {
  defaultWorkspacePath,
  loadPluginConnectorCatalog,
} from "@/lib/plugins/plugin-repo-workspace"
import {
  fetchCliDeliveryRepo,
  fetchCliRepoConnectors,
  saveCliDeliveryRepo,
  type CliDeliveryRepoConfig,
} from "./repo-client"

export { fetchCliDeliveryRepo, fetchCliRepoConnectors, saveCliDeliveryRepo }
export {
  SOFTWARE_EVOL_OS_PLUGIN_SLUG,
  resolveCliWorkspacePluginSlug,
} from "@/lib/neura-cli/repo-constants"

export function parseCliRepoSlug(raw: string) {
  return parseRepositoryInput(raw.trim())
}

export function resolvePluginWorkspaceForRepo(
  owner: string,
  repo: string,
  pluginSlug?: string | null,
): string {
  return defaultWorkspacePath(pluginSlug, owner, repo)
}

export type EnsureWorkspaceResult = {
  workspacePath: string
  remoteUrl: string
  slug: string
  cloned: boolean
  pulled: boolean
}

function cloneUrlWithToken(remoteUrl: string, token?: string): string {
  if (!token?.trim()) return remoteUrl
  try {
    const u = new URL(remoteUrl)
    if (u.hostname === "github.com") {
      u.username = "x-access-token"
      u.password = token.trim()
      return u.toString()
    }
  } catch {
    /* keep remoteUrl */
  }
  return remoteUrl
}

async function runGit(
  args: string[],
  cwd: string,
  onLine?: (line: string) => void,
): Promise<{ ok: boolean; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })
  const stderrChunks: string[] = []
  const readStream = async (stream: ReadableStream<Uint8Array> | null, prefix: string) => {
    if (!stream) return
    const reader = stream.getReader()
    const dec = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const text = dec.decode(value)
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        onLine?.(`${prefix}${line}`)
        if (prefix === "[git] ") stderrChunks.push(line)
      }
    }
  }
  await Promise.all([readStream(proc.stdout, ""), readStream(proc.stderr, "[git] ")])
  const code = await proc.exited
  return { ok: code === 0, stderr: stderrChunks.join("\n") }
}

/** Clone or pull target repo into ~/.neura/.workspace/{owner}-{repo}. */
export async function ensurePluginRepoWorkspace(
  slug: string,
  opts: {
    pluginSlug?: string | null
    branch?: string
    workspacePath?: string
    token?: string
    onProgress?: (line: string) => void
  } = {},
): Promise<EnsureWorkspaceResult> {
  const parsed = parseCliRepoSlug(slug)
  if (!parsed) {
    throw new Error(`Invalid repo: ${slug} (use owner/repo)`)
  }
  const workspacePath =
    opts.workspacePath?.trim() ||
    resolvePluginWorkspaceForRepo(parsed.owner, parsed.repo, opts.pluginSlug)
  await mkdir(path.dirname(workspacePath), { recursive: true })

  const remote = cloneUrlWithToken(parsed.remoteUrl, opts.token)
  const branch = opts.branch?.trim() || "main"
  const gitDir = path.join(workspacePath, ".git")

  if (!existsSync(gitDir)) {
    opts.onProgress?.(`[repo] clone ${parsed.slug} → ${workspacePath}`)
    const parent = path.dirname(workspacePath)
    await mkdir(parent, { recursive: true })
    const r = await runGit(["clone", "--depth", "1", "-b", branch, remote, workspacePath], parent, opts.onProgress)
    if (!r.ok) {
      const fallback = await runGit(["clone", remote, workspacePath], parent, opts.onProgress)
      if (!fallback.ok) {
        throw new Error(fallback.stderr || `git clone failed for ${parsed.slug}`)
      }
    }
    return { workspacePath, remoteUrl: parsed.remoteUrl, slug: parsed.slug, cloned: true, pulled: false }
  }

  opts.onProgress?.(`[repo] pull ${parsed.slug}`)
  const pull = await runGit(["pull", "--ff-only"], workspacePath, opts.onProgress)
  if (!pull.ok) {
    opts.onProgress?.(`[repo] pull skipped: ${pull.stderr.slice(0, 200)}`)
  }
  return { workspacePath, remoteUrl: parsed.remoteUrl, slug: parsed.slug, cloned: false, pulled: pull.ok }
}

export function formatConnectorLines(
  connectors: Array<{ id: string; label: string; status: string; required: boolean }>,
): string[] {
  return connectors.map((c) => {
    const mark = c.status === "connected" ? "✓" : c.status === "pending" ? "○" : "·"
    const req = c.required ? "required" : "optional"
    return `  ${mark} ${c.id} (${c.label}) — ${c.status} [${req}]`
  })
}

export function catalogConnectorHints(pluginSlug: string): string[] {
  const cat = loadPluginConnectorCatalog(pluginSlug)
  if (!cat) return [`  (no assets/connectors/connectors.yaml for ${pluginSlug})`]
  return cat.connectors.map((c) => `  - ${c.id}: ${c.description}`)
}

export async function bindRepoForCli(
  slug: string,
  opts: {
    serverUrl?: string
    pluginSlug?: string | null
    branch?: string
    token?: string
    onProgress?: (line: string) => void
  },
): Promise<{ config: CliDeliveryRepoConfig; workspace: EnsureWorkspaceResult }> {
  const token = opts.token ?? process.env.GITHUB_TOKEN
  const ws = await ensurePluginRepoWorkspace(slug, {
    pluginSlug: opts.pluginSlug,
    branch: opts.branch,
    token,
    onProgress: opts.onProgress,
  })
  const saved = await saveCliDeliveryRepo(
    {
      repo: slug,
      defaultBranch: opts.branch,
      clonePath: ws.workspacePath,
      pluginSlug: opts.pluginSlug ?? undefined,
      ...(token ? { repoToken: token } : {}),
    },
    { serverUrl: opts.serverUrl },
  )
  if (!saved.ok || !saved.data?.config) {
    throw new Error(saved.error ?? "failed to save delivery repo")
  }
  return { config: saved.data.config, workspace: ws }
}
