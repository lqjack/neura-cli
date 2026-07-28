export type KolPlatform = "xhs" | "douyin" | "bilibili"

export type LeadCandidate = {
  platform: KolPlatform | string
  user_id: string
  nickname: string
  followers: number
  niche: string
  contact_email?: string
  contact_wechat?: string
  profile_url?: string
  tags?: string[]
  last_active?: string
}

export type SearchKolProfilesInput = {
  keyword?: string
  platforms?: KolPlatform[]
  min_followers?: number
  max_followers?: number
  pages?: number
}

export type SearchKolProfilesResult = {
  ok: boolean
  profiles: LeadCandidate[]
  errors?: string[]
  source?: string
  error?: string
}
