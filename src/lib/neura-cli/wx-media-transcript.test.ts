import { describe, expect, test } from "bun:test"
import { buildMediaTranscriptRows, formatFullTranscriptText, formatTranscriptText } from "@/lib/neura-cli/wx-media-transcript"

describe("wx-media-transcript", () => {
  test("formatTranscriptText full mode is plain whole text", () => {
    const rows = buildMediaTranscriptRows(
      [{
        time: "2026-05-26 13:36",
        type: "链接/文件",
        content: "[文件] demo.m4a",
        file_path: "/tmp/demo.m4a",
        transcription: { text: "你好世界" },
      }],
      [{ file: "/tmp/demo.m4a", ok: true, text: "你好世界" }]
    )
    expect(formatFullTranscriptText(rows)).toBe("你好世界\n")
    expect(formatTranscriptText(rows, "妹", "full")).toBe("你好世界\n")
    expect(formatTranscriptText(rows, "妹", "detailed")).toContain("# 妹")
  })
})
