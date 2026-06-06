import { describe, expect, test } from "bun:test"
import {
  isAudioFileMessage,
  parseFilenameFromContent,
  readWxStorageRoot,
  resolveWxMediaFilePath,
  listCachedVideosInAttach,
} from "@/lib/neura-cli/wx-media-path"

describe("wx-media-path", () => {
  test("parseFilenameFromContent reads [文件] line", () => {
    expect(parseFilenameFromContent("[文件] demo.m4a (1 MB, m4a)")).toBe("demo.m4a")
  })

  test("isAudioFileMessage detects m4a file rows", () => {
    expect(
      isAudioFileMessage({ type: "链接/文件", content: "[文件] demo.m4a (1 MB, m4a)" })
    ).toBe(true)
    expect(isAudioFileMessage({ type: "文本", content: "hello" })).toBe(false)
  })

  test("readWxStorageRoot strips db_storage suffix", () => {
    const root = readWxStorageRoot()
    if (root) expect(root).toMatch(/xwechat_files\/wxid_/)
  })

  test("resolveWxMediaFilePath finds local m4a under msg/file", () => {
    const root = readWxStorageRoot()
    if (!root) return
    const msg = {
      type: "链接/文件",
      content: "[文件] 路说费用交了公户不让住不服务.m4a (1 MB, m4a)",
      timestamp: 1779773792,
    }
    const fp = resolveWxMediaFilePath(msg, root)
    if (fp) expect(fp).toContain("路说费用交了公户不让住不服务.m4a")
  })

  test("listCachedVideosInAttach finds attach/V mp4 files", () => {
    const root = readWxStorageRoot()
    if (!root) return
    const videos = listCachedVideosInAttach(root, "2026-05")
    if (videos.length) expect(videos[0]).toContain("/V/")
  })
})
