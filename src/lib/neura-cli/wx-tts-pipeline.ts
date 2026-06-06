import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import path from "path"
import { gatewayToolCall, resolveGatewayUrl, serviceHealth } from "@/lib/neura-cli/gateway-tools"
import { runWxJson } from "@/lib/neura-cli/wx-direct"
import { isAudioFileMessage, isVideoFileMessage, readWxStorageRoot, resolveAttachVideosForMessage, resolveWxMediaFilePath } from "@/lib/neura-cli/wx-media-path"
import { buildMediaTranscriptRows, formatEvidenceTranscriptText, formatTranscriptText } from "@/lib/neura-cli/wx-media-transcript"
import { isLowQualityStt, normalizeTranscriptText, pickVideoTranscript, postProcessStt, cjkRatio } from "@/lib/neura-cli/transcript-quality"
import { extractAudioFromVideo, isVideoPath, mediaKindFromPath } from "@/lib/neura-cli/video-audio"
import {
  extractWeChatMergedChatText,
  isWeChatMergedRecordMessage,
  messageToYoutubeMediaItem,
  parseWeChatMergedChatDialogue,
  skipReasonForWeChatMedia,
  transcribeRemoteMediaBatch,
} from "@/lib/neura-cli/youtube-media"

export type WxMessage = Record<string, unknown>
export type TranscriptionResult = {
  file: string
  ok: boolean
  text?: string
  engine?: string | null
  error?: string
  via?: string
  kind?: "audio" | "video" | "remote"
  videoPath?: string
  audioPath?: string
  steps?: string[]
}

const MEDIA_TYPES = new Set(["voice", "video", "audio", "34", "43"])
const MEDIA_CONTENT = /\[语音\]|\[视频\]/i
const DEFAULT_SELF_ALIASES = new Set(["jack", "self", "me", "@me", "myself"])

export function ownWxIdFromDbDir(dbDir: string): string | null {
  const m = dbDir.match(/xwechat_files\/(wxid_[a-z0-9]+)_/i)
  return m?.[1] ?? null
}

export function readOwnWxId(configPath = path.join(homedir(), ".wx-cli/config.json")): string | null {
  if (!existsSync(configPath)) return null
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as { db_dir?: string }
    return cfg.db_dir ? ownWxIdFromDbDir(cfg.db_dir) : null
  } catch {
    return null
  }
}

export function buildSelfAliases(): Set<string> {
  const aliases = new Set(DEFAULT_SELF_ALIASES)
  for (const a of (process.env.WX_CLI_SELF_ALIASES ?? "").split(",")) {
    const x = a.trim().toLowerCase()
    if (x) aliases.add(x)
  }
  const selfName = (process.env.WX_CLI_SELF_NAME ?? "jack").trim().toLowerCase()
  if (selfName) aliases.add(selfName)
  return aliases
}

function lookupContactUsername(query: string): string | null {
  const timeoutMs = Number(process.env.WX_CLI_CONTACT_LOOKUP_MS ?? "4000")
  const r = runWxJson(["contacts", "--query", query], timeoutMs)
  if (!r.ok || !Array.isArray(r.data)) return null
  const row = (r.data as Array<{ username?: string }>)[0]
  return row?.username?.trim() || null
}

export function resolveWxChat(chat: string): {
  chat: string
  resolvedFrom?: string
  ownWxId?: string
  weixinId?: string | null
} {
  const trimmed = chat.trim()
  const lower = trimmed.toLowerCase()
  const weixinId = (process.env.WX_CLI_WEIXIN_ID ?? "").trim() || null
  const ownWxId = readOwnWxId()

  if (ownWxId && buildSelfAliases().has(lower)) {
    return { chat: ownWxId, resolvedFrom: trimmed, ownWxId, weixinId }
  }

  if (weixinId && lower === weixinId.toLowerCase() && ownWxId) {
    const contactUsername = lookupContactUsername(trimmed)
    if (contactUsername && contactUsername !== ownWxId) {
      return { chat: contactUsername, weixinId }
    }
    return { chat: ownWxId, resolvedFrom: trimmed, ownWxId, weixinId }
  }

  const contactUsername = lookupContactUsername(trimmed)
  if (contactUsername) return { chat: contactUsername, weixinId }

  return { chat: trimmed, weixinId }
}

