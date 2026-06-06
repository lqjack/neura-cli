import { describe, expect, test } from "bun:test"
import { runCollabTaskAction } from "./task-client"

describe("task-client", () => {
  test("runCollabTaskAction returns network error when server unreachable", async () => {
    const r = await runCollabTaskAction({
      taskId: "task-abc",
      action: "slack.post_summary",
      serverUrl: "http://127.0.0.1:1",
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })
})
