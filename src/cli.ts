#!/usr/bin/env bun
/**
 * NeuraCLI — thin client: send messages to NeuraDesk; server handles intent, routing, plugins.
 *
 *   bun run neura send "小红书增长：分析竞品笔记"
 *   bun run neura wx watch …   (local wx-cli only)
 */
import "./load-env"
import "dotenv/config"
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "fs/promises"
import path from "path"
import { NEURA } from "@/lib/neura/branding"
import { resolveGatewayUrl } from "@/lib/neura-cli/gateway-tools"
import {
  formatTaskResult,
  resolveNeuraServerUrl,
  runSendMessage,
} from "@/lib/neura-cli/send-client"
import {
  dedupeMessages,
  enrichMessages,
  fetchAllWxHistory,
  fetchNewMessages,
  filterMessagesByChat,
  messageKey,
  resolveWxChat,
  runInvokeDemo,
  transcribeChatMedia,
  transcribeMediaFile,
} from "@/lib/neura-cli/wx-tts-pipeline"
import {
  formatEvidenceExhibits,
  formatEvidenceHeader,
  formatEvidenceTranscriptText,
  inferEvidenceDateRange,
  splitTranscriptSegments,
  wrapEvidenceDocument,
  type EvidenceCaseMeta,
  type MediaTranscriptRow,
} from "@/lib/neura-cli/wx-media-transcript"
import { listCachedVideosInAttach, readWxStorageRoot } from "@/lib/neura-cli/wx-media-path"
import { registerCatalogService } from "@/lib/neura-cli/service-register"
import {
  bindRepoForCli,
  catalogConnectorHints,
  ensurePluginRepoWorkspace,
  formatConnectorLines,
  parseCliRepoSlug,
  resolvePluginWorkspaceForRepo,
  resolveCliWorkspacePluginSlug,
  SOFTWARE_EVOL_OS_PLUGIN_SLUG,
} from "@/lib/neura-cli/repo-workspace"
import { importNeuraPluginMcp } from "@/lib/neura-cli/mcp-import-client"
import { runCollabTaskAction } from "@/lib/neura-cli/task-client"
type Parsed = { sub?: string; positional: string[]; flags: Record<string, string | boolean> }

function parseArgs(argv: string[], captureSub = true): Parsed {
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  const rest = [...argv]
  let sub: string | undefined
  if (captureSub && rest[0] && !rest[0].startsWith("-")) sub = rest.shift()
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = rest[i + 1]
      if (next && !next.startsWith("-")) { flags[key] = next; i++ } else flags[key] = true
    } else if (a.startsWith("-") && a.length === 2) {
      const key = a.slice(1)
      const next = rest[i + 1]
      if (next && !next.startsWith("-")) { flags[key] = next; i++ } else flags[key] = true
    } else positional.push(a)
  }
  return { sub, positional, flags }
}

function str(f: Parsed["flags"], k: string, fb = "") { const v = f[k]; return typeof v === "string" ? v : fb }
function num(f: Parsed["flags"], k: string, fb: number) { const n = Number(str(f, k)); return str(f, k) && !Number.isNaN(n) ? n : fb }
function flag(f: Parsed["flags"], k: string) { return f[k] === true }

function printHelp() {
  console.log(`
${NEURA.cli}

  task action <taskId> <action> [--connector ID] [--server URL] [--json]
           (e.g. slack.post_summary — invokes user's registered MCP connector)

  send <message> [--server URL] [--timeout 600] [--poll 2] [--json]
           [--force-run] [--no-cache] [--enrich]
           [--repo owner/repo] [--ensure-repo] [--no-save-repo] [--plugin PLUGIN_SLUG] [--use-runner] [--runner-id ID] [--work-dir PATH]
           [--github-ci] [--github-ci-no-wait] [--github-pr] [--gitlab-mr]
           [--notify-channel] [--no-notify-channel]
           [--workflow-failed] [--metric KEY=NUM ...]

  repo show [--repo owner/repo] [--connectors] [--plugin PLUGIN_SLUG] [--server URL] [--json]
  repo set <owner/repo> [--branch main] [--ensure] [--plugin PLUGIN_SLUG] [--server URL]
  repo ensure <owner/repo> [--branch main] [--work-dir PATH] [--plugin PLUGIN_SLUG]

  connector list [--plugin software-evol-os-plugin]   (local connectors.yaml catalog)
  connector status [--repo owner/repo] [--plugin PLUGIN_SLUG] [--server URL]
  connector import [--plugin PLUGIN_SLUG] [--services slack,linear] [--server URL]

  (--repo defaults workspace to ~/.neura/.workspace/{owner}-{repo})
  (repo show / connector status use fetchCliDeliveryRepo; routing plugin still from server Intent)

  service register --id SERVICE_ID [--description TEXT]
           [--working-dir PATH] [--entry-point PATH]
           [--schema-ref PATH] [--manifest-ref PATH]
           [--ports '{"api":10950}'] [--no-auto-allocate] [--overwrite]
           [--startable true|false] [--gateway URL] [--json]

  wx watch [--interval 5] [--chat NAME] [--out inbox.jsonl] [--transcribe] [--once]
  wx history-all <chat> [--transcribe] [--translate] [--txt OUT.txt] [--out full.json]
  wx transcribe <chat> [--evidence] [--case-title TITLE] [--split-dir ./out/segments] [--txt OUT.txt]
  wx reformat-evidence --from transcript.json [--evidence] [--case-title TITLE] [--txt OUT.txt]
  wx media-to-text <file> [--translate] [--txt OUT.txt] [--detailed-txt]
  wx scan-media [--chat NAME] [--month YYYY-MM]
  wx invoke-demo

NeuraDesk analyzes your message (Intent → Router → Workflow → Execution) and auto-invokes
the right plugin on the server. Auth: NEURA_API_KEY (Bearer gw-…) or NEURA_SESSION.
Server: NEURA_SERVER_URL (default https://gateway.datapro.asia).

Default .txt = full plain transcript (no headers). Use --detailed-txt for per-message metadata.
With --evidence, output includes a case header (auto-filled contact/dates; override via --case-title, --case-id, --parties, --notes).
`)
}

