# NeuraCLI — 后续营销操作手册 · 节奏 · Checklist

> **真源叙事：** [GTM.md](./GTM.md) · [MARKETING-COPY.md](./MARKETING-COPY.md) · monorepo [gtm-neura-cli-standalone-repo.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neura-cli-standalone-repo.md)  
> **Repo：** [github.com/lqjack/neura-cli](https://github.com/lqjack/neura-cli) · **npm：** `@neuradesk/cli` · **Gateway：** `https://gateway.datapro.asia`

---

## 0. 当前闭环状态（已完成）

| 项 | 状态 |
|----|------|
| monorepo `bun run neura` | ✅ 保留，真源未删 |
| 独立 public 仓 | ✅ [lqjack/neura-cli](https://github.com/lqjack/neura-cli) |
| npm 包 | ✅ `@neuradesk/cli@0.1.0`（建议发 `0.1.1` 含默认 gateway 修复） |
| 营销文档 | ✅ `docs/GTM` · `DEMO` · `MARKETING-COPY` · `OWNER-CHECKLIST` |
| Demo 脚本 | ✅ `demo/01` · `02` · `03` · GitHub Action 示例 |
| 同步命令 | ✅ `neura-cli:sync` · `verify` · `push` · `publish` |

**维护者发版三板斧（llm-gateway 根目录）：**

```bash
bun run neura-cli:sync -- ../neura-cli
bun run neura-cli:verify
bun run neura-cli:push          # 需 NEURA_CLI_GITHUB_TOKEN 或 SSH
bun run neura-cli:publish       # 需 NPM_ACCESS_TOKEN
```

---

## 1. 营销总节奏（12 周）

```text
W0–W2   L0 冷启动     README + npm + 第一条 asciinema
W3–W4   L1a 开发者     HN / 掘金首篇 + GitHub Action 故事
W5–W6   L1b CI 扩散    --json 教程 · DevOps 社群转发
W7–W9   L2 垂直 demo   MCN / 软件 --repo / JSON 三条录屏
W10–W12 L2b 交叉引流   Desk welcome CLI 卡 · 黑客松表单 · 可选 PH
12m+    L3 企业        私有化 NEURA_SERVER_URL · Enterprise 话术
```

与 NeuraDesk [gtm-neuradesk.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neuradesk.md) **并列品牌** — CLI 讲开发者，Desk 讲业务负责人；互相深链，不混首页。

---

## 2. 分周操作清单

### W0（本周）— 基础设施收尾

| # | 动作 | 负责人 | 产出 |
|---|------|--------|------|
| 1 | 确认 GitHub repo Description + Topics | Owner | `cli` `ai` `devtools` `neuradesk` |
| 2 | npm 发 `0.1.1`（含默认 `gateway.datapro.asia`） | Dev | `npm i -g @neuradesk/cli` 即通 |
| 3 | GitHub License 字段选 MIT | Owner | 与 LICENSE 文件一致 |
| 4 | README 加 npm badge（已有则跳过） | Dev | Stars 可见性 |
| 5 | Desk `/welcome/guide?product=cli` 确认可访问 | Dev | homepage 不 404 |

**DoD：** 陌生人 clone / npm install 后，仅需 `NEURA_API_KEY` 即可 `neura send` 成功。

---

### W1 — 第一条 Demo 录屏

| # | 动作 | 依赖 |
|---|------|------|
| 1 | 跑 `./demo/01-send-mcn.sh` 录 asciinema | `NEURA_API_KEY` · [DEMO.md](./DEMO.md) |
| 2 | embed 进 [README](../README.md) Hero 下方 | asciinema.org 账号 |
| 3 | `bun run neura-cli:push` 更新独立仓 | token 或 SSH |
| 4 | 推特/X 一条：反转句 + embed 链接 | [MARKETING-COPY.md](./MARKETING-COPY.md) § Twitter |

**KPI 基线：** GitHub Stars、npm weekly downloads、首次 `neura send` 成功数（Desk 侧 CLI source 注册）。

---

### W2 — 开发者信任加固

| # | 动作 |
|---|------|
| 1 | 发 GitHub Release `v0.1.x` + Release notes（PCRRA 三句） |
| 2 | 掘金短文《Most AI CLIs edit files》— 结构见 MARKETING-COPY |
| 3 | 在 llm-gateway README 或 Docs 索引加 NeuraCLI 外链一行 |
| 4 | 收集 1 条真实 stdout 截图（需案例授权） |

---

### W3–W4 — L1 开发者扩散

| # | 动作 | 渠道 |
|---|------|------|
| 1 | Show HN 模板发文 | HN · Lobsters |
| 2 | 教程：《CI 里发 Goal》+ `demo/03-send-json-ci.sh` | 掘金 · 知乎 |
| 3 | 推广 `demo/github-action-neura-send.yml` | GitHub Marketplace 可选 |
| 4 | `--repo` 故事 + `demo/02-send-repo-software.sh` 录屏 | 第二支 asciinema |

**叙事重点：** 不是 Claude Code 竞品 — **Goal 单元** vs **File 单元**；同一 Server 路径 as Desk。

---

### W5–W6 — CI / DevOps 圈层

| # | 动作 |
|---|------|
| 1 | 写「5 分钟接入 NeuraCLI 到 GitHub Actions」图文 |
| 2 | 在 NeuraDesk 帮助中心加 CLI 安装卡（若尚未有） |
| 3 | 追踪 UTM：`?utm_source=cli-readme` · `utm_medium=hn` · `utm_campaign=neura-cli-l1` |
| 4 | 复盘：哪条 demo 转化最高 → 回写 demo/ 默认 Goal 文案 |

---

### W7–W9 — L2 垂直 Demo 三件套

| 垂直 | Demo | 营销标题建议 |
|------|------|--------------|
| MCN | `01-send-mcn.sh` | 一条命令跑完竞品钩子分析 |
| 软件交付 | `02-send-repo-software.sh` | `--repo` 绑定交付仓的 RIS 扫描 |
| CI | `03-send-json-ci.sh` | Headless Goal · taskId 进 pipeline |

每条垂直：**录屏 60–120s + 1 篇短文 + Desk deep link 截图**。

---

### W10–W12 — 交叉引流 · 可选 PH

| # | 动作 |
|---|------|
| 1 | 黑客松 / UCWS 表单 Open Source 行填 **neura-cli 独立仓 URL** |
| 2 | Product Hunt 独立条目（Tagline: *Send goals, not git diffs*） |
| 3 | 小红书/短视频：终端录屏 + 反转句（开发者向） |
| 4 | 季度复盘：Stars · npm · Desk 来自 CLI 的注册占比 |

---

### 12 月+ — L3 企业

| 话术 | 内容 |
|------|------|
| 私有化 | `NEURA_SERVER_URL=https://your-gateway` + 同版本 CLI |
| 合规 | taskId 可追溯 · `--json` 审计 · Desk 审批门 |
| 打包 | Enterprise 下载页链到 npm 或 air-gapped tarball |

---

## 3. 渠道日历（建议频率）

| 渠道 | 频率 | 内容类型 |
|------|------|----------|
| GitHub Release | 每功能/修复 | Changelog + demo 链接 |
| 掘金/知乎 | 双周 1 篇 | 教程 / 对比 / 垂直案例 |
| X/Twitter | 发版 + 每周 1 | 反转句 + 录屏 GIF |
| HN | 大版本 | Show HN |
| Desk 官网 | 常驻 | CLI 卡 · guide?product=cli |
| 内部 Collab | 按需 | `/narrative-matrix growth-narrative-plugin` 生成渠道变体 |

---

## 4. 指标（每周看板）

| 指标 | 来源 |
|------|------|
| GitHub Stars / Forks | repo Insights |
| npm weekly downloads | npmjs.com |
| `neura send` 成功次数 | Gateway 日志 / metering |
| Desk 注册 `utm_source=cli-*` | 分析后台 |
| Demo 脚本周运行次数 | 内部 telemetry（可选） |
| Issue 数 / 首次响应时间 | GitHub Issues |

---

## 5. 仍需 Owner 提供（阻塞营销质量）

见 [OWNER-CHECKLIST.md](./OWNER-CHECKLIST.md)。**高优先级：**

| 资源 | 阻塞项 |
|------|--------|
| **CLI logo SVG + OG 1200×630** | 社交分享 / PH / 掘金封面 |
| **asciinema 账号** | README 秒懂 embed |
| **匿名案例截图授权** | 垂直 demo 真实感 |
| **MIT License 法律确认** | GitHub License 字段 |
| **npm 0.1.1 publish** | 新用户默认 gateway 正确 | ☑ 发版脚本 |

可选：`cli.neuradesk.ai` CNAME · Product Hunt 账号 · Design Partner 案例（COMM-06）。

---

## 6. 与 NeuraDesk 协同（不抢叙事）

| 场景 | NeuraCLI 说 | NeuraDesk 说 |
|------|-------------|--------------|
| 开发者会议 | thin client · same API | 不写 |
| MCN 客户演示 | 可选「技术同学一条命令预跑」 | 主 demo 仍 `/collab` |
| 官网 Hero | 二级 CTA：Developers → GitHub | 主 CTA：Start collab |
| 定价 | 链 Desk 定价页 | 主叙事 |

---

## 7. 发版日 SOP（每次 CLI 功能上线）

```text
1. llm-gateway 合并 main
2. bun run neura-cli:sync -- ../neura-cli
3. bun run neura-cli:verify && bun run verify:func（monorepo）
4. bump packages/neura-cli/package.json version
5. bun run neura-cli:push
6. bun run neura-cli:publish
7. GitHub Release + 社交帖（模板 MARKETING-COPY.md）
8. 有录屏变化则重录 asciinema → README embed → 再 push
```

---

*Goal-driven shell 对外；Desk 对内审阅。monorepo 真源不删，本仓负责开发者信任与 npm 分发。*
