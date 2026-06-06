import { existsSync, readFileSync, readdirSync } from "fs"
import { homedir } from "os"
import path from "path"
import type { WxMessage } from "@/lib/neura-cli/wx-tts-pipeline"

const AUDIO_EXT = new Set([".m4a", ".mp3", ".wav", ".aac", ".ogg", ".amr", ".silk", ".slk", ".wma", ".flac"])
const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".3gp"])
const MEDIA_EXT = new Set([...AUDIO_EXT, ...VIDEO_EXT])
const FILE_CONTENT = /\[文件\]\s*(.+?)(?:\s*\(|$)/i
const AUDIO_IN_CONTENT = /\.(m4a|mp3|wav|aac|ogg|amr|silk|slk|wma|flac)\b/i
const VIDEO_IN_CONTENT = /\.(mp4|mov|mkv|avi|webm|m4v|3gp)\b|\[视频\]/i

export function readWxStorageRoot(configPath = path.join(homedir(), ".wx-cli/config.json")): string | null {
  if (!existsSync(configPath)) return null
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as { db_dir?: string }
    const dbDir = cfg.db_dir?.trim()
    if (!dbDir) return null
    if (dbDir.endsWith("/db_storage") || dbDir.endsWith("\\db_storage")) {
      return dbDir.replace(/[/\\]db_storage$/, "")
    }
    return path.dirname(dbDir)
  } catch {
    return null
  }
}

export function parseFilenameFromContent(content: string): string | null {
  const m = content.match(FILE_CONTENT)
  if (!m?.[1]) return null
  const name = m[1].trim()
  return name || null
}

export function isAudioFileMessage(msg: WxMessage): boolean {
  const content = String(msg.content ?? "")
  if (!AUDIO_IN_CONTENT.test(content)) return false
  const type = String(msg.type ?? "").toLowerCase()
  return type.includes("file") || type.includes("链接") || content.includes("[文件]")
}

export function isVideoFileMessage(msg: WxMessage): boolean {
  const content = String(msg.content ?? "")
  const type = String(msg.type ?? "").toLowerCase()
  if (VIDEO_IN_CONTENT.test(content)) {
    return type.includes("file") || type.includes("链接") || type.includes("video") || content.includes("[文件]")
  }
  return false
}

function monthDirFromTimestamp(ts: unknown): string | null {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return null
  const d = new Date(n * 1000)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function walkMediaFiles(dir: string, ext: string, out: string[], depth = 0): void {
  if (depth > 10 || out.length > 100) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isFile() && ent.name.toLowerCase().endsWith(ext)) {
      out.push(full)
      continue
    }
    if (ent.isDirectory()) walkMediaFiles(full, ext, out, depth + 1)
  }
}

// WeChat Linux caches played videos under msg/attach/.../V/ as .mp4
export function listCachedVideosInAttach(storageRoot: string, month?: string | null): string[] {
  const attachDir = path.join(storageRoot, "msg", "attach")
  const hits: string[] = []
  if (!existsSync(attachDir)) return hits

  walkMediaFiles(attachDir, ".mp4", hits)
  const filtered = month
    ? hits.filter((p) => p.includes(`/${month}/`) || p.includes(`${path.sep}${month}${path.sep}`))
    : hits

  return filtered.sort((a, b) => {
    const ai = Number(path.basename(a, ".mp4"))
    const bi = Number(path.basename(b, ".mp4"))
    if (!Number.isNaN(ai) && !Number.isNaN(bi) && ai !== bi) return ai - bi
    return a.localeCompare(b)
  })
}

export function countVideoPlaceholders(content: string): number {
  return (content.match(/\[视频\]/g) ?? []).length
}

export function resolveAttachVideosForMessage(msg: WxMessage, storageRoot?: string | null): string[] {
  const root = storageRoot ?? readWxStorageRoot()
  if (!root) return []
  const content = String(msg.content ?? "")
  const need = countVideoPlaceholders(content)
  if (!need) return []

  const month = monthDirFromTimestamp(msg.timestamp)
  const videos = listCachedVideosInAttach(root, month)
  if (!videos.length && month) return listCachedVideosInAttach(root, null).slice(0, need)
  return videos.slice(0, need)
}

function walkFiles(dir: string, filename: string, out: string[], depth = 0): void {
  if (depth > 6 || out.length > 20) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isFile() && ent.name === filename) {
      out.push(full)
      continue
    }
    if (ent.isDirectory()) walkFiles(full, filename, out, depth + 1)
  }
}

export function findFileInWxStorage(
  storageRoot: string,
  filename: string,
  timestamp?: unknown,
  subdirs: string[] = ["file", "video"]
): string | null {
  const month = monthDirFromTimestamp(timestamp)
  for (const sub of subdirs) {
    const baseDir = path.join(storageRoot, "msg", sub)
    if (month) {
      const candidate = path.join(baseDir, month, filename)
      if (existsSync(candidate)) return candidate
    }
    const hits: string[] = []
    if (existsSync(baseDir)) walkFiles(baseDir, filename, hits)
    if (hits.length) {
      hits.sort((a, b) => b.localeCompare(a))
      return hits[0] ?? null
    }
  }
  return null
}

export function resolveWxMediaFilePath(msg: WxMessage, storageRoot?: string | null): string | null {
  for (const key of ["file_path", "path", "local_path", "media_path"]) {
    const v = msg[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }

  const root = storageRoot ?? readWxStorageRoot()
  if (!root) return null

  const content = String(msg.content ?? "")
  const filename = parseFilenameFromContent(content)
  if (filename) {
    const found = findFileInWxStorage(root, filename, msg.timestamp)
    if (found) return found
    const ext = path.extname(filename).toLowerCase()
    if (MEDIA_EXT.has(ext)) {
      for (const sub of ["file", "video"]) {
        const bare = path.join(root, "msg", sub, filename)
        if (existsSync(bare)) return bare
      }
    }
  }

  const mediaMatch = content.match(
    /([\w\u4e00-\u9fff().\-—_\s]+\.(m4a|mp3|wav|aac|ogg|amr|silk|slk|wma|flac|mp4|mov|mkv|avi|webm|m4v|3gp))/i
  )
  if (mediaMatch?.[1]) {
    const name = mediaMatch[1].trim()
    const found = findFileInWxStorage(root, name, msg.timestamp)
    if (found) return found
  }

  return null
}