function buildEvidenceMeta(
  flags: Parsed["flags"],
  opts: {
    chat: string
    contact?: string
    rows: MediaTranscriptRow[]
    mediaCount?: number
    transcribedCount?: number
  }
): EvidenceCaseMeta {
  const range = inferEvidenceDateRange(opts.rows)
  return {
    title: str(flags, "case-title") || undefined,
    caseId: str(flags, "case-id") || undefined,
    parties: str(flags, "parties") || undefined,
    contact: opts.contact ?? opts.chat,
    contactId: opts.chat,
    dateFrom: str(flags, "since") || range.from,
    dateTo: str(flags, "until") || range.to,
    notes: str(flags, "notes") || undefined,
    mediaCount: opts.mediaCount,
    transcribedCount: opts.transcribedCount,
  }
}

function withEvidenceHeader(body: string, meta: EvidenceCaseMeta, enabled: boolean): string {
  if (!enabled) return body
  return wrapEvidenceDocument(body, meta)
}

async function writeEvidenceOutputs(opts: {
  flags: Parsed["flags"]
  chat: string
  contact?: string
  txtOut: string
  evidenceBody: string
  fullBody: string
  detailedBody?: string
  rows: MediaTranscriptRow[]
  mediaCount?: number
  transcribedCount?: number
  logPrefix?: string
}) {
  const evidenceMode = flag(opts.flags, "evidence")
  const meta = buildEvidenceMeta(opts.flags, {
    chat: opts.chat,
    contact: opts.contact,
    rows: opts.rows,
    mediaCount: opts.mediaCount,
    transcribedCount: opts.transcribedCount,
  })
  const txtBody = evidenceMode
    ? withEvidenceHeader(opts.evidenceBody, meta, true)
    : flag(opts.flags, "detailed-txt")
      ? (opts.detailedBody ?? opts.fullBody)
      : opts.fullBody
  await writeFile(opts.txtOut, txtBody, "utf-8")

  if (flag(opts.flags, "detailed-txt") || evidenceMode) {
    const fullPath = opts.txtOut.replace(/\.txt$/i, "-full.txt")
    await writeFile(fullPath, opts.fullBody, "utf-8")
    console.log(`${opts.logPrefix ?? "[transcribe]"} full txt → ${fullPath}`)
  }

  if (evidenceMode || str(opts.flags, "exhibits")) {
    const exhibitsPath = str(opts.flags, "exhibits") || opts.txtOut.replace(/\.txt$/i, "-exhibits.txt")
    await writeFile(exhibitsPath, formatEvidenceExhibits(opts.rows, opts.contact ?? opts.chat, meta), "utf-8")
    console.log(`${opts.logPrefix ?? "[transcribe]"} exhibits → ${exhibitsPath}`)
  }

  const splitDir = str(opts.flags, "split-dir")
  if (splitDir) {
    await mkdir(splitDir, { recursive: true })
    for (const name of await readdir(splitDir)) {
      if (name.endsWith(".txt")) await rm(path.join(splitDir, name), { force: true })
    }
    if (evidenceMode) {
      await writeFile(path.join(splitDir, "00-case-header.txt"), formatEvidenceHeader(meta), "utf-8")
    }
    const segments = splitTranscriptSegments(opts.rows, opts.contact ?? opts.chat)
    for (const seg of segments) {
      await writeFile(path.join(splitDir, seg.name), seg.body, "utf-8")
    }
    console.log(`${opts.logPrefix ?? "[transcribe]"} split ${segments.length} segments → ${splitDir}`)
  }
}

async function appendJsonl(file: string, rows: unknown[]) {
  await mkdir(path.dirname(file), { recursive: true })
  const lines = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "")
  await appendFile(file, lines, "utf-8")
}

