import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveCliWorkspacePluginSlug, SOFTWARE_EVOL_OS_PLUGIN_SLUG } from "@/lib/neura-cli/repo-constants"
import { defaultWorkspacePath } from "@/lib/plugins/plugin-repo-workspace"

describe("resolveCliWorkspacePluginSlug", () => {
  test("defaults to software-evol when --repo without --plugin", () => {
    expect(
      resolveCliWorkspacePluginSlug({ githubRepo: "octo/repo" }),
    ).toBe(SOFTWARE_EVOL_OS_PLUGIN_SLUG)
  })

  test("explicit --plugin wins", () => {
    expect(
      resolveCliWorkspacePluginSlug({
        pluginFlag: "legal-review-plugin",
        githubRepo: "octo/repo",
      }),
    ).toBe("legal-review-plugin")
  })

  test("workspace path under ~/.neura/.workspace", () => {
    const p = defaultWorkspacePath(SOFTWARE_EVOL_OS_PLUGIN_SLUG, "octo", "repo")
    expect(p).toContain(path.join(".neura", ".workspace"))
    expect(p).toContain("octo-repo")
    expect(p).not.toContain("software-evol-os-plugin")
  })
})
