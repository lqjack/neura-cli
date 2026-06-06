import { existsSync, statSync } from "fs"
import { spawnSync } from "child_process"
import path from "path"

export const AUDIO_EXT = new Set([".m4a", ".mp3", ".wav", ".aac", ".ogg", ".amr", ".silk", ".slk", ".wma", ".flac"])
export const VIDEO_EXT = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".3gp"])

export type ExtractAudioResult =
  | { ok: true; videoPath: string; audioPath: string; cached: boolean }
  | { ok: false; videoPath: string; error: string }

export function isAudioPath(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase())
}

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXT.has(path.extname(filePath).toLowerCase())
}

export function findFfmpeg(): string | null {
  const candidates = [
    process.env.DATAPROAI_FFMPEG_BIN,
    process.env.FFMPEG_BINARY,
    "ffmpeg",
  ].filter(Boolean) as string[]

  for (const bin of candidates) {
    const r = spawnSync(bin, ["-version"], { encoding: "utf-8", timeout: 5000 })
    if (r.status === 0) return bin
  }
  return null
}

/** Mirror dataproai youtube/handlers/tool_handler.py `_extract_audio`. */
export function extractAudioFromVideo(
  videoPath: string,
  opts: { outputPath?: string; ffmpegBin?: string; timeoutMs?: number } = {}
): ExtractAudioResult {
  if (!existsSync(videoPath)) {
    return { ok: false, videoPath, error: `missing: ${videoPath}` }
  }

  if (isAudioPath(videoPath)) {
    return { ok: true, videoPath, audioPath: videoPath, cached: true }
  }

  if (!isVideoPath(videoPath)) {
    return { ok: false, videoPath, error: `unsupported media extension: ${path.extname(videoPath)}` }
  }

  const ffmpeg = opts.ffmpegBin ?? findFfmpeg()
  if (!ffmpeg) return { ok: false, videoPath, error: "ffmpeg not available for video-to-audio conversion" }

  const audioPath = opts.outputPath ?? videoPath.replace(/\.[^.]+$/, ".mp3")
  if (existsSync(audioPath) && statSync(audioPath).size > 0) {
    return { ok: true, videoPath, audioPath, cached: true }
  }

  const timeout = opts.timeoutMs ?? Number(process.env.DATAPROAI_FFMPEG_TIMEOUT ?? 180) * 1000
  const proc = spawnSync(
    ffmpeg,
    ["-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", audioPath],
    { encoding: "utf-8", timeout, maxBuffer: 8 * 1024 * 1024 }
  )

  if (proc.status !== 0) {
    const err = (proc.stderr ?? proc.stdout ?? "").trim().slice(-500)
    return { ok: false, videoPath, error: `ffmpeg failed: ${err || `exit ${proc.status}`}` }
  }

  if (!existsSync(audioPath) || statSync(audioPath).size === 0) {
    return { ok: false, videoPath, error: "ffmpeg did not produce audio" }
  }

  return { ok: true, videoPath, audioPath, cached: false }
}

export function mediaKindFromPath(filePath: string): "audio" | "video" | "unknown" {
  if (isAudioPath(filePath)) return "audio"
  if (isVideoPath(filePath)) return "video"
  return "unknown"
}