export function unwrapWxMessages(data: unknown): WxMessage[] {
  if (!data || typeof data !== "object") return []
  const root = data as Record<string, unknown>
  const inner = root.data ?? root
  if (Array.isArray(inner)) return inner as WxMessage[]
  if (inner && typeof inner === "object") {
    const o = inner as Record<string, unknown>
    if (Array.isArray(o.messages)) return o.messages as WxMessage[]
  }
  return []
}

export function isMediaMessage(msg: WxMessage): boolean {
  const type = String(msg.type ?? "").toLowerCase()
  if (MEDIA_TYPES.has(type)) return true
  if (isAudioFileMessage(msg)) return true
  if (isVideoFileMessage(msg)) return true
  return MEDIA_CONTENT.test(String(msg.content ?? ""))
}

export function mediaFilePath(msg: WxMessage, storageRoot?: string | null): string | null {
  return resolveWxMediaFilePath(msg, storageRoot ?? readWxStorageRoot())
}

export function enrichHistory(messages: WxMessage[], transcriptions: TranscriptionResult[]): WxMessage[] {
  const byFile = new Map<string, TranscriptionResult>()
  for (const t of transcriptions) {
    if (t.ok) {
      byFile.set(t.file, t)
      if (t.audioPath) byFile.set(t.audioPath, t)
      if (t.videoPath) byFile.set(t.videoPath, t)
    }
  }
  const storageRoot = readWxStorageRoot()
  return messages.map((msg) => {
    const fp = mediaFilePath(msg, storageRoot)
    if (!fp || !byFile.has(fp)) return msg
    const tr = byFile.get(fp)!
    return { ...msg, transcription: { text: tr.text ?? "", engine: tr.engine ?? null, source_file: fp } }
  })
}

export function messageKey(msg: WxMessage): string {
  const chat = String(msg.chat ?? msg.username ?? "")
  const id = String(msg.local_id ?? msg.timestamp ?? msg.time ?? "")
  return `${chat}:${id}`
}

export function dedupeMessages(messages: WxMessage[]): WxMessage[] {
  const seen = new Set<string>()
  const out: WxMessage[] = []
  for (const m of messages) {
    const k = messageKey(m)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(m)
  }
  return out
}

export function filterMessagesByChat(messages: WxMessage[], chat?: string): WxMessage[] {
  if (!chat?.trim()) return messages
  const resolved = resolveWxChat(chat)
  const needle = chat.trim().toLowerCase()
  const wxid = resolved.chat.toLowerCase()
  return messages.filter((m) => {
    const c = String(m.chat ?? "").toLowerCase()
    const u = String(m.username ?? "").toLowerCase()
    return c === needle || c.includes(needle) || u === wxid || c === String(resolved.resolvedFrom ?? "").toLowerCase()
  })
}

export function mergeHistoryPages(pages: WxMessage[][]): WxMessage[] {
  return dedupeMessages(pages.flat())
}

export async function fetchWxHistoryPage(
  chat: string,
  opts: { limit?: number; offset?: number; since?: string; until?: string; type?: string } = {}
) {
  const resolved = resolveWxChat(chat)
  const args = ["history", resolved.chat, "-n", String(opts.limit ?? 500)]
  if (opts.offset) args.push("--offset", String(opts.offset))
  if (opts.since) args.push("--since", opts.since)
  if (opts.until) args.push("--until", opts.until)
  if (opts.type) args.push("--type", opts.type)
  const r = runWxJson(args)
  if (!r.ok) return { ok: false as const, error: r.error, resolvedChat: resolved.chat, resolvedFrom: resolved.resolvedFrom }
  const body = (r.data ?? {}) as Record<string, unknown>
  const messages = unwrapWxMessages(body)
  return {
    ok: true as const,
    messages,
    count: Number(body.count ?? messages.length),
    displayChat: String(body.chat ?? resolved.chat),
    resolvedChat: resolved.chat,
    resolvedFrom: resolved.resolvedFrom,
    meta: body.meta as Record<string, unknown> | undefined,
  }
}

