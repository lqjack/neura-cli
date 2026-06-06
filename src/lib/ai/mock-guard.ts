/**
 * Real AI validation — aligns docs/system-interaction-design.md §2 (Real AI only)
 * and scripts/verify-ai-backend.sh (non-empty content + token usage + no legacy placeholders).
 *
 * Production paths must never return dev mock fallbacks; chatCompletion throws when
 * LiteLLM/Eazo is unavailable. This module validates structural proof of a real call.
 */

export type AiUsageProof = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type RealAiCompletionProof = {
  content: string
  provider: "litellm"
  model: string
  usage?: AiUsageProof
}

export type CollabTaskAiSnapshot = {
  status: string
  finalReport?: string | null
  errorMessage?: string | null
  agentOutputs?: unknown
}

/** Legacy placeholder strings removed from completion.ts — may linger in stale tasks / .next */
export const LEGACY_MOCK_MARKERS = [
  "[Local dev mock",
  "AI backend unreachable",
  "Start LiteLLM and OpenClaw Zero for real completions",
] as const

/** @deprecated use LEGACY_MOCK_MARKERS */
export const MOCK_AI_MARKERS = LEGACY_MOCK_MARKERS

const MIN_COMPLETION_CHARS = 1
const MIN_TASK_REPORT_CHARS = 20
const MIN_TASK_REPORT_CHARS_WITHOUT_USAGE = 50

export function hasLegacyMockMarkers(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  return LEGACY_MOCK_MARKERS.some((marker) => text.includes(marker))
}

export function hasRealTokenUsage(usage?: AiUsageProof | null): boolean {
  if (!usage) return false
  const total = usage.total_tokens ?? 0
  const completion = usage.completion_tokens ?? 0
  const prompt = usage.prompt_tokens ?? 0
  return total > 0 || completion > 0 || prompt > 0
}

function sumAgentTokens(agentOutputs: unknown): number {
  if (!Array.isArray(agentOutputs)) return 0
  let sum = 0
  for (const row of agentOutputs) {
    if (!row || typeof row !== "object") continue
    const tokens = (row as { tokensUsed?: unknown }).tokensUsed
    if (typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0) sum += tokens
  }
  return sum
}

function extractTaskText(task: CollabTaskAiSnapshot): string {
  if (task.finalReport?.trim()) return task.finalReport.trim()
  if (!Array.isArray(task.agentOutputs)) return ""
  for (let i = task.agentOutputs.length - 1; i >= 0; i--) {
    const row = task.agentOutputs[i]
    if (!row || typeof row !== "object") continue
    const out = (row as { output?: unknown }).output
    if (typeof out === "string" && out.trim()) return out.trim()
  }
  return ""
}

function looksLikeInfraError(content: string): boolean {
  const t = content.trim()
  if (!t) return true
  if (/^No AI provider available/i.test(t)) return true
  if (/^Refusing mock\/hardcoded/i.test(t)) return true
  if (/^Error:\s*(LiteLLM|connect|ECONNREFUSED|fetch failed)/i.test(t)) return true
  return false
}

function passesContentRealness(content: string, minChars: number): boolean {
  const text = content.trim()
  if (text.length < minChars) return false
  if (hasLegacyMockMarkers(text)) return false
  if (looksLikeInfraError(text)) return false
  return true
}

/** Validate a chatCompletion result (provider + model + usage + content). */
export function assertRealAiCompletion(
  proof: RealAiCompletionProof,
  context = "AI completion",
): void {
  const content = proof.content.trim()
  const failures: string[] = []

  if (!proof.model?.trim()) failures.push("missing model id")
  if (proof.provider !== "litellm") failures.push("unknown provider")

  if (hasLegacyMockMarkers(content)) failures.push("legacy mock placeholder")
  if (looksLikeInfraError(content)) failures.push("infra error text instead of model output")

  const usageOk = hasRealTokenUsage(proof.usage)
  const contentOk = content.length >= MIN_TASK_REPORT_CHARS_WITHOUT_USAGE

  if (content.length < MIN_COMPLETION_CHARS) failures.push("empty content")
  if (!usageOk && !contentOk) {
    failures.push("no token usage from provider and content too short to be a real completion")
  }

  if (failures.length > 0) {
    throw new Error(
      `Refusing non-real ${context}: ${failures.join("; ")}. Run bun run verify:local-ai (LiteLLM + OPENROUTER_API_KEY).`,
    )
  }
}

/** Content-only check for callers without usage metadata (tests, legacy paths). */
export function assertRealAiContent(content: string, context = "AI response"): void {
  if (!passesContentRealness(content, MIN_COMPLETION_CHARS)) {
    throw new Error(
      `Refusing non-real ${context}. Run bun run verify:local-ai (LiteLLM + OPENROUTER_API_KEY).`,
    )
  }
}

/** Validate collab task poll payload before NeuraCLI prints finalReport. */
export function validateCollabTaskAiOutput(
  task: CollabTaskAiSnapshot,
): { ok: true; text: string } | { ok: false; reason: string } {
  if (task.status === "failed") {
    return { ok: false, reason: task.errorMessage?.trim() || "task failed" }
  }

  const text = extractTaskText(task)
  if (!text) {
    return { ok: false, reason: `(status=${task.status}, no finalReport yet)` }
  }

  if (hasLegacyMockMarkers(text)) {
    return {
      ok: false,
      reason:
        "legacy mock placeholder in task output — run bun run clean:next && bun dev and bun run verify:local-ai",
    }
  }

  if (looksLikeInfraError(text)) {
    return { ok: false, reason: "infra error text in task output — fix LiteLLM / connection settings" }
  }

  const agentTokens = sumAgentTokens(task.agentOutputs)
  const minChars = agentTokens > 0 ? MIN_TASK_REPORT_CHARS : MIN_TASK_REPORT_CHARS_WITHOUT_USAGE

  if (text.length < minChars) {
    return {
      ok: false,
      reason:
        agentTokens > 0
          ? `output too short (${text.length} chars) — expected real LLM report`
          : "no agent token usage recorded and report too short — likely non-LLM output",
    }
  }

  return { ok: true, text }
}

/** True when content contains legacy mock markers or infra error text (not length-based). */
export function isMockAiContent(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  if (hasLegacyMockMarkers(text)) return true
  if (looksLikeInfraError(text)) return true
  return false
}
