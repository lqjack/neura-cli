import { describe, expect, test } from "bun:test"
import { formatTaskResult } from "@/lib/neura-cli/send-client"

describe("send-client (standalone)", () => {
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