export async function fetchAllWxHistory(
  chat: string,
  opts: { pageSize?: number; maxPages?: number; since?: string; until?: string; type?: string } = {}
) {
  const pageSize = opts.pageSize ?? 500
  const maxPages = opts.maxPages ?? 50
  const pages: WxMessage[][] = []
  let displayChat = chat
  let resolvedFrom: string | undefined
  let resolvedChat: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchWxHistoryPage(chat, {
      limit: pageSize,
      offset: page * pageSize,
      since: opts.since,
      until: opts.until,
      type: opts.type,
    })
    if (!batch.ok) return page === 0 ? { ok: false as const, error: batch.error } : { ok: true as const, chat: displayChat, requestedChat: chat, resolvedFrom, resolvedChat, messages: mergeHistoryPages(pages), pages: pages.length }
    displayChat = batch.displayChat
    resolvedFrom = batch.resolvedFrom
    resolvedChat = batch.resolvedChat
    if (!batch.messages.length) break
    pages.push(batch.messages)
    if (batch.messages.length < pageSize) break
  }

  return {
    ok: true as const,
    chat: displayChat,
    requestedChat: chat,
    resolvedFrom,
    resolvedChat,
    messages: mergeHistoryPages(pages),
    pages: pages.length,
  }
}

export async function fetchNewMessages(limit = 200) {
  const r = runWxJson(["new-messages", "-n", String(limit)])
  if (!r.ok) return { ok: false as const, error: r.error }
  const body = (r.data ?? {}) as Record<string, unknown>
  const messages = Array.isArray(body.messages) ? (body.messages as WxMessage[]) : unwrapWxMessages(body)
  return { ok: true as const, messages, count: Number(body.count ?? messages.length), meta: body.meta as Record<string, unknown> | undefined }
}

export async function enrichMessages(
  gw: string,
  messages: WxMessage[],
  maxMedia = 9999,
  language = "zh",
  task: "transcribe" | "translate" = "transcribe"
) {
  const storageRoot = readWxStorageRoot()
  const withPaths = messages.map((m) => {
    const fp = mediaFilePath(m, storageRoot)
    return fp && !m.file_path ? { ...m, file_path: fp } : m
  })
  const media = withPaths.filter(isMediaMessage)
  const paths = [...new Set(media.map((m) => mediaFilePath(m, storageRoot)).filter((p): p is string => Boolean(p)))].slice(0, maxMedia)
  const pathSet = new Set(paths)
  const transcriptions: TranscriptionResult[] = []

  for (const file of paths) {
    transcriptions.push(await transcribeMediaFile(gw, file, { language, task }))
  }

  for (const msg of withPaths) {
    if (pathSet.has(String(msg.file_path ?? ""))) continue
    if (!isMediaMessage(msg)) continue
    if (transcriptions.length >= maxMedia) break
    const tr = await transcribeMessageMedia(gw, msg, { language, task, storageRoot })
    if (tr.file) transcriptions.push(tr)
  }

  const byMsgKey = new Map<string, TranscriptionResult>()
  let trIdx = paths.length
  for (const msg of withPaths) {
    if (!isMediaMessage(msg)) continue
    const fp = String(msg.file_path ?? "")
    let tr = transcriptions.find((t) => t.file === fp && fp)
    if (!tr && trIdx < transcriptions.length) {
      tr = transcriptions[trIdx]
      trIdx++
    }
    if (tr) byMsgKey.set(messageKey(msg), tr)
  }

  const enriched = enrichHistory(withPaths, transcriptions).map((msg) => {
    const tr = byMsgKey.get(messageKey(msg))
    if (tr?.ok && tr.text && !(msg as WxMessage).transcription) {
      return {
        ...msg,
        transcription: { text: tr.text, engine: tr.engine ?? null, source_file: tr.file },
      }
    }
    return msg
  })

  return { messages: enriched, transcriptions, mediaCount: media.length, transcribedCount: transcriptions.filter((t) => t.ok).length }
}

export async function wxTool(gw: string, tool: string, args: Record<string, unknown>) {
  return gatewayToolCall(gw, "wx_cli", tool, args)
}

export async function ttsTool(gw: string, tool: string, args: Record<string, unknown>, timeoutMs?: number) {
  return gatewayToolCall(gw, "tts", tool, args, timeoutMs ?? Number(process.env.NEURACLI_STT_TIMEOUT_MS ?? 120_000))
}

export type WxHistoryResult =
  | { ok: true; messages: WxMessage[]; resolvedChat: string; resolvedFrom?: string; displayChat: string }
  | { ok: false; error?: string; resolvedChat: string; resolvedFrom?: string }

