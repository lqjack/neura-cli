import { gatewayToolCall } from "@/lib/neura-cli/gateway-tools"

export type YoutubeMediaItem = {
  title?: string
  source_url?: string
  canonical_url?: string
  download_url?: string
  video_url?: string
  audio_url?: string
  text_seed?: string
  metadata?: Record<string, unknown>
}

export type YoutubeTranscribeBatchResult = {
  success?: boolean
  transcribed_count?: number
  items?: Array<{
    status?: string
    text?: string
    media_path?: string
    audio_path?: string
    download_url?: string
    error?: string
  }>
  error?: string
}

const NON_MEDIA_URL_MARKERS = [
  "support.weixin.qq.com",
  "favorite_record__w_unsupport",
  "readtemplate?t=page/favorite_record",
  "mp.weixin.qq.com/s?", // article links, not raw media
]

const MEDIA_URL_HOSTS = [
  "youtube.com",
  "youtu.be",
  "douyin.com",
  "iesdouyin.com",
  "tiktok.com",
  "bilibili.com",
  "vimeo.com",
]

const MEDIA_FILE_EXT = /\.(mp4|m4a|mp3|webm|mov|mkv|avi|aac|ogg)(\?|$)/i

export function isWeChatNonMediaUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return NON_MEDIA_URL_MARKERS.some((m) => lower.includes(m))
}

export function isDownloadableMediaUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed.startsWith("http")) return false
  if (isWeChatNonMediaUrl(trimmed)) return false

  try {
    const u = new URL(trimmed)
    const host = u.hostname.toLowerCase()
    if (MEDIA_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true
    if (MEDIA_FILE_EXT.test(u.pathname) || MEDIA_FILE_EXT.test(trimmed)) return true
    if (host.includes("cdn") && MEDIA_FILE_EXT.test(trimmed)) return true
  } catch {
    return false
  }

  return false
}

export function isWeChatMergedRecordMessage(msg: Record<string, unknown>): boolean {
  const content = String(msg.content ?? "")
  const url = String(msg.url ?? "")
  return content.includes("[合并聊天记录]") || url.includes("favorite_record__w_unsupport")
}

export type WeChatDialogueLine = { speaker: string; text: string; kind?: "video" | "voice" | "text" }

/** Parse `[合并聊天记录]` into speaker-labelled lines for evidence export. */
export function parseWeChatMergedChatDialogue(content: string): WeChatDialogueLine[] {
  if (!content.includes("[合并聊天记录]")) return []
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1)

  const out: WeChatDialogueLine[] = []
  for (const raw of lines) {
    const line = raw.replace(/^-\s*/, "")
    const m = line.match(/^([^:：]+)[:：]\s*(.+)$/)
    if (!m?.[1] || !m[2]) continue
    const speaker = m[1].trim()
    let text = m[2].trim()
    let kind: WeChatDialogueLine["kind"] = "text"
    if (/^\[视频\]$/.test(text)) {
      text = "[视频 — 未本地缓存；请在微信中播放后重新转写]"
      kind = "video"
    } else if (/^\[语音\]$/.test(text)) {
      text = "[语音 — 未本地缓存；请在微信中播放后重新转写]"
      kind = "voice"
    }
    out.push({ speaker, text, kind })
  }
  return out
}

/** Pull quoted lines from WeChat merged chat export (no yt-dlp). */
export function extractWeChatMergedChatText(content: string): string | null {
  const dialogue = parseWeChatMergedChatDialogue(content)
  const textLines = dialogue.map((d) => d.text).filter((t) => !t.startsWith("[视频 —") && !t.startsWith("[语音 —"))
  if (textLines.length) return textLines.join("\n")
  return dialogue.length ? dialogue.map((d) => `${d.speaker}：${d.text}`).join("\n") : null
}

export async function youtubeTool(gw: string, tool: string, args: Record<string, unknown>) {
  return gatewayToolCall(gw, "youtube", tool, args, 300_000)
}

/** Gateway → youtube_transcribe_media_batch (download → ffmpeg → whisper). */
export async function transcribeRemoteMediaBatch(
  gw: string,
  items: YoutubeMediaItem[],
  opts: { language?: string; maxItems?: number; outputDir?: string } = {}
): Promise<YoutubeTranscribeBatchResult> {
  const downloadable = items.filter((item) => {
    const url = String(item.video_url ?? item.audio_url ?? item.download_url ?? item.source_url ?? "")
    return isDownloadableMediaUrl(url)
  })

  if (!downloadable.length) {
    return {
      success: false,
      error: "no downloadable media URLs (WeChat merged-record links are not direct video files)",
      items: items.map((item, index) => ({
        index,
        status: "skipped",
        download_url: item.video_url ?? item.source_url,
        error: "URL is not a downloadable media endpoint",
      })),
    }
  }

  const r = await youtubeTool(gw, "youtube_transcribe_media_batch", {
    media_items: downloadable,
    language: opts.language ?? "zh",
    download_media: true,
    allow_metadata_fallback: false,
    prefer_provided_text: false,
    max_items: opts.maxItems ?? downloadable.length,
    output_dir: opts.outputDir,
    use_browser_credentials: Boolean(process.env.DATAPROAI_YTDLP_USE_BROWSER_COOKIES),
  })

  if (!r.ok) return { success: false, error: r.error }
  const body = (r.data ?? {}) as YoutubeTranscribeBatchResult
  if (body.error) return { success: false, error: String(body.error), ...body }
  return { success: true, ...body }
}

export function messageToYoutubeMediaItem(msg: Record<string, unknown>): YoutubeMediaItem | null {
  const url = [msg.url, msg.video_url, msg.download_url].find((v) => typeof v === "string" && v.startsWith("http"))
  if (!url || !isDownloadableMediaUrl(String(url))) return null
  const content = String(msg.content ?? "")
  return {
    title: content.slice(0, 120) || undefined,
    source_url: String(url),
    video_url: String(url),
    metadata: { chat: msg.chat, time: msg.time, local_id: msg.local_id },
  }
}

export function skipReasonForWeChatMedia(msg: Record<string, unknown>): string | null {
  if (isWeChatMergedRecordMessage(msg)) {
    return "WeChat merged chat record — open videos in WeChat to cache locally, or use inline quoted text"
  }
  const url = [msg.url, msg.video_url, msg.download_url].find((v) => typeof v === "string" && v.startsWith("http"))
  if (url && isWeChatNonMediaUrl(String(url))) {
    return "WeChat support link is not a direct video/audio file (yt-dlp cannot download it)"
  }
  if (String(msg.content ?? "").includes("[视频]") && !url) {
    return "WeChat video not cached locally — play it once in WeChat, then re-run transcribe"
  }
  if (String(msg.content ?? "").includes("[语音]")) {
    return "WeChat voice note has no local silk file — play it in WeChat to download, then re-run"
  }
  return null
}