async function cmdWatch(flags: Parsed["flags"], chatFilter?: string) {
  const gw = resolveGatewayUrl(str(flags, "gateway"))
  const intervalMs = num(flags, "interval", 5) * 1000
  const out = str(flags, "out", "./out/wx-watch.jsonl")
  const limit = num(flags, "limit", 200)
  const transcribe = flag(flags, "transcribe")
  const once = flag(flags, "once")
  const seen = new Set<string>()

  console.log(`[${NEURA.cli}] watch interval=${intervalMs}ms chat=${chatFilter ?? "*"} out=${out}`)

  const tick = async () => {
    const batch = await fetchNewMessages(limit)
    if (!batch.ok) {
      console.error(`[watch] FAIL ${batch.error}`)
      return
    }
    let incoming = batch.messages
    if (chatFilter) incoming = filterMessagesByChat(incoming, chatFilter)
    const fresh = dedupeMessages(incoming).filter((m) => {
      const k = messageKey(m)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    if (!fresh.length) {
      console.log(`[watch] ${new Date().toISOString()} no new messages`)
      return
    }
    let rows: unknown[] = fresh
    if (transcribe) {
      const enriched = await enrichMessages(gw, fresh, num(flags, "max-media", 5))
      rows = enriched.messages
      console.log(`[watch] ${fresh.length} new, ${enriched.transcribedCount}/${enriched.mediaCount} transcribed`)
    } else {
      console.log(`[watch] ${fresh.length} new messages`)
    }
    await appendJsonl(out, rows.map((m) => ({ received_at: new Date().toISOString(), ...(m as object) })))
  }

  await tick()
  if (once) return

  const timer = setInterval(() => void tick(), intervalMs)
  process.on("SIGINT", () => { clearInterval(timer); console.log("\n[watch] stopped"); process.exit(0) })
  await new Promise(() => {})
}

async function cmdHistoryAll(chat: string, flags: Parsed["flags"]) {
  const gw = resolveGatewayUrl(str(flags, "gateway"))
  const out = str(flags, "out", `./out/wx-history-${chat.replace(/[^\w.-]+/g, "_")}.json`)
  const txtOut = str(flags, "txt")
  const task = flag(flags, "translate") ? "translate" as const : "transcribe" as const
  const resolved = resolveWxChat(chat)
  if (resolved.resolvedFrom) console.log(`[history-all] self "${resolved.resolvedFrom}" → ${resolved.chat}`)

  if (flag(flags, "transcribe") || flag(flags, "translate") || txtOut) {
    const result = await transcribeChatMedia({
      gatewayUrl: gw,
      chat,
      maxMedia: num(flags, "max-media", 9999),
      task,
      pageSize: num(flags, "page-size", 500),
      maxPages: num(flags, "max-pages", 50),
      since: str(flags, "since") || undefined,
      until: str(flags, "until") || undefined,
      type: str(flags, "type") || undefined,
    })
    if (!result.ok) {
      console.error(result.error)
      process.exit(1)
    }
    const payload = {
      requestedChat: chat,
      chat: result.chat,
      resolvedFrom: result.resolvedFrom,
      resolvedChat: result.resolvedChat,
      task,
      count: result.messageCount,
      mediaCount: result.mediaCount,
      transcribedCount: result.transcribedCount,
      messages: result.messages,
      transcriptions: result.transcriptions,
      transcriptRows: result.transcriptRows,
    }
    await mkdir(path.dirname(out), { recursive: true })
    await writeFile(out, JSON.stringify(payload, null, 2))
    const txtPath = txtOut || `./out/wx-transcript-${chat.replace(/[^\w.-]+/g, "_")}.txt`
    await writeEvidenceOutputs({
      flags,
      chat,
      contact: result.chat,
      txtOut: txtPath,
      evidenceBody: result.transcriptEvidenceText,
      fullBody: result.transcriptText,
      detailedBody: result.transcriptDetailedText,
      rows: result.transcriptRows,
      mediaCount: result.mediaCount,
      transcribedCount: result.transcribedCount,
      logPrefix: "[history-all]",
    })
    console.log(`[history-all] ${result.messageCount} messages, ${result.transcribedCount}/${result.mediaCount} media → text`)
    console.log(`[history-all] json → ${out}`)
    console.log(`[history-all] txt  → ${txtPath}`)
    return
  }

  console.log(`[history-all] fetching "${chat}"…`)
  const all = await fetchAllWxHistory(chat, {
    pageSize: num(flags, "page-size", 500),
    maxPages: num(flags, "max-pages", 50),
    since: str(flags, "since") || undefined,
    until: str(flags, "until") || undefined,
    type: str(flags, "type") || undefined,
  })
  if (!all.ok) {
    console.error(all.error)
    process.exit(1)
  }

  let messages = all.messages
  let transcriptions: unknown[] = []
  if (flag(flags, "transcribe")) {
    const enriched = await enrichMessages(gw, messages, num(flags, "max-media", 9999))
    messages = enriched.messages
    transcriptions = enriched.transcriptions
  }

  const payload = {
    requestedChat: chat,
    chat: all.chat,
    resolvedFrom: all.resolvedFrom,
    resolvedChat: all.resolvedChat,
    pages: all.pages,
    count: messages.length,
    messages,
    transcriptions,
  }
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(payload, null, 2))
  console.log(`[history-all] ${messages.length} messages (${all.pages} pages) → ${out}`)
}

async function cmdTranscribe(chat: string, flags: Parsed["flags"]) {
  const gw = resolveGatewayUrl(str(flags, "gateway"))
  const out = str(flags, "out", `./out/wx-transcript-${chat.replace(/[^\w.-]+/g, "_")}.json`)
  const txtOut = str(flags, "txt", `./out/wx-transcript-${chat.replace(/[^\w.-]+/g, "_")}.txt`)
  const task = flag(flags, "translate") ? "translate" as const : "transcribe" as const

  console.log(`[transcribe] chat="${chat}" task=${task}`)
  const result = await transcribeChatMedia({
    gatewayUrl: gw,
    chat,
    maxMedia: num(flags, "max-media", 9999),
    task,
    pageSize: num(flags, "page-size", 500),
    maxPages: num(flags, "max-pages", 50),
    since: str(flags, "since") || undefined,
    until: str(flags, "until") || undefined,
    type: str(flags, "type") || undefined,
  })
  if (!result.ok) {
    console.error(result.error)
    process.exit(1)
  }

  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify({
    requestedChat: chat,
    chat: result.chat,
    task,
    mediaCount: result.mediaCount,
    transcribedCount: result.transcribedCount,
    transcriptRows: result.transcriptRows,
    transcriptions: result.transcriptions,
    transcriptText: result.transcriptText,
    transcriptEvidenceText: result.transcriptEvidenceText,
  }, null, 2))

  await writeEvidenceOutputs({
    flags,
    chat,
    contact: result.chat,
    txtOut,
    evidenceBody: result.transcriptEvidenceText,
    fullBody: result.transcriptText,
    detailedBody: result.transcriptDetailedText,
    rows: result.transcriptRows,
    mediaCount: result.mediaCount,
    transcribedCount: result.transcribedCount,
  })

  console.log(`[transcribe] ${result.transcribedCount}/${result.mediaCount} audio/video → text (${result.transcriptText.length} chars)`)
  console.log(`[transcribe] txt  → ${txtOut}`)
  console.log(`[transcribe] json → ${out}`)
  for (const row of result.transcriptRows.filter((r) => r.ok && r.text)) {
    console.log(`\n--- ${row.time ?? ""} [${row.kind}] (${row.text.length} chars) ---`)
    console.log(row.text)
  }
}