export async function fetchWxHistory(gw: string, chat: string, limit = 50): Promise<WxHistoryResult> {
  const resolved = resolveWxChat(chat)
  const r = await wxTool(gw, "wx_get_history", { chat: resolved.chat, limit })
  if (!r.ok) return { ok: false as const, error: r.error, resolvedChat: resolved.chat, resolvedFrom: resolved.resolvedFrom }
  const body = (r.data ?? {}) as Record<string, unknown>
  if (body.success === false) {
    return { ok: false as const, error: String(body.error ?? "wx_get_history failed"), resolvedChat: resolved.chat, resolvedFrom: resolved.resolvedFrom }
  }
  const messages = unwrapWxMessages(body)
  const nested = !messages.length && body.data ? unwrapWxMessages(body.data) : []
  const rows = messages.length ? messages : nested
  const displayChat = String((body.data as Record<string, unknown> | undefined)?.chat ?? resolved.chat)
  return rows.length
    ? { ok: true as const, messages: rows, resolvedChat: resolved.chat, resolvedFrom: resolved.resolvedFrom, displayChat }
    : { ok: false as const, error: `no messages for ${chat}`, resolvedChat: resolved.chat, resolvedFrom: resolved.resolvedFrom }
}

export async function transcribeFile(
  gw: string,
  filePath: string,
  language = "zh",
  task: "transcribe" | "translate" = "transcribe"
): Promise<TranscriptionResult> {
  return transcribeMediaFile(gw, filePath, { language, task })
}

export async function transcribeMediaFile(
  gw: string,
  filePath: string,
  opts: { language?: string; task?: "transcribe" | "translate"; workDir?: string } = {}
): Promise<TranscriptionResult> {
  const language = opts.language ?? "zh"
  const task = opts.task ?? "transcribe"
  const steps: string[] = []

  if (!existsSync(filePath)) {
    return { file: filePath, ok: false, error: `missing: ${filePath}`, kind: mediaKindFromPath(filePath) === "video" ? "video" : "audio" }
  }

  let audioPath = filePath
  let videoPath: string | undefined

  if (isVideoPath(filePath)) {
    videoPath = filePath
    steps.push("video→audio (ffmpeg)")
    const outDir = opts.workDir ?? path.dirname(filePath)
    const extracted = extractAudioFromVideo(filePath, {
      outputPath: path.join(outDir, `${path.basename(filePath, path.extname(filePath))}.mp3`),
    })
    if (!extracted.ok) {
      return { file: filePath, ok: false, error: extracted.error, kind: "video", videoPath, steps }
    }
    audioPath = extracted.audioPath
    steps.push(extracted.cached ? "audio cached" : "audio extracted")
  }

  steps.push(`transcribe_audio (${task})`)
  const sttTimeout = videoPath
    ? Number(process.env.NEURACLI_STT_TIMEOUT_MS ?? 600_000)
    : Number(process.env.NEURACLI_STT_TIMEOUT_MS ?? 120_000)

  async function runStt(): Promise<{ ok: boolean; text: string; engine: string | null; via?: string; error?: string }> {
    const r = await ttsTool(gw, "transcribe_audio", { file_path: audioPath, language, task }, sttTimeout)
    if (!r.ok) return { ok: false, text: "", engine: null, via: (r as { via?: string }).via, error: r.error }
    const b = (r.data ?? {}) as Record<string, unknown>
    return {
      ok: true,
      text: postProcessStt(String(b.text ?? "")),
      engine: b.engine != null ? String(b.engine) : null,
      via: (r as { via?: string }).via,
    }
  }

  let stt = await runStt()
  if (!stt.ok) {
    return {
      file: filePath,
      ok: false,
      error: stt.error,
      kind: videoPath ? "video" : "audio",
      videoPath,
      audioPath,
      steps,
    }
  }

  let text = stt.text
  if (!videoPath && text.length > 40) {
    steps.push("transcribe_audio retry (pick best)")
    const retry = await runStt()
    if (retry.ok && cjkRatio(retry.text) > cjkRatio(text)) {
      text = retry.text
      stt = retry
    }
  }

  if (text && isLowQualityStt(text)) text = normalizeTranscriptText(text)
  return {
    file: filePath,
    ok: Boolean(text),
    text,
    engine: stt.engine,
    via: stt.via,
    kind: videoPath ? "video" : "audio",
    videoPath,
    audioPath,
    steps,
  }
}

