import type { KolCsvRow } from "./types"

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function rowFromRecord(record: Record<string, unknown>): KolCsvRow | null {
  const platform = String(record.platform ?? record.Platform ?? "").trim()
  const handle = String(record.handle ?? record.Handle ?? "").trim()
  const displayName = String(
    record.display_name ?? record.displayName ?? record.nickname ?? "",
  ).trim()
  if (!platform || !handle || !displayName) return null

  const fansRaw = record.fans ?? record.followers
  const fans =
    typeof fansRaw === "number"
      ? fansRaw
      : typeof fansRaw === "string" && fansRaw.trim()
        ? Number(fansRaw)
        : undefined

  return {
    id: typeof record.id === "string" ? record.id : undefined,
    platform,
    handle,
    display_name: displayName,
    fans: Number.isFinite(fans) ? fans : undefined,
    tags: typeof record.tags === "string" ? record.tags : undefined,
    contact: typeof record.contact === "string" ? record.contact : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    pitch_version:
      typeof record.pitch_version === "string" ? record.pitch_version : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  }
}

export function parseKolCsvText(csv: string): KolCsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase())
  const rows: KolCsvRow[] = []

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const record: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      record[header] = cells[idx] ?? ""
    })
    const row = rowFromRecord(record)
    if (row) rows.push(row)
  }

  return rows
}

export function normalizeKolSyncRows(input: unknown): KolCsvRow[] {
  if (typeof input === "string") return parseKolCsvText(input)
  if (!Array.isArray(input)) return []

  const rows: KolCsvRow[] = []
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = rowFromRecord(item as Record<string, unknown>)
    if (row) rows.push(row)
  }
  return rows
}