async function cmdReformatEvidence(flags: Parsed["flags"]) {
  const jsonPath = str(flags, "from", "./out/wx-transcript-cream481735.json")
  const txtOut = str(flags, "txt", "./out/cream481735-final.txt")
  const raw = JSON.parse(await readFile(jsonPath, "utf-8")) as {
    requestedChat?: string
    chat?: string
    mediaCount?: number
    transcribedCount?: number
    transcriptRows?: MediaTranscriptRow[]
    transcriptText?: string
    transcriptEvidenceText?: string
  }
  const rows = raw.transcriptRows ?? []
  if (!rows.length) {
    console.error("[reformat-evidence] no transcriptRows in JSON")
    process.exit(1)
  }
  const requestedChat = raw.requestedChat ?? "unknown"
  const contact = raw.chat ?? requestedChat
  const evidenceBody = raw.transcriptEvidenceText ?? formatEvidenceTranscriptText(rows, contact)
  const fullBody = raw.transcriptText
    ?? rows.filter((r) => r.ok && r.text.trim()).map((r) => r.text.trim()).join("\n\n") + "\n"

  await writeEvidenceOutputs({
    flags,
    chat: requestedChat,
    contact,
    txtOut,
    evidenceBody,
    fullBody,
    rows,
    mediaCount: raw.mediaCount,
    transcribedCount: raw.transcribedCount,
    logPrefix: "[reformat-evidence]",
  })
  console.log(`[reformat-evidence] ${rows.length} rows reformatted (no re-STT) → ${txtOut}`)
}

async function cmdScanMedia(flags: Parsed["flags"]) {
  const root = readWxStorageRoot()
  if (!root) {
    console.error("[scan-media] no wx storage root (~/.wx-cli/config.json)")
    process.exit(1)
  }
  const month = str(flags, "month") || undefined
  const videos = listCachedVideosInAttach(root, month)
  console.log(`[scan-media] ${videos.length} cached mp4 under msg/attach${month ? ` (${month})` : ""}`)
  for (const v of videos) console.log(`  ${v}`)
}

