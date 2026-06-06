import { describe, expect, test } from "bun:test"
import {
  formatEvidenceExhibits,
  formatEvidenceTranscriptText,
  inferEvidenceDateRange,
  wrapEvidenceDocument,
} from "@/lib/neura-cli/wx-media-transcript"

describe("formatEvidenceTranscriptText", () => {
  test("formats speaker lines for evidence submission", () => {
    const text = formatEvidenceTranscriptText([
      {
        time: "2026-05-26 12:56",
        sender: "",
        kind: "video",
        source: "merged",
        ok: true,
        text: "叶子：这个视频，是因为员工坚持\n叶子：这个是家属说受到威胁了",
      },
      {
        time: "2026-05-26 13:36",
        sender: "妹",
        kind: "audio",
        source: "/tmp/a.m4a",
        ok: true,
        text: "因为老白…",
      },
    ], "妹")
    expect(text).toContain("2026-05-26 12:56 叶子：")
    expect(text).toContain("2026-05-26 13:36 妹：因为老白")
    expect(text).not.toContain("妹：\n因为老白")
  })

  test("wrapEvidenceDocument includes header and body", () => {
    const doc = wrapEvidenceDocument("2026-05-26 13:36 妹：测试内容", {
      title: "护理院纠纷",
      contact: "妹",
      contactId: "cream481735",
      dateFrom: "2026-05-26 12:56",
      dateTo: "2026-05-26 13:36",
      mediaCount: 2,
      transcribedCount: 2,
    })
    expect(doc).toContain("===== 微信音视频转写证据 =====")
    expect(doc).toContain("事项：护理院纠纷")
    expect(doc).toContain("对话联系人：妹")
    expect(doc).toContain("妹：测试内容")
  })

  test("inferEvidenceDateRange reads first and last row times", () => {
    const range = inferEvidenceDateRange([
      { time: "2026-05-26 12:56", kind: "video", source: "a", text: "x", ok: true },
      { time: "2026-05-26 13:36", kind: "audio", source: "b", text: "y", ok: true },
    ])
    expect(range).toEqual({ from: "2026-05-26 12:56", to: "2026-05-26 13:36" })
  })

  test("formatEvidenceExhibits builds catalog and numbered sections", () => {
    const doc = formatEvidenceExhibits([
      {
        time: "2026-05-26 12:56",
        sender: "",
        kind: "video",
        source: "merged",
        ok: true,
        text: "叶子：这个视频威胁家属",
      },
      {
        time: "2026-05-26 13:36",
        sender: "妹",
        kind: "audio",
        source: "/tmp/路说费用.m4a",
        ok: true,
        text: "因为老白…",
      },
    ], "妹", { title: "护理院纠纷", contact: "妹", contactId: "cream481735" })
    expect(doc).toContain("【证据目录】")
    expect(doc).toContain("证据1：")
    expect(doc).toContain("证据2 · 音频转写")
    expect(doc).toContain("2026-05-26 13:36 妹：因为老白")
    expect(doc).toContain("路说费用.m4a")
  })
})
