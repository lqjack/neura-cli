import { describe, expect, test } from "bun:test"
import {
  isHumanVideoSummary,
  isLowQualityStt,
  pickVideoTranscript,
  postProcessStt,
  repetitionScore,
} from "@/lib/neura-cli/transcript-quality"

describe("transcript-quality", () => {
  test("detects repetitive whisper garbage", () => {
    const bad = "飞翼的飞翼的飞翼的飞翼的飞翼的飞翼的飞翼"
    expect(repetitionScore(bad)).toBeGreaterThan(0.3)
    expect(isLowQualityStt(bad)).toBe(true)
  })

  test("pickVideoTranscript prefers description when STT is bad", () => {
    const desc = "这个视频威胁家属，说护理员都是他管理"
    const stt = "飞翼的飞翼的飞翼的飞翼的飞翼"
    expect(pickVideoTranscript(stt, desc)).toBe(desc)
  })

  test("pickVideoTranscript drops latin-mixed whisper garbage", () => {
    const desc = "这个视频，是因为员工坚持让家属把钱交到护理院公户"
    const stt = "好 Expectate breathing一樣 feel it同時腰力躩因此发gs得到動作"
    expect(pickVideoTranscript(stt, desc)).toBe(desc)
  })

  test("pickVideoTranscript prefers human summary over any STT", () => {
    const desc = "这个视频，是因为员工坚持让家属把钱交到护理院公户，路要辞退员工"
    const stt = "在這裡放在這邊下面吧好来得及 Community林项目来"
    expect(pickVideoTranscript(stt, desc)).toBe(desc)
    expect(isHumanVideoSummary(desc)).toBe(true)
  })

  test("postProcessStt strips latin and replacement chars", () => {
    const raw = "您\uFFFD画脚这实个钱 annoying了就好陆小 Exam 在跟主辄公司"
    const out = postProcessStt(raw)
    expect(out).not.toMatch(/[a-zA-Z]/)
    expect(out).not.toContain("\uFFFD")
    expect(out).toContain("画脚")
  })

  test("postProcessStt strips accented latin garbage", () => {
    expect(postProcessStt("因为老白 tässä资主的那个")).toBe("因为老白 资主的那个")
  })

  test("pickVideoTranscript drops ellipsis garbage", () => {
    const desc = "这个视频威胁家属，说护理员都是他管理"
    const stt = "…………我你有,我啊……你下我不能踩iblah…………"
    expect(pickVideoTranscript(stt, desc)).toBe(desc)
  })

  test("pickVideoTranscript keeps good STT with description", () => {
    const desc = "员工坚持让家属把钱交到护理院公户"
    const stt = "你们必须把钱交到公户不然就辞退"
    const out = pickVideoTranscript(stt, desc)
    expect(out).toContain(desc)
    expect(out).toContain(stt)
  })
})