async function cmdMediaToText(filePath: string, flags: Parsed["flags"]) {
  const gw = resolveGatewayUrl(str(flags, "gateway"))
  const task = flag(flags, "translate") ? "translate" as const : "transcribe" as const
  const txtOut = str(flags, "txt", `./out/media-${path.basename(filePath).replace(/[^\w.-]+/g, "_")}.txt`)
  const jsonOut = str(flags, "out", txtOut.replace(/\.txt$/i, ".json"))
  const workDir = str(flags, "work-dir") || undefined

  console.log(`[media-to-text] ${filePath} task=${task}`)
  const result = await transcribeMediaFile(gw, filePath, { task, workDir })
  const payload = { input: filePath, task, ...result }

  await mkdir(path.dirname(txtOut), { recursive: true })
  await writeFile(jsonOut, JSON.stringify(payload, null, 2), "utf-8")

  const txtBody = flag(flags, "detailed-txt")
    ? [
        `# media transcript (${task})`,
        `source: ${filePath}`,
        result.videoPath ? `video: ${result.videoPath}` : "",
        result.audioPath ? `audio: ${result.audioPath}` : "",
        result.steps?.length ? `steps: ${result.steps.join(" → ")}` : "",
        "",
        result.ok ? result.text ?? "" : `(failed: ${result.error})`,
      ].filter((l, i) => l !== "" || i >= 5).join("\n").trimEnd() + "\n"
    : `${result.text ?? ""}\n`

  await writeFile(txtOut, txtBody, "utf-8")

  if (!result.ok) {
    console.error(`[media-to-text] FAIL ${result.error}`)
    process.exit(1)
  }

  console.log(`[media-to-text] steps: ${result.steps?.join(" → ")}`)
  console.log(`[media-to-text] ${result.text?.length ?? 0} chars → ${txtOut}`)
  console.log(`[media-to-text] json → ${jsonOut}`)
  console.log(`\n${result.text ?? ""}`)
}

function resolveRepoPlugin(flags: Parsed["flags"], repoSlug?: string | null) {
  return (
    resolveCliWorkspacePluginSlug({
      pluginFlag: str(flags, "plugin") || undefined,
      githubRepo: repoSlug ?? (str(flags, "repo") || undefined),
    }) ?? undefined
  )
}

async function cmdConnector(sub: string | undefined, positional: string[], flags: Parsed["flags"]) {
  const serverUrl = resolveNeuraServerUrl(str(flags, "server"))
  const repoFlag = str(flags, "repo") || positional[0] || undefined
  const pluginSlug = resolveRepoPlugin(flags, repoFlag) ?? SOFTWARE_EVOL_OS_PLUGIN_SLUG
  const json = flag(flags, "json")

  if (sub === "list" || !sub) {
    if (json) {
      const cat = (await import("@/lib/plugins/plugin-repo-workspace")).loadPluginConnectorCatalog(
        pluginSlug,
      )
      console.log(JSON.stringify(cat, null, 2))
      return
    }
    console.error(`[connector] catalog (${pluginSlug}) — assets/connectors/connectors.yaml`)
    for (const line of catalogConnectorHints(pluginSlug)) console.error(line)
    console.error(`[connector] reference: https://github.com/anthropics/knowledge-work-plugins`)
    return
  }

  if (sub === "status") {
    const { fetchCliDeliveryRepo } = await import("@/lib/neura-cli/repo-client")
    const r = await fetchCliDeliveryRepo({
      serverUrl,
      connectors: true,
      pluginSlug,
      repo: repoFlag,
    })
    if (!r.ok) {
      console.error(r.error ?? `HTTP ${r.status}`)
      process.exit(1)
    }
    if (json) {
      console.log(JSON.stringify(r.data, null, 2))
      return
    }
    console.error(`[connector] plugin=${pluginSlug} repo=${r.data?.config?.slug ?? repoFlag ?? "(saved)"}`)
    if (r.data?.connectors?.length) {
      for (const line of formatConnectorLines(r.data.connectors)) console.error(line)
    }
    const pending = r.data?.connectors?.filter((c) => c.status !== "connected" && c.required) ?? []
    if (pending.length) {
      console.error(`[connector] required pending: ${pending.map((c) => c.id).join(", ")}`)
      console.error(`[connector] run: neura connector import --plugin ${pluginSlug}`)
    }
    return
  }

  if (sub === "import") {
    const servicesRaw = str(flags, "services")
    const services = servicesRaw
      ? servicesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined
    const r = await importNeuraPluginMcp(pluginSlug, { serverUrl, services })
    if (!r.ok) {
      console.error(r.error ?? `HTTP ${r.status}`)
      process.exit(1)
    }
    if (json) {
      console.log(JSON.stringify(r.data, null, 2))
      return
    }
    console.error(
      `[connector] import ${pluginSlug}: imported=${r.data?.summary.imported} skipped=${r.data?.summary.skipped} pending_url=${r.data?.summary.pending_url}`,
    )
    for (const row of r.data?.results ?? []) {
      console.error(`  ${row.service}: ${row.status}${row.id ? ` (${row.id})` : ""}`)
    }
    return
  }

  console.error("usage: connector list | connector status [--repo owner/repo] | connector import")
  process.exit(1)
}

