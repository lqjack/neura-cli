# NeuraCLI — Owner 需提供资源清单

> 以下 **无法由代码仓自动生成**。请在发版 / 营销前逐项确认。  
> 本地配置模板：`llm-gateway/config/neura-cli-publish.env.example`（勿提交 git）

---

## 必提供 / 必确认

| # | 资源 | 用途 | 状态 |
|---|------|------|------|
| 1 | **GitHub public repo** | [github.com/lqjack/neura-cli](https://github.com/lqjack/neura-cli) | ☑ 已确认 |
| 2 | **npm scope** | `@neuradesk/cli` · org `neuradesk` | ☑ 已发布 v0.1.0 |
| 3 | **开源 License** | MIT（与 [LICENSE](../LICENSE) 一致） | ☐ **请确认法律文本** |
| 4 | **Demo API Key** | `NEURA_API_KEY=gw-…` · demo 录屏 / CI | ☑ monorepo `config/neura-cli.env` |
| 5 | **生产 NEURA_SERVER_URL** | 默认 `https://gateway.datapro.asia` | ☑ 已确认 |
| 6 | **npm publish token** | env `NPM_ACCESS_TOKEN` · CI secret 同名 | ☑ 本地 env |
| 7 | **GitHub PAT** | `NEURA_CLI_SYNC_GITHUB_TOKEN` · sync push 自动化 | ☐ **请提供**（若需 CI 自动 push 独立仓） |

---

## 营销 / 品牌（强烈建议）

| # | 资源 | 用途 | 状态 |
|---|------|------|------|
| 8 | **品牌资产** | CLI logo SVG · npm badge · OG image 1200×630 | ☐ **需提供** |
| 9 | **asciinema.org 账号** | 上传 `demo/01-send-mcn.sh` 录屏 embed README | ☐ 可选 |
| 10 | **匿名案例授权** | Demo 输出可公开截图（MCN / 法务 / 软件） | ☐ 营销用 |
| 11 | **Product Hunt 账号** | CLI 独立条目 | ☐ 可选 |
| 12 | **域名** | `cli.neuradesk.ai` → GitHub | ☐ 可选 |

---

## 本地 env 示例

```bash
# config/neura-cli-publish.env（DO NOT COMMIT）
NEURA_CLI_STANDALONE_REPO=../neura-cli
NEURA_CLI_DEMO_API_KEY=gw-…
NPM_ACCESS_TOKEN=npm_…
NEURA_CLI_SYNC_GITHUB_TOKEN=ghp_…   # repo push，可选
```

---

## 你提供后我们可立即做的

| 你提供 | 我们执行 |
|--------|----------|
| `NEURA_CLI_SYNC_GITHUB_TOKEN` + repo 已 create | `bun run neura-cli:push` → 独立仓首次 public push |
| Demo key + asciinema 账号 | 录屏 embed → README |
| Logo SVG + OG 1200×630 | README badge · social cards |
| 案例授权截图 | 掘金 / PH 素材 |
| 确认 License MIT | GitHub license 字段 + npm |

---

## 不需要重复建设

| 项 | 说明 |
|----|------|
| CLI 源码 | monorepo `scripts/neura-cli.ts` + `src/lib/neura-cli/*` 真源 **保留** |
| NeuraDesk GTM | 见 [gtm-neuradesk.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neuradesk.md) |
| Runner 分发 | 仍从 `llm-gateway/packages/runner` · CLI README 链过去 |
| Plugin SDK | 仍从 `llm-gateway/plugins/` |