export async function transcribeMessageMedia(
  gw: string,
  msg: WxMessage,
  opts: { language?: string; task?: "transcribe" | "translate"; storageRoot?: string | null } = {}
): Promise<TranscriptionResult> {
  const storageRoot = opts.storageRoot ?? readWxStorageRoot()
  const localPath = mediaFilePath(msg, storageRoot)
  if (localPath) return transcribeMediaFile(gw, localPath, opts)

  const mergedText = extractWeChatMergedChatText(String(msg.content ?? ""))
  const dialogue = parseWeChatMergedChatDialogue(String(msg.content ?? ""))
  if (isWeChatMergedRecordMessage(msg) || mergedText || dialogue.length) {
    const attachVideos = resolveAttachVideosForMessage(msg, storageRoot)
    const steps: string[] = []
    let videoIdx = 0
    const lines: string[] = []

    for (let i = 0; i < dialogue.length; i++) {
      const d = dialogue[i]!
      if (d.kind === "video" && attachVideos[videoIdx]) {
        const vp = attachVideos[videoIdx]!
        videoIdx++
        steps.push(`video→audio→text ${path.basename(vp)}`)
        const tr = await transcribeMediaFile(gw, vp, opts)
        const next = dialogue[i + 1]
        const description = next && next.kind === "text" && !next.text.startsWith("[") ? next.text : undefined
        const body = pickVideoTranscript(tr.text, description)
        lines.push(`${d.speaker}：${body}`)
        if (description && next) i++
      } else if (d.kind === "video") {
        lines.push(`${d.speaker}：${d.text}`)
      } else {
        lines.push(`${d.speaker}：${d.text}`)
      }
    }

    const text = lines.length
      ? lines.join("\n")
      : mergedText ?? dialogue.map((d) => `${d.speaker}：${d.text}`).join("\n")

    return {
      file: String(msg.url ?? msg.content ?? "wechat-merged-record").slice(0, 200),
      ok: Boolean(text),
      text,
      engine: videoIdx > 0 ? "wechat-merged+whisper" : "wechat-merged-inline",
      via: videoIdx > 0 ? "local+gateway" : "local",
      kind: "remote",
      videoPath: attachVideos[0],
      steps: videoIdx > 0 ? steps : ["extract merged chat quoted text (skip yt-dlp)"],
    }
  }

  const attachVideos = resolveAttachVideosForMessage(msg, storageRoot)
  if (attachVideos[0] && String(msg.content ?? "").includes("[视频]")) {
    return transcribeMediaFile(gw, attachVideos[0], opts)
  }

  const remote = messageToYoutubeMediaItem(msg)
  if (remote) {
    const batch = await transcribeRemoteMediaBatch(gw, [remote], {
      language: opts.language,
      maxItems: 1,
    })
    const item = batch.items?.[0]
    const text = item?.text ?? ""
    return {
      file: String(remote.video_url ?? remote.source_url ?? "remote"),
      ok: Boolean(text),
      text,
      engine: item?.status === "transcribed" ? "youtube-batch" : null,
      via: "youtube",
      kind: "remote",
      videoPath: item?.media_path,
      audioPath: item?.audio_path,
      steps: ["youtube_transcribe_media_batch"],
      error: item?.error ?? batch.error,
    }
  }

  const label = String(msg.content ?? msg.type ?? "media").slice(0, 200)
  const skip = skipReasonForWeChatMedia(msg)
  return {
    file: label,
    ok: false,
    error: skip ?? "no local media file or downloadable remote URL",
    kind: "audio",
    steps: skip ? ["skipped remote download"] : undefined,
  }
}

export async function transcribeChatMedia(opts: {
  gatewayUrl?: string
  chat: string
  maxMedia?: number
  language?: string
  task?: "transcribe" | "translate"
  pageSize?: number
  maxPages?: number
  since?: string
  until?: string
  type?: string
}) {
  const gw = resolveGatewayUrl(opts.gatewayUrl)
  const all = await fetchAllWxHistory(opts.chat, {
    pageSize: opts.pageSize ?? 500,
    maxPages: opts.maxPages ?? 50,
    since: opts.since,
    until: opts.until,
    type: opts.type,
  })
  if (!all.ok) return { ok: false as const, error: all.error }

  const task = opts.task ?? "transcribe"
  const maxMedia = opts.maxMedia ?? 9999
  const enriched = await enrichMessages(gw, all.messages, maxMedia, opts.language ?? "zh", task)
  const rows = buildMediaTranscriptRows(enriched.messages, enriched.transcriptions)
  const transcriptText = formatTranscriptText(rows, all.chat ?? opts.chat, "full")
  const transcriptDetailedText = formatTranscriptText(rows, all.chat ?? opts.chat, "detailed")
  const transcriptEvidenceText = formatEvidenceTranscriptText(rows, all.chat ?? opts.chat)

  return {
    ok: true as const,
    chat: all.chat,
    requestedChat: opts.chat,
    resolvedFrom: all.resolvedFrom,
    resolvedChat: all.resolvedChat,
    messageCount: enriched.messages.length,
    mediaCount: enriched.mediaCount,
    transcribedCount: enriched.transcribedCount,
    messages: enriched.messages,
    transcriptions: enriched.transcriptions,
    transcriptRows: rows,
    transcriptText,
    transcriptDetailedText,
    transcriptEvidenceText,
  }
}