async function cmdRepo(sub: string | undefined, positional: string[], flags: Parsed["flags"]) {
  const serverUrl = resolveNeuraServerUrl(str(flags, "server"))
  const repoFlag = str(flags, "repo") || undefined
  const pluginSlug = resolveRepoPlugin(flags, repoFlag ?? positional[0])
  const json = flag(flags, "json")
  const onProgress = (line: string) => console.error(line)

  if (sub === "show" || !sub) {
    const { fetchCliDeliveryRepo } = await import("@/lib/neura-cli/repo-client")
    const r = await fetchCliDeliveryRepo({
      serverUrl,
      connectors: flag(flags, "connectors"),
      pluginSlug,
      repo: repoFlag,
    })
    if (!r.ok) {
      console.error(r.error ?? `HTTP ${r.status}`)
      process.exit(1)
    }
    if (json) {
      console.log(JSON.stringify(r.data, null, 2))
      return
    }
    const cfg = r.data?.config
    if (!cfg) {
      console.error("[repo] no delivery repo — use: repo set owner/repo  or  repo show --repo owner/repo")
      process.exit(1)
    }
    console.error(`[repo] ${cfg.slug} branch=${cfg.defaultBranch}`)
    const suggested = (r.data as { suggestedWorkspace?: string })?.suggestedWorkspace
    console.error(
      `[repo] workspace=${cfg.clonePath ?? suggested ?? "(set via NEURA_WORKSPACE_ROOT or ~/.neura/.workspace)"}`,
    )
    console.error(`[repo] token=${cfg.hasToken ? "configured" : "missing (Desk /connectors or GITHUB_TOKEN)"}`)
    if (pluginSlug) console.error(`[repo] plugin=${pluginSlug}`)
    if ("connectors" in (r.data ?? {}) && Array.isArray(r.data?.connectors)) {
      console.error("[repo] connectors:")
      for (const line of formatConnectorLines(r.data!.connectors!)) console.error(line)
      if (!r.data!.connectors!.length && pluginSlug) {
        console.error(`  (no connectors.yaml for ${pluginSlug})`)
      } else if (!r.data!.connectors!.length) {
        console.error("  pass --plugin PLUGIN_SLUG with --connectors (from domain route, not hardcoded)")
      }
    }
    return
  }

  const slug = positional[0]?.trim() || repoFlag
  if (!slug) {
    console.error("usage: repo set|ensure <owner/repo>  (or repo show --repo owner/repo)")
    process.exit(1)
  }
  const parsed = parseCliRepoSlug(slug)
  if (!parsed) {
    console.error(`invalid repo: ${slug}`)
    process.exit(1)
  }

  if (sub === "ensure" || (sub === "set" && flag(flags, "ensure"))) {
    const workDir =
      str(flags, "work-dir") ||
      resolvePluginWorkspaceForRepo(parsed.owner, parsed.repo, pluginSlug)
    const ws = await ensurePluginRepoWorkspace(slug, {
      pluginSlug,
      branch: str(flags, "branch") || undefined,
      workspacePath: workDir,
      onProgress,
    })
    console.error(`[repo] ready ${ws.slug} → ${ws.workspacePath}`)
    if (sub === "ensure") return
  }

  if (sub === "set") {
    const { config, workspace } = await bindRepoForCli(slug, {
      serverUrl,
      pluginSlug,
      branch: str(flags, "branch") || undefined,
      onProgress: flag(flags, "ensure") ? onProgress : undefined,
    })
    if (json) {
      console.log(JSON.stringify({ config, workspace }, null, 2))
      return
    }
    console.error(`[repo] saved ${config.slug} workspace=${workspace.workspacePath}`)
    const { fetchCliDeliveryRepo: fetchRepo } = await import("@/lib/neura-cli/repo-client")
    const conn = await fetchRepo({
      serverUrl,
      connectors: true,
      pluginSlug,
      repo: slug,
    })
    if (conn.ok && conn.data?.connectors) {
      for (const line of formatConnectorLines(conn.data.connectors)) console.error(line)
    }
    return
  }

  console.error("usage: repo show | repo set <owner/repo> | repo ensure <owner/repo>")
  console.error("\nConnector catalog (knowledge-work-plugins style):")
  if (pluginSlug) {
    for (const line of catalogConnectorHints(pluginSlug)) console.error(line)
  } else {
    console.error("  pass --plugin PLUGIN_SLUG to list connector catalog for a routed plugin")
  }
  process.exit(1)
}

