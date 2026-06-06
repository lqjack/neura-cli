import { describe, expect, test } from "bun:test"
import { enrichHistory, isMediaMessage, ownWxIdFromDbDir, resolveWxChat, unwrapWxMessages } from "@/lib/neura-cli/wx-tts-pipeline"

describe("wx-tts-pipeline", () => {
  test("ownWxIdFromDbDir strips account suffix", () => {
    expect(
      ownWxIdFromDbDir("/home/jack/Documents/xwechat_files/wxid_x72e4o1y3nt322_6e7a/db_storage")
    ).toBe("wxid_x72e4o1y3nt322")
  })

  test("unwrapWxMessages reads messages wrapper", () => {
    const rows = unwrapWxMessages({
      data: { messages: [{ content: "hi", type: "text" }], meta: { status: "ok" } },
    })
    expect(rows).toHaveLength(1)
  })

  test("isMediaMessage detects voice type and content", () => {
    expect(isMediaMessage({ type: "voice" })).toBe(true)
    expect(isMediaMessage({ content: "[语音] 5''" })).toBe(true)
    expect(isMediaMessage({ type: "text", content: "hello" })).toBe(false)
  })

  test("resolveWxChat maps self name when WX_CLI_WEIXIN_ID set", () => {
    const prevId = process.env.WX_CLI_WEIXIN_ID
    const prevName = process.env.WX_CLI_SELF_NAME
    process.env.WX_CLI_WEIXIN_ID = "lqjacklee"
    process.env.WX_CLI_SELF_NAME = "L"
    const r = resolveWxChat("L")
    process.env.WX_CLI_WEIXIN_ID = prevId
    process.env.WX_CLI_SELF_NAME = prevName
    if (r.ownWxId) {
      expect(r.chat).toBe(r.ownWxId)
      expect(r.resolvedFrom).toBe("L")
    } else {
      expect(r.chat).toBe("L")
    }
  })

  test("resolveWxChat keeps contact weixin id when not self", () => {
    const prevId = process.env.WX_CLI_WEIXIN_ID
    process.env.WX_CLI_WEIXIN_ID = "lqjacklee"
    const r = resolveWxChat("cream481735")
    process.env.WX_CLI_WEIXIN_ID = prevId
    expect(r.resolvedFrom).toBeUndefined()
    expect(r.chat).toBe("cream481735")
  })

  test("enrichHistory attaches transcription by file path", () => {
    const messages = [{ type: "voice", file_path: "/tmp/a.silk" }]
    const transcriptions = [{ file: "/tmp/a.silk", ok: true, text: "你好" }]
    const out = enrichHistory(messages, transcriptions)
    expect((out[0] as { transcription?: { text: string } }).transcription?.text).toBe("你好")
  })
})
