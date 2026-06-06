import { describe, expect, test } from "bun:test"
import { existsSync } from "fs"
import { extractAudioFromVideo, isAudioPath, isVideoPath, findFfmpeg } from "@/lib/neura-cli/video-audio"

describe("video-audio", () => {
  test("isVideoPath / isAudioPath", () => {
    expect(isVideoPath("/tmp/a.mp4")).toBe(true)
    expect(isAudioPath("/tmp/a.m4a")).toBe(true)
    expect(isVideoPath("/tmp/a.m4a")).toBe(false)
  })

  test("extractAudioFromVideo passes through audio", () => {
    const m4a = "/home/jack/Documents/xwechat_files/wxid_x72e4o1y3nt322_6e7a/msg/file/2026-05/路说费用交了公户不让住不服务.m4a"
    if (!existsSync(m4a)) return
    const r = extractAudioFromVideo(m4a)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.audioPath).toBe(m4a)
  })

  test(
    "extractAudioFromVideo converts mp4 when ffmpeg available",
    () => {
      if (!findFfmpeg()) return
      const sample = process.env.NEURA_TEST_VIDEO
      if (!sample || !existsSync(sample)) return
      const r = extractAudioFromVideo(sample, { timeoutMs: 8_000 })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.audioPath).toMatch(/\.mp3$/)
    },
    { timeout: 12_000 },
  )
})
