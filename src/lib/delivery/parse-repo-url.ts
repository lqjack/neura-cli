export type RepoProvider = "github" | "gitlab"

export type ParsedRepository = {
  provider: RepoProvider
  owner: string
  repo: string
  slug: string
  remoteUrl: string
}

function buildRemoteUrl(provider: RepoProvider, owner: string, repo: string): string {
  if (provider === "gitlab") {
    return `https://gitlab.com/${owner}/${repo}.git`
  }
  return `https://github.com/${owner}/${repo}.git`
}

export function parseRepositoryInput(raw: string): ParsedRepository | null {
  const input = raw.trim()
  if (!input) return null

  const githubHttps = input.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i)
  if (githubHttps) {
    const owner = githubHttps[1]
    const repo = githubHttps[2].replace(/\.git$/, "")
    return {
      provider: "github",
      owner,
      repo,
      slug: `${owner}/${repo}`,
      remoteUrl: buildRemoteUrl("github", owner, repo),
    }
  }

  const gitlabHttps = input.match(/^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s#?]+)/i)
  if (gitlabHttps && gitlabHttps[1].includes("gitlab")) {
    const host = gitlabHttps[1]
    const owner = gitlabHttps[2]
    const repo = gitlabHttps[3].replace(/\.git$/, "")
    return {
      provider: "gitlab",
      owner,
      repo,
      slug: `${owner}/${repo}`,
      remoteUrl: `https://${host}/${owner}/${repo}.git`,
    }
  }

  const slug = input.replace(/^git@[^:]+:/, "").replace(/\.git$/, "")
  const parts = slug.split("/").filter(Boolean)
  if (parts.length >= 2) {
    const owner = parts[parts.length - 2]
    const repo = parts[parts.length - 1]
    const provider: RepoProvider = input.includes("gitlab") ? "gitlab" : "github"
    return {
      provider,
      owner,
      repo,
      slug: `${owner}/${repo}`,
      remoteUrl: buildRemoteUrl(provider, owner, repo),
    }
  }

  return null
}
