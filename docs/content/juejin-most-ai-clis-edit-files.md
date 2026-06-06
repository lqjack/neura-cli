# Most AI CLIs edit files：为什么我们做了 NeuraCLI

> **发布渠道：** 掘金 / 知乎 · 复制粘贴后补截图与 asciinema 链接  
> **Repo：** https://github.com/lqjack/neura-cli · **npm：** `@neuradesk/cli`  
> **Desk：** https://gateway.datapro.asia/collab · **CLI 指南：** https://gateway.datapro.asia/welcome/guide?product=cli

---

## Hook

终端里你每天都在用 `git`、`kubectl`、Claude Code —— 它们改的是**文件**和**仓库**。

但业务同学要的往往是另一件事：**「帮我跑完 MCN 竞品分析」「审查这次发布风险」** —— 这是 **Goal**，不是 diff。

**Most AI CLIs edit files. Neura sends goals.**

---

## Pain · Conflict

| 现状 | 问题 |
|------|------|
| Claude Code / Codex | 强在 repo edit，弱在跨 Web 工具的业务 SOP |
| Coze / Dify | 强在 Web Flow，弱在终端与 CI |
| 人肉拼 | Goal 在 5 个浏览器 Tab 里，无法 `git push` 式复现 |

---

## Reversal · Solution

NeuraCLI 是 **thin client**：一行命令把 Goal 交给 NeuraDesk，走与 `/collab` **完全相同**的 Server 路径：

```text
neura send "MCN: analyze top 3 competitor hooks in skincare"
  → POST /api/cli/send
  → Intent → Domain Plugin → Workflow → Multi-Agent
  → stdout finalReport + deskPath 深链
```

```bash
npm i -g @neuradesk/cli
export NEURA_API_KEY=gw-…   # NeuraDesk Settings → API Keys
neura send "MCN: analyze competitor hooks for skincare vertical"
```

默认 Gateway：`https://gateway.datapro.asia`（无需再 export URL）。

---

## 对比表

| | Claude Code / Codex | NeuraCLI |
|---|---------------------|----------|
| 工作单元 | File / repo | **Goal** |
| 路由 | 本地模型 | **NeuraOS** Intent → Plugin |
| 审阅 | Terminal diff | **Desk** `/collab?task=…` |
| CI | patch | **`--json` + taskId** |

---

## Demo（终端 + Desk 截图）

**终端录屏：**

[![asciicast](https://asciinema.org/a/LzQWeelwBW7E2TCQ.svg)](https://asciinema.org/a/LzQWeelwBW7E2TCQ)

```bash
git clone https://github.com/lqjack/neura-cli.git
cd neura-cli && ./demo/01-send-mcn.sh
```

**Desk 侧 MCN 五步闭环（与 CLI 同一 collab 路径）：**

![选择运营模式](https://raw.githubusercontent.com/lqjack/neura-cli/main/docs/assets/mcn/mcn01.png)

*Step 1 — 选择新建 / 延续模式（MCN 达人孵化工作台）*

![因子决策面板](https://raw.githubusercontent.com/lqjack/neura-cli/main/docs/assets/mcn/mcn02.png)

*Step 2–3 — 因子决策：BGM、脚本基调、场景、话题、人物*

![创作方案](https://raw.githubusercontent.com/lqjack/neura-cli/main/docs/assets/mcn/mcn03.png)

*Step 4 — 生成方案：设定集合、创作指导、口播脚本（mcn-sop）*

![效果反馈闭环](https://raw.githubusercontent.com/lqjack/neura-cli/main/docs/assets/mcn/mcn04.png)

*Step 5 — 反馈闭环：完播率 / 点赞率沉淀运营画像*

---

## Result

- 开发者：终端 + CI 发 Goal，不必打开五个 Web 工具  
- 业务：仍在 Desk 审阅、审批、看结构化结果卡  
- 同一 Server：`submitCollabRun` 一条路径，无第二套编排  

---

## Action · CTA

- **GitHub：** https://github.com/lqjack/neura-cli  
- **npm：** `npm i -g @neuradesk/cli`  
- **NeuraDesk 试用：** https://gateway.datapro.asia/collab  
- **CLI 安装说明（官网）：** https://gateway.datapro.asia/welcome/guide?product=cli  

---

*NeuraCLI 开源 MIT · NeuraDesk 负责执行与审阅 · monorepo 真源 llm-gateway 保留 `bun run neura`*
