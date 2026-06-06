# NeuraCLI — 营销文案库（复制即用）

> 与 [GTM.md](./GTM.md) PCRRSA 对齐 · Desk 真源 [gtm-neuradesk.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neuradesk.md)

---

## GitHub / npm 短描述

```text
NeuraCLI — send business goals from your terminal; NeuraServer runs domain SOP + multi-agent execution (NeuraDesk backend).
```

---

## README Hero（中英）

**EN**

```markdown
# NeuraCLI

Most AI CLIs edit files.

**Neura sends goals.**

Send a business goal from your terminal. NeuraServer runs domain SOP + multi-agent collab — same path as [NeuraDesk](https://gateway.datapro.asia/collab).
```

**ZH**

```markdown
# NeuraCLI

大多数 AI CLI 改文件。

**Neura 发 Goal。**

在终端把业务 Goal 交给 NeuraOS：Intent → 领域 Plugin → Workflow → 多 Agent 报告 — 与 NeuraDesk `/collab` 同路径。
```

---

## Product Hunt（可选 · CLI 独立条目）

| 字段 | 内容 |
|------|------|
| **Tagline** | Send goals, not git diffs. |
| **Title** | NeuraCLI — Goal-driven AI execution in your terminal |
| **Description** | Claude Code edits your repo. NeuraCLI sends operational goals to NeuraDesk: Intent routing, domain plugins, multi-agent SOP, approval gates — stdout or JSON for CI. |

---

## Hacker News — Show HN

```text
Show HN: NeuraCLI – send business goals from your shell (not another file-editing AI CLI)

We built a thin CLI that hits the same NeuraDesk collab pipeline as the web UI:
`neura send "…"` → intent → domain plugin → workflow → multi-agent report.

Open source MIT. Requires a NeuraDesk account (free tier / demo key).

https://github.com/lqjack/neura-cli
npm i -g @neuradesk/cli
```

---

## 掘金 / 知乎标题

- 《Most AI CLIs edit files：为什么我们做了 NeuraCLI》
- 《一条命令跑完 MCN 竞品分析：NeuraCLI + NeuraDesk 闭环》
- 《CI 里发 Goal：`neura send --json` 与 Collab 同路径》

### 掘金正文结构（建议）

1. **Hook** — 反转句 + 30s 终端 GIF  
2. **Pain** — 改代码 CLI vs 业务 Goal  
3. **架构** — thin client · `POST /api/cli/send`  
4. **Demo** — 三条 `demo/*.sh` 截图  
5. **对比表** — Claude Code vs NeuraCLI（见 README）  
6. **CTA** — GitHub · npm · Desk 注册  

---

## 小红书 / 短视频脚本（开发者向）

**标题：** 我在终端里「发 Goal」，AI 在云端按 SOP 跑完整个流程

```
Hook：不用打开网页，一行命令丢给 AI 组织

Demo 录屏：
$ neura send "小红书：拆解护肤赛道前三竞品钩子"
→ [poll] Intent: content_growth
→ [poll] Plugin: xhs-growth-plugin
→ finalReport 输出到终端
→ 打开 gateway.datapro.asia/collab?task=…

CTA：GitHub 搜 NeuraCLI · npm i -g @neuradesk/cli
```

---

## Twitter / X（单条）

```text
Most AI CLIs edit files.

Neura sends goals.

neura send "MCN: analyze competitor hooks" → same NeuraDesk collab pipeline as the web UI.

MIT · npm i -g @neuradesk/cli
https://github.com/lqjack/neura-cli
```

---

## 邮件 / Newsletter 一句

```text
NeuraCLI is now on npm (@neuradesk/cli): send business goals from your terminal, get multi-agent SOP execution on NeuraDesk — not another repo-editing AI CLI.
```
