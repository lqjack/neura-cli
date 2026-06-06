export type MediaTranscriptMessage = Record<string, unknown>
export type MediaTranscriptionResult = {
  file: string
  ok: boolean
  text?: string
  error?: string
}

export type MediaTranscriptRow = {
  time?: string
  sender?: string
  kind: string
  source: string
  text: string
  ok: boolean
  error?: string
}

export type EvidenceCaseMeta = {
  title?: string
  caseId?: string
  parties?: string
  contact?: string
  contactId?: string
  dateFrom?: string
  dateTo?: string
  notes?: string
  generatedAt?: string
  mediaCount?: number
  transcribedCount?: number
}

export function inferEvidenceDateRange(rows: MediaTranscriptRow[]): { from?: string; to?: string } {
  const times = rows.map((r) => r.time?.trim()).filter(Boolean) as string[]
  if (!times.length) return {}
  return { from: times[0], to: times[times.length - 1] }
}

export function formatEvidenceHeader(meta: EvidenceCaseMeta): string {
  const lines = [
    "===== 微信音视频转写证据 =====",
    meta.title ? `事项：${meta.title}` : "",
    meta.caseId ? `编号：${meta.caseId}` : "",
    meta.parties ? `当事人：${meta.parties}` : "",
    meta.contact ? `对话联系人：${meta.contact}` : "",
    meta.contactId ? `微信号：${meta.contactId}` : "",
    meta.dateFrom || meta.dateTo
      ? `时间范围：${[meta.dateFrom, meta.dateTo].filter(Boolean).join(" ~ ")}`
      : "",
    meta.mediaCount != null
      ? `媒体条目：${meta.transcribedCount ?? 0}/${meta.mediaCount} 已转写`
      : "",
    meta.notes ? `备注：${meta.notes}` : "",
    `生成时间：${meta.generatedAt ?? new Date().toISOString()}`,
    "==============================",
  ]
  return `${lines.filter(Boolean).join("\n")}\n\n`
}

export function wrapEvidenceDocument(body: string, meta: EvidenceCaseMeta): string {
  const trimmed = body.trim()
  if (!trimmed) return formatEvidenceHeader(meta)
  return `${formatEvidenceHeader(meta)}${trimmed}\n`
}

function sourceLabel(source: string): string {
  const s = source.trim()
  if (!s) return ""
  if (s.startsWith("http")) return "微信合并聊天记录链接"
  const parts = s.split(/[/\\]/)
  const base = parts[parts.length - 1] ?? s
  return base.length > 72 ? `${base.slice(0, 69)}...` : base
}

function kindLabel(kind: string): string {
  if (kind === "video") return "视频转述"
  if (kind === "audio") return "音频转写"
  if (kind === "voice") return "语音转写"
  return "媒体转写"
}

function evidenceDialogueLines(row: MediaTranscriptRow, defaultSpeaker: string): string[] {
  const speaker = row.sender?.trim() || defaultSpeaker
  const timePrefix = row.time ? `${row.time} ` : ""
  if (row.text.includes("：") && row.text.split("\n").every((l) => /^[^：\n]+：/.test(l))) {
    return row.text.split("\n").filter(Boolean).map((l) => `${timePrefix}${l}`)
  }
  if (!row.text.includes("：")) {
    return [`${timePrefix}${speaker}：${row.text.trim()}`]
  }
  return row.text.split("\n").filter(Boolean).map((l) => `${timePrefix}${l}`)
}

/** Single PDF-ready document with numbered exhibits and catalog. */
export function formatEvidenceExhibits(
  rows: MediaTranscriptRow[],
  defaultSpeaker = "未知",
  meta: EvidenceCaseMeta = {}
): string {
  const catalog: string[] = []
  const sections: string[] = []
  let n = 1

  for (const row of rows) {
    if (!row.ok || !row.text.trim()) continue
    const label = kindLabel(row.kind)
    const src = sourceLabel(row.source)
    catalog.push(`证据${n}：${[row.time, label, src ? `（${src}）` : ""].filter(Boolean).join(" ")}`)
    const dialogue = evidenceDialogueLines(row, defaultSpeaker)
    sections.push(
      [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        `证据${n} · ${label}`,
        row.time ? `时间：${row.time}` : "",
        src ? `来源：${src}` : row.source ? `来源：${row.source}` : "",
        "",
        ...dialogue,
      ].filter(Boolean).join("\n")
    )
    n++
  }

  const okRows = rows.filter((r) => r.ok && r.text.trim())
  const header = formatEvidenceHeader({
    ...meta,
    mediaCount: meta.mediaCount ?? okRows.length,
    transcribedCount: meta.transcribedCount ?? okRows.length,
  })
  const catalogBlock = catalog.length ? `【证据目录】\n${catalog.join("\n")}\n\n` : ""
  return `${header}${catalogBlock}${sections.join("\n\n")}\n`
}