async function cmdSend(message: string, flags: Parsed["flags"]) {
  const serverUrl = resolveNeuraServerUrl(str(flags, "server"))
  const timeoutMs = num(flags, "timeout", 600) * 1000
  const pollMs = num(flags, "poll", 2) * 1000
  const json = flag(flags, "json")
  const metricActuals: Record<string, number> = {}
  for (const [k, v] of Object.entries(flags)) {
    if (k.startsWith("metric-") && typeof v === "string") {
      const name = k.slice("metric-".length)
      const n = Number(v)
      if (name && Number.isFinite(n)) metricActuals[name] = n
    }
  }
  const metricFlag = str(flags, "metric")
  if (metricFlag) {
    for (const part of metricFlag.split(",")) {
      const [name, val] = part.split("=").map((s) => s.trim())
      const n = Number(val)
      if (name && Number.isFinite(n)) metricActuals[name] = n
    }
  }

  const repoSlug = str(flags, "repo") || undefined
  const workspacePlugin = resolveCliWorkspacePluginSlug({
    pluginFlag: str(flags, "plugin") || undefined,
    githubRepo: repoSlug,
  })
  const onProgress = (line: string) => console.error(line)
  if (repoSlug) {
    const parsed = parseCliRepoSlug(repoSlug)
    if (!parsed) {
      console.error(`invalid --repo: ${repoSlug}`)
      process.exit(1)
    }
    onProgress(
      `[send] githubRepo=${parsed.slug} workspacePlugin=${workspacePlugin ?? "(none)"}`,
    )
  }

  console.error(`[${NEURA.cli}] send server=${serverUrl}`)
  const { submit, result } = await runSendMessage(message, {
    serverUrl,
    timeoutMs,
    pollMs,
    githubRepo: repoSlug,
    pluginSlug: workspacePlugin,
    saveRepo: !flag(flags, "no-save-repo"),
    ensureRepo: flag(flags, "ensure-repo") || Boolean(repoSlug),
    onProgress,
    useRunner: flag(flags, "use-runner"),
    runnerId: str(flags, "runner-id") || undefined,
    workDir: str(flags, "work-dir") || undefined,
    useGitHubActions: flag(flags, "github-ci"),
    waitForGitHubActions: flag(flags, "github-ci-no-wait") ? false : undefined,
    openGitHubPr: flag(flags, "github-pr"),
    openGitLabMr: flag(flags, "gitlab-mr"),
    notifyChannel: flag(flags, "notify-channel")
      ? true
      : flag(flags, "no-notify-channel")
        ? false
        : undefined,
    enrich: flag(flags, "enrich"),
    forceRun: flag(flags, "force-run"),
    noCache: flag(flags, "no-cache"),
    workflowFailed: flag(flags, "workflow-failed"),
    metricActuals: Object.keys(metricActuals).length ? metricActuals : undefined,
    onStatus: (s) => console.error(`[send] task=${s.taskId} status=${s.status}`),
  })
  if (json) {
    console.log(JSON.stringify({ submit, result }, null, 2))
    if (result.status === "failed") process.exit(1)
    return
  }
  if (submit.reused) {
    console.error(
      `[send] similar case reused (score=${submit.similarCase?.score?.toFixed(2) ?? "?"}) — use --force-run for fresh LLM`,
    )
  }
  if (submit.intent?.pluginSlug) {
    console.error(`[send] routed domain=${submit.intent.domain} plugin=${submit.intent.pluginSlug}`)
  }
  if (submit.deliveryRepo?.slug) {
    console.error(
      `[send] deliveryRepo=${submit.deliveryRepo.slug} workspace=${submit.deliveryRepo.workspacePath ?? ""} plugin=${submit.deliveryRepo.orchestrationPlugin ?? submit.intent?.pluginSlug ?? ""}`,
    )
    if (submit.deliveryRepo.connectors?.length) {
      console.error("[send] connectors:")
      for (const line of formatConnectorLines(
        submit.deliveryRepo.connectors.map((c) => ({
          id: c.id,
          label: c.id,
          status: c.status,
          required: Boolean(c.required),
        })),
      )) {
        console.error(line)
      }
    }
  }
  if (submit.workflow?.name) {
    console.error(`[send] workflow=${submit.workflow.name} skills=${submit.workflow.skills?.join(",") ?? ""}`)
  }
  const output = formatTaskResult(result)
  console.log(output)
  if (result.status === "failed" || output.startsWith("ERROR:")) process.exit(1)
  if (result.status === "awaiting_approval" || result.status === "pending_review") {
    console.error(`[send] awaiting approval — open ${submit.deskPath ?? result.deskPath ?? "NeuraDesk /collab"}`)
  }
}

