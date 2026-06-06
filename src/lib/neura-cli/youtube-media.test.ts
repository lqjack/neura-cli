import { describe, expect, test } from "bun:test"
import {
  extractWeChatMergedChatText,
  isDownloadableMediaUrl,
  isWeChatNonMediaUrl,
  messageToYoutubeMediaItem,
  parseWeChatMergedChatDialogue,
} from "@/lib/neura-cli/youtube-media"

const WECHAT_BAD =
  "https://support.weixin.qq.com/cgi-bin/mmsupport-bin/readtemplate?t=page/favorite_record__w_unsupport&from=singlemessage"

describe("youtube-media url filter", () => {
  test("rejects WeChat support merged-record URLs", () => {
    expect(isWeChatNonMediaUrl(WECHAT_BAD)).toBe(true)
    expect(isDownloadableMediaUrl(WECHAT_BAD)).toBe(false)
    expect(
      messageToYoutubeMediaItem({
        url: WECHAT_BAD,
        content: "[合并聊天记录] demo",
      })
    ).toBeNull()
  })

  test("allows YouTube and direct media files", () => {
    expect(isDownloadableMediaUrl("https://www.youtube.com/watch?v=abc123def45")).toBe(true)
    expect(isDownloadableMediaUrl("https://cdn.example.com/voice.mp4")).toBe(true)
  })

  test("parseWeChatMergedChatDialogue keeps speakers and video placeholders", () => {
    const lines = parseWeChatMergedChatDialogue(
      "[合并聊天记录] A与B的聊天记录 (2条)\n  - 叶子: [视频]\n  - 叶子: 这是说明文字"
    )
    expect(lines).toHaveLength(2)
    expect(lines[0]?.speaker).toBe("叶子")
    expect(lines[0]?.text).toContain("[视频 — 未本地缓存")
    expect(lines[1]?.text).toBe("这是说明文字")
    const flat = extractWeChatMergedChatText(
      "[合并聊天记录] A与B的聊天记录 (2条)\n  - 叶子: [视频]\n  - 叶子: 这是说明文字"
    )
    expect(flat).toContain("这是说明文字")
  })
})
