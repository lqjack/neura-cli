export type KolCsvRow = {
  id?: string
  platform: string
  handle: string
  display_name: string
  fans?: number
  tags?: string
  contact?: string
  status?: string
  pitch_version?: string
  notes?: string
  updated_at?: string
}

export type SyncKolCsvInput = {
  appSlug?: string
  appId: string
  ownerUserId: string
  rows: KolCsvRow[]
  dry_run?: boolean
  versionLabel?: string | null
  preferPublic?: boolean
}

export type SyncKolCsvResult = {
  ok: boolean
  dry_run: boolean
  received: number
  inserted: number
  updated: number
  skipped: number
  previews: Array<{ key: string; title: string; status: string }>
  error?: string
}