async function cmdServiceRegister(flags: Parsed["flags"]) {
  const gatewayUrl = resolveGatewayUrl(str(flags, "gateway"))
  const serviceId = str(flags, "id")
  if (!serviceId) {
    console.error("usage: service register --id SERVICE_ID")
    process.exit(1)
  }
  let ports: Record<string, number> | undefined
  const portsRaw = str(flags, "ports")
  if (portsRaw) {
    try {
      const parsed = JSON.parse(portsRaw) as Record<string, unknown>
      ports = {}
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(v)
        if (!Number.isFinite(n)) {
          console.error(`invalid port value for ${k}: ${v}`)
          process.exit(1)
        }
        ports[k] = n
      }
    } catch (e) {
      console.error(`--ports must be JSON object: ${e}`)
      process.exit(1)
    }
  }
  let startable: boolean | undefined
  const startableRaw = str(flags, "startable")
  if (startableRaw) {
    startable = ["1", "true", "yes"].includes(startableRaw.toLowerCase())
  }
  const result = await registerCatalogService(gatewayUrl, {
    serviceId,
    description: str(flags, "description"),
    workingDir: str(flags, "working-dir") || undefined,
    entryPoint: str(flags, "entry-point") || undefined,
    schemaRef: str(flags, "schema-ref") || undefined,
    manifestRef: str(flags, "manifest-ref") || undefined,
    ports,
    autoAllocate: flag(flags, "no-auto-allocate") ? false : undefined,
    overwrite: flag(flags, "overwrite"),
    startable,
  })
  if (!result.ok) {
    console.error(`register failed (HTTP ${result.status}): ${result.error}`)
    process.exit(1)
  }
  if (flag(flags, "json")) {
    console.log(JSON.stringify(result.data, null, 2))
    return
  }
  console.log(JSON.stringify(result.data, null, 2))
}

async function main() {
  const cmd = process.argv[2]
  const p = parseArgs(process.argv.slice(3))
  process.env.DATAPROAI_GATEWAY_URL = resolveGatewayUrl(str(p.flags, "gateway"))

  if (!cmd || cmd === "help" || flag(p.flags, "help")) {
    printHelp()
    return
  }

  if (cmd === "service") {
    const sub = p.sub ?? "help"
    if (sub === "register") {
      await cmdServiceRegister(p.flags)
      return
    }
    printHelp()
    process.exit(sub === "help" ? 0 : 1)
  }

  if (cmd === "task") {
    const sub = p.sub ?? "help"
    if (sub === "action") {
      const taskId = p.positional[0]
      const action = p.positional[1]
      if (!taskId || !action) {
        console.error("usage: task action <taskId> <action> [--connector slack]")
        process.exit(1)
      }
      const server = str(p.flags, "server") || undefined
      const r = await runCollabTaskAction({
        taskId,
        action,
        connectorId: str(p.flags, "connector") || undefined,
        serverUrl: server,
      })
      if (flag(p.flags, "json")) {
        console.log(JSON.stringify(r, null, 2))
      } else if (!r.ok) {
        console.error(r.error ?? `HTTP ${r.status}`)
      } else {
        console.log(JSON.stringify(r.data, null, 2))
      }
      process.exit(r.ok ? 0 : 1)
    }
    printHelp()
    process.exit(sub === "help" ? 0 : 1)
  }

  if (cmd === "send") {
    const sendArgs = parseArgs(process.argv.slice(3), false)
    const message = sendArgs.positional.join(" ").trim()
    if (!message) { console.error("usage: send <message>"); process.exit(1) }
    await cmdSend(message, sendArgs.flags)
    return
  }

  if (cmd === "repo") {
    await cmdRepo(p.sub, p.positional, p.flags)
    return
  }

  if (cmd === "connector") {
    await cmdConnector(p.sub, p.positional, p.flags)
    return
  }

  if (cmd !== "wx") {
    console.error(
      "usage: bun scripts/neura-cli.ts send <message> | repo … | connector … | task action … | service register … | wx <subcommand>",
    )
    process.exit(1)
  }

  const sub = p.sub ?? "help"
  const chat = p.positional[0] ?? str(p.flags, "chat")

  switch (sub) {
    case "watch":
      await cmdWatch(p.flags, chat || undefined)
      break
    case "history-all":
      if (!chat) { console.error("usage: history-all <chat>"); process.exit(1) }
      await cmdHistoryAll(chat, p.flags)
      break
    case "transcribe":
      if (!chat) { console.error("usage: transcribe <chat>"); process.exit(1) }
      await cmdTranscribe(chat, p.flags)
      break
    case "reformat-evidence":
      await cmdReformatEvidence(p.flags)
      break
    case "scan-media":
      await cmdScanMedia(p.flags)
      break
    case "media-to-text": {
      const filePath = p.positional[0]
      if (!filePath) { console.error("usage: media-to-text <file.mp4|file.m4a>"); process.exit(1) }
      await cmdMediaToText(filePath, p.flags)
      break
    }
    case "invoke-demo": {
      const r = await runInvokeDemo({})
      for (const s of r.steps) console.log(`  ${s.ok ? "OK" : "FAIL"} ${s.step}${s.detail ? ` — ${s.detail}` : ""}`)
      if (!r.ok) process.exit(1)
      console.log(`[${NEURA.cli}] invoke-demo PASSED — ${r.transcription}`)
      break
    }
    default:
      printHelp()
      process.exit(sub === "help" ? 0 : 1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
