import { describe, expect, test } from "bun:test"
import { resolveGoalIntent } from "@/lib/sop/goal-intent"
import { formatTaskResult } from "@/lib/neura-cli/send-client"

describe("send-client", () => {
  test("resolveGoalIntent routes 小红书增长 to content_growth + xhs-growth-plugin", () => {
    const intent = resolveGoalIntent({ topic: "小红书增长：分析竞品笔记策略" })
    expect(intent.route.domain).toBe("content_growth")
    expect(intent.route.pluginSlug).toBe("xhs-growth-plugin")
  })

  test("resolveGoalIntent routes software topic to autonomous-delivery", () => {
    const intent = resolveGoalIntent({ topic: "审查 TypeScript API 重构安全性" })
    expect(intent.route.domain).toBe("software")
    expect(intent.route.pluginSlug).toBe("autonomous-delivery-plugin")
  })

  test("formatTaskResult prefers finalReport with real-AI proof", () => {
    const report = "这是一份通过 NeuraCLI 返回的真实 LLM 分析报告，包含足够长度。"
    expect(
      formatTaskResult({
        taskId: "t1",
        status: "completed",
        done: true,
        finalReport: report,
        agentOutputs: [{ tokensUsed: 1200, output: report }],
      }),
    ).toBe(report)
  })

  test("formatTaskResult rejects legacy mock finalReport", () => {
    const out = formatTaskResult({
      taskId: "t1",
      status: "completed",
      done: true,
      finalReport: "[Local dev mock — AI backend unreachable]",
      agentOutputs: [{ tokensUsed: 10 }],
    })
    expect(out.startsWith("ERROR:")).toBe(true)
  })
})
