# NeuraCLI — Monorepo 同步闭环

> **原则：** 独立仓 `src/` **禁止手改** — 真源在 [llm-gateway](https://github.com/lqjack/llm-gateway)。

---

## 架构

```text
llm-gateway/
├── scripts/neura-cli.ts          ← 开发真源（bun run neura 保留）
├── src/lib/neura-cli/*           ← 库真源
├── packages/neura-cli/           ← 独立包壳 + demo + docs + CI
│   ├── README.md · demo/ · docs/
│   └── src/                      ← 生成（.gitignore，勿提交 monorepo）
└── scripts/sync-neura-cli-standalone.ts
         │
         ├─► packages/neura-cli/src/
         └─► ../neura-cli/         （NEURA_CLI_STANDALONE_REPO）
```

---

## 命令（在 llm-gateway 根目录）

| 命令 | 说明 |
|------|------|
| `bun run neura` | **保留** — monorepo 内开发不变 |
| `bun run neura-cli:sync` | 生成 `packages/neura-cli/src/` |
| `bun run neura-cli:sync -- ../neura-cli` | 同步到 sibling 独立 git 仓 |
| `bun run neura-cli:verify` | smoke：help · demo 文件 |
| `bun run neura-cli:verify:func` | **发布前功能门禁**（单测 + gateway + CLI auth） |
| `bun run neura-cli:pack` | `npm pack` 预检 |
| `bun run neura-cli:publish` | verify + `npm publish`（需 `NPM_ACCESS_TOKEN`） |
| `bun run neura-cli:push` | sync + git commit/push 独立仓 |

环境变量：

```bash
export NEURA_CLI_STANDALONE_REPO=../neura-cli
export NEURA_CLI_GITHUB_TOKEN=ghp_…   # 或 NEURA_CLI_SYNC_GITHUB_TOKEN（~/.bashrc）
export NPM_ACCESS_TOKEN=npm_…              # publish 用
```

---

## 发版流程

```text
1. llm-gateway 改 scripts/neura-cli.ts 或 src/lib/neura-cli/*
2. bun run neura / test:sop 验证
3. bun run neura-cli:sync -- ../neura-cli
4. bun run neura-cli:verify
5. cd ../neura-cli && git tag v0.x.y && git push --tags
6. bun run neura-cli:publish   # 或 GitHub Release 触发 CI
```

---

## 同步内容

| 来源 | 目标 |
|------|------|
| `scripts/neura-cli.ts` | `src/cli.ts` |
| `scripts/load-neura-cli-env.ts` | `src/load-env.ts` |
| `src/lib/neura-cli/**` | `src/lib/neura-cli/**` |
| 依赖薄层（branding · parse-repo-url · …） | `src/lib/...` |
| `packages/neura-cli/*`（非 src） | 镜像到独立仓根 |

Standalone 补丁：

- `send-client.test.ts` — 去掉 `goal-intent`（Server 侧路由）
- `software-evol-repo-workspace.ts` — stub re-export

---

## CI（独立仓）

`.github/workflows/ci.yml`：

- `bun test` + `bun run verify`
- GitHub **Release** → `npm publish`（secret `NPM_ACCESS_TOKEN`）

---

## 文档索引

| 文档 | 位置 |
|------|------|
| GTM 完整手册 | llm-gateway `docs/gtm-neura-cli-standalone-repo.md` |
| 同步手册 | llm-gateway `docs/neura-cli-standalone-sync.md` |
| send SOP | llm-gateway `docs/workflow-sop/neura-cli-send.md` |
| repo 生命周期 | llm-gateway `docs/neura-cli-repo-lifecycle.md` |
