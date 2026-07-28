import { describe, expect, test } from "bun:test"
import {
  buildKolDiscoverBody,
  KOL_GATEWAY_PATHS,
  parseKolPlatforms,
} from "@/lib/neura-cli/kol-gateway-client"

describe("kol-gateway-client", () => {
  test("paths target mcn-incubation extensions (no local crm.db)", () => {
    expect(KOL_GATEWAY_PATHS.discover).toBe("/api/apps/mcn-incubation/extensions/discover")
    expect(KOL_GATEWAY_PATHS.sync).toBe("/api/apps/mcn-incubation/extensions/sync")
    expect(KOL_GATEWAY_PATHS.outreach).toBe("/api/apps/mcn-incubation/extensions/outreach")
  })

  test("buildKolDiscoverBody defaults upsert + appSlug", () => {
    const body = buildKolDiscoverBody({ keyword: "AI效率" })
    expect(body.appSlug).toBe("ai-vlogger-bd")
    expect(body.upsert).toBe(true)
    expect(body.keyword).toBe("AI效率")
  })

  test("parseKolPlatforms filters unknown platforms", () => {
    expect(parseKolPlatforms("xhs,douyin,invalid")).toEqual(["xhs", "douyin"])
    expect(parseKolPlatforms("")).toBeUndefined()
  })
})