export function mediaKindFromMessage(msg: MediaTranscriptMessage): string {
  const type = String(msg.type ?? "").toLowerCase()
  const content = String(msg.content ?? "")
  if (type.includes("video") || content.includes("[视频]")) return "video"
  if (type.includes("voice") || content.includes("[语音]")) return "voice"
  if (/\.(mp4|mov|mkv|avi|webm)\b/i.test(content)) return "video"
  if (/\.(m4a|mp3|wav|aac|ogg|amr|silk)\b/i.test(content)) return "audio"
  return "media"
}

export function buildMediaTranscriptRows(
  messages: MediaTranscriptMessage[],
  transcriptions: MediaTranscriptionResult[]
): MediaTranscriptRow[] {
  const byFile = new Map(transcriptions.map((t) => [t.file, t]))
  const rows: MediaTranscriptRow[] = []

  for (const msg of messages) {
    const fp = typeof msg.file_path === "string" ? msg.file_path : null
    const tr = fp ? byFile.get(fp) : null
    const inline = msg.transcription as { text?: string } | undefined
    const text = inline?.text ?? tr?.text ?? ""
    const url = typeof msg.url === "string" ? msg.url : null
    if (!fp && !text && !url) continue
    if (!text && !tr?.ok && !tr?.error && !inline) continue

    rows.push({
      time: String(msg.time ?? ""),
      sender: String(msg.sender ?? ""),
      kind: mediaKindFromMessage(msg),
      source: fp ?? url ?? String(msg.content ?? "").slice(0, 120),
      text,
      ok: Boolean(text) || Boolean(tr?.ok),
      error: tr?.ok ? undefined : tr?.error,
    })
  }

  for (const tr of transcriptions) {
    if (rows.some((r) => r.source === tr.file)) continue
    rows.push({
      kind: tr.file.match(/\.(mp4|mov|mkv|avi|webm)$/i) ? "video" : "audio",
      source: tr.file,
      text: tr.text ?? "",
      ok: tr.ok,
      error: tr.error,
    })
  }

  return rows
}

export function formatEvidenceTranscriptText(rows: MediaTranscriptRow[], defaultSpeaker = "未知"): string {
  const blocks: string[] = []
  for (const row of rows) {
    if (!row.ok || !row.text.trim()) continue
    const time = row.time ? `${row.time} ` : ""
    const speaker = row.sender?.trim() || defaultSpeaker

    if (row.kind === "video" && row.text.includes("\n") && !row.text.includes("：")) {
      for (const line of row.text.split("\n").filter(Boolean)) {
        blocks.push(`${time}${line}`)
      }
      continue
    }

    if (row.text.includes("：") && row.text.split("\n").every((l) => /^[^：\n]+：/.test(l))) {
      for (const line of row.text.split("\n").filter(Boolean)) {
        blocks.push(`${time}${line}`)
      }
      continue
    }

    blocks.push(`${time}${speaker}：${row.text.trim()}`)
  }
  return blocks.length ? `${blocks.join("\n\n")}\n` : ""
}

export function formatFullTranscriptText(rows: MediaTranscriptRow[]): string {
  const parts = rows.filter((r) => r.ok && r.text.trim()).map((r) => r.text.trim())
  return parts.length ? `${parts.join("\n\n")}\n` : ""
}

export function formatTranscriptText(rows: MediaTranscriptRow[], chat: string, mode: "full" | "detailed" = "full"): string {
  if (mode === "full") return formatFullTranscriptText(rows) || `# ${chat} — no transcribed media\n`
  const lines = [`# ${chat} — audio/video transcript`, ""]
  for (const row of rows) {
    const head = [row.time, row.sender, `[${row.kind}]`].filter(Boolean).join(" ")
    lines.push(head || `[${row.kind}]`)
    lines.push(`source: ${row.source}`)
    if (row.ok && row.text) lines.push(row.text)
    else if (row.error) lines.push(`(failed: ${row.error})`)
    else lines.push("(no text)")
    lines.push("")
  }
  return lines.join("\n").trimEnd() + "\n"
}

export function splitTranscriptSegments(
  rows: MediaTranscriptRow[],
  defaultSpeaker = "未知"
): Array<{ name: string; body: string }> {
  const segments: Array<{ name: string; body: string }> = []
  let n = 1
  for (const row of rows) {
    if (!row.ok || !row.text.trim()) continue
    const label = row.kind || "media"
    const time = row.time?.replace(/[^\d-]/g, "") || "unknown"
    if (row.text.includes("\n") && row.text.includes("：")) {
      for (const line of row.text.split("\n").filter(Boolean)) {
        segments.push({ name: `${String(n).padStart(2, "0")}-${label}-${time}.txt`, body: `${line.trim()}\n` })
        n++
      }
      continue
    }
    const speaker = row.sender?.trim() || defaultSpeaker
    const body = !row.text.includes("：") ? `${speaker}：${row.text.trim()}\n` : `${row.text.trim()}\n`
    segments.push({ name: `${String(n).padStart(2, "0")}-${label}-${time}.txt`, body })
    n++
  }
  return segments
}
