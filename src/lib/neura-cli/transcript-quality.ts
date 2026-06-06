/** Heuristics for noisy Whisper output on phone/video audio. */

/** Detect text that is mostly one short phrase repeated (e.g. Whisper loops). */
function consecutiveRepeatRatio(text: string): number {
  const t = text.trim()
  if (t.length < 9) return 0
  const maxUnit = Math.min(12, Math.floor(t.length / 3))
  for (let unitLen = 2; unitLen <= maxUnit; unitLen++) {
    const unit = t.slice(0, unitLen)
    let count = 0
    for (let i = 0; i + unitLen <= t.length; i += unitLen) {
      if (t.slice(i, i + unitLen) !== unit) break
      count++
    }
    const covered = count * unitLen
    if (count >= 3 && covered >= t.length * 0.75) return covered / t.length
  }
  return 0
}

export function repetitionScore(text: string): number {
  const repeatRatio = consecutiveRepeatRatio(text)
  if (repeatRatio > 0) return repeatRatio

  const t = text.trim()
  if (t.length < 20) return 0
  const chunks = t.match(/[\u4e00-\u9fff]{2,8}/g) ?? []
  if (chunks.length < 4) return 0
  const freq = new Map<string, number>()
  for (const c of chunks) freq.set(c, (freq.get(c) ?? 0) + 1)
  let max = 0
  for (const n of freq.values()) max = Math.max(max, n)
  return max / chunks.length
}

export function cjkRatio(text: string): number {
  const t = text.replace(/\s/g, "")
  if (!t.length) return 0
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk / t.length
}

export function hasForeignScriptNoise(text: string): boolean {
  return /\b[a-zA-Z]{3,}\b/.test(text) || /[а-яА-ЯёЁ]/.test(text)
}

/** WeChat merged-record quoted lines typed by humans about attached videos. */
export function isHumanVideoSummary(text: string): boolean {
  const t = text.trim()
  return /^这个(视频|是)/.test(t) || (/视频/.test(t) && /(威胁|家属|护理|公户|服务)/.test(t))
}

export function isLowQualityStt(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.length < 8) return false
  if (repetitionScore(t) > 0.35) return true
  if (consecutiveRepeatRatio(t) >= 0.75) return true
  if (t.length > 80 && cjkRatio(t) < 0.35) return true
  if (/(.{2,12})\1{2,}/.test(t)) return true
  if (hasForeignScriptNoise(t) && cjkRatio(t) < 0.85) return true
  if (/[…\.]{4,}/.test(t) && cjkRatio(t) < 0.55) return true
  if (/\d+[a-zA-Z]{2,}/.test(t)) return true
  if (/\uFFFD/.test(t)) return true
  return false
}

export function normalizeTranscriptText(text: string): string {
  return text
    .replace(/([^\s]{2,10})(?:\1){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** Strip Whisper hallucinations (Latin/Cyrillic/replacement chars) from Chinese STT. */
export function postProcessStt(text: string): string {
  let t = text
    .replace(/\uFFFD/g, "")
    .replace(/[\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g, "")
    .replace(/[^\u4e00-\u9fff\d，。！？、：；""''（）【】…—·\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  t = normalizeTranscriptText(t)
  return t
}

/** Prefer human description when STT is garbage; otherwise combine both. */
export function pickVideoTranscript(stt: string | undefined, description: string | undefined): string {
  const s = postProcessStt((stt ?? "").trim())
  const d = (description ?? "").trim()
  if (!s && d) return d
  if (!d) return s
  if (isHumanVideoSummary(d)) return d
  if (!s || isLowQualityStt(s)) return d
  if (d.includes(s.slice(0, Math.min(12, s.length)))) return d
  if (hasForeignScriptNoise(s)) return d
  return `${d}\n[语音转写] ${s}`
}