export async function enrichChatHistory(opts: {
  gatewayUrl?: string
  chat: string
  limit?: number
  maxMedia?: number
  language?: string
  task?: "transcribe" | "translate"
}) {
  const gw = resolveGatewayUrl(opts.gatewayUrl)
  const history = await fetchWxHistory(gw, opts.chat, opts.limit ?? 50)
  if (!history.ok) return { ok: false as const, error: history.error }
  const media = history.messages.filter(isMediaMessage)
  const storageRoot = readWxStorageRoot()
  const paths = [...new Set(media.map((m) => mediaFilePath(m, storageRoot)).filter((p): p is string => Boolean(p)))].slice(0, opts.maxMedia ?? 999)
  const transcriptions: TranscriptionResult[] = []
  for (const file of paths) transcriptions.push(await transcribeMediaFile(gw, file, { language: opts.language ?? "zh", task: opts.task }))
  return {
    ok: true as const,
    result: {
      chat: history.displayChat ?? history.resolvedChat ?? opts.chat,
      requestedChat: opts.chat,
      resolvedFrom: history.resolvedFrom,
      ownWxId: readOwnWxId(),
      weixinId: (process.env.WX_CLI_WEIXIN_ID ?? "").trim() || null,
      gatewayUrl: gw,
      messages: enrichHistory(history.messages, transcriptions),
      mediaCount: media.length,
      transcribedCount: transcriptions.filter((t) => t.ok).length,
      transcriptions,
    },
  }
}

export async function generateSrtFromText(ttsApi: string, text: string) {
  const res = await fetch(`${ttsApi.replace(/\/$/, "")}/tts/srt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, boundary: "SentenceBoundary" }),
    signal: AbortSignal.timeout(120_000),
  })
  const body = (await res.json()) as Record<string, unknown>
  return res.ok && body.success ? { ok: true as const, data: body } : { ok: false as const, error: JSON.stringify(body) }
}

export async function runInvokeDemo(opts: { gatewayUrl?: string; ttsApi?: string; text?: string }) {
  const gatewayUrl = resolveGatewayUrl(opts.gatewayUrl)
  const ttsApi = opts.ttsApi ?? "http://127.0.0.1:10320"
  const text = opts.text ?? "你好，这是 NeuraCLI 语音转写测试。"
  const steps: Array<{ step: string; ok: boolean; detail?: string }> = []
  const srt = await generateSrtFromText(ttsApi, text)
  if (!srt.ok || !srt.data) return { ok: false, steps: [{ step: "POST /tts/srt", ok: false, detail: srt.error }] }
  const audioPath = String(srt.data.audio_path ?? "")
  const srtPath = String(srt.data.srt_path ?? srt.data.subtitle_path ?? "")
  steps.push({ step: "POST /tts/srt", ok: true, detail: `${audioPath} | ${srtPath}` })
  const stt = await transcribeFile(gatewayUrl, audioPath, "zh")
  steps.push({ step: "transcribe_audio", ok: stt.ok, detail: stt.ok ? `${stt.text?.slice(0, 80)} (via ${stt.via})` : stt.error })
  if (!stt.ok) return { ok: false, steps, audioPath, srtPath }
  const mcp = await ttsTool(gatewayUrl, "enhance_audio_to_srt", { text })
  steps.push({ step: "enhance_audio_to_srt", ok: mcp.ok, detail: mcp.ok ? `via ${(mcp as { via?: string }).via}` : mcp.error })
  const wx = await wxTool(gatewayUrl, "wx_daemon_status", {})
  steps.push({ step: "wx_daemon_status", ok: wx.ok, detail: wx.ok ? "reachable" : wx.error?.slice(0, 80) })
  return { ok: true, steps, audioPath, srtPath, transcription: stt.text }
}

export async function probeServices(gatewayUrl?: string) {
  const gw = resolveGatewayUrl(gatewayUrl)
  return { gatewayUrl: gw, gateway: await serviceHealth(gw), tts: await serviceHealth("http://127.0.0.1:10320"), wx: await serviceHealth("http://127.0.0.1:10475") }
}
