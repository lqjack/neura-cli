# NeuraCLI — Demo 手册

> 营销录屏 · 黑客松 · 开发者 onboarding。需 `NEURA_API_KEY`（见 [OWNER-CHECKLIST.md](./OWNER-CHECKLIST.md)）。

---

## 1. 前置

```bash
npm i -g @neuradesk/cli
# 或 clone 本仓：bun install && bun run neura --help

export NEURA_SERVER_URL=https://gateway.datapro.asia
export NEURA_API_KEY=gw-…   # NeuraDesk Settings → API Keys
```

本地 env 文件（可选）：`~/.config/neura/cli.env` — 见 [.env.example](../.env.example)。

Demo 脚本会自动加载（按优先级）：

1. 已 export 的 `NEURA_API_KEY`
2. `~/llm-gateway/config/neura-cli.env`（monorepo 开发者）
3. `NEURA_CLI_ENV` 指向的 env 文件

---

## 2. 三条标准 Demo

| # | 脚本 | 时长 | 展示点 |
|---|------|------|--------|
| 1 | [`demo/01-send-mcn.sh`](../demo/01-send-mcn.sh) | ~90s | 业务 Goal · Intent 行 · finalReport |
| 2 | [`demo/02-send-repo-software.sh`](../demo/02-send-repo-software.sh) | ~120s | `--repo owner/app` · workspace |
| 3 | [`demo/03-send-json-ci.sh`](../demo/03-send-json-ci.sh) | ~60s | `--json` · taskId（CI 友好） |

```bash
cd neura-cli
./demo/01-send-mcn.sh
./demo/02-send-repo-software.sh
./demo/03-send-json-ci.sh
```

### Demo 1 — MCN 增长 Goal

```bash
neura send \
  "MCN incubation: analyze top 3 competitor hooks in skincare vertical; output bullet summary" \
  --timeout 180 --poll 2
```

**录屏要点：** 终端 poll 行出现 `Intent` / `Plugin`；stdout 末尾 `finalReport`；复制 `deskPath` 打开 NeuraDesk。

**Desk 截图（仓库 `docs/assets/mcn/`）：**

| 文件 | 展示 |
|------|------|
| `mcn01.png` | 选择运营模式（新建 / 延续） |
| `mcn02.png` | 因子决策面板 |
| `mcn03.png` | 创作方案（口播脚本 · 创作指导） |
| `mcn04.png` | 效果反馈闭环 |

Monorepo 真源：`llm-gateway/docs/mcn01.png` … `mcn04.png`

### Demo 2 — 软件交付 + repo

```bash
export GITHUB_TOKEN=ghp_…   # 可选，用于 repo ensure
neura repo ensure octocat/Hello-World
neura send --repo octocat/Hello-World \
  "Software: skim README and list 3 release risks before merge" \
  --force-run --timeout 300 --poll 2
```

**录屏要点：** `~/.neura/.workspace/` 克隆；send 日志含 `deliveryRepo` / `workDir`。

### Demo 3 — CI JSON

```bash
neura send "Summarize one-line collab smoke test" --json --timeout 120 --poll 2
```

**录屏要点：** 单行 JSON；提取 `taskId` 供 GitHub Actions 下游步骤。

---

## 3. asciinema 录制

```bash
# 安装：https://asciinema.org
asciinema rec -c "./demo/01-send-mcn.sh" -t "NeuraCLI: MCN goal send"
asciinema upload /tmp/asciicast-*.cast
# embed ID → README
```

批量录制：

```bash
./demo/record-all.sh
```

---

## 4. GitHub Actions 示例

见 [`demo/github-action-neura-send.yml`](../demo/github-action-neura-send.yml)。

Secrets：`NEURA_API_KEY` · `NEURA_SERVER_URL`（可选）。

---

## 5. 黑客松 / 表单字段

| 字段 | 内容 |
|------|------|
| Open source | NeuraCLI (`@neuradesk/cli`) — MIT |
| Repo URL | `https://github.com/lqjack/neura-cli` |
| Demo command | `neura send "MCN: niche viral factors for skincare"` |
| Backend | NeuraDesk `POST /api/cli/send` — 同一 collab 路径 |

---

## 6. 故障排查

| 现象 | 处理 |
|------|------|
| `NEURA_API_KEY` missing | `demo/setup-env.sh` 或 export `gw-…` |
| HTTP 401 | 检查 key 是否有效 · Settings → API Keys |
| poll timeout | 加大 `--timeout`；任务可能仍在 Server 跑 — 打开 Desk `/collab` |
| repo ensure 失败 | 设置 `GITHUB_TOKEN` |

全生命周期验证（monorepo）：`bun run verify:neura-cli-repo-lifecycle`
