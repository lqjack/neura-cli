# NeuraCLI — GTM · 叙事 · 渠道

> **Standalone repo playbook.** Monorepo 真源：[llm-gateway/docs/gtm-neura-cli-standalone-repo.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neura-cli-standalone-repo.md)  
> **Desk 平台 GTM：** [gtm-neuradesk.md](https://github.com/lqjack/llm-gateway/blob/main/docs/gtm-neuradesk.md)

---

## 1. 品类定位

| 维度 | NeuraDesk | NeuraCLI（本仓） |
|------|-----------|------------------|
| 受众 | 业务负责人、MCN、领域专家 | 开发者、DevOps、自动化工程师 |
| 品类 | 企业 AI 执行系统（Web） | **AI Organization Runtime CLI** |
| 分发 | SaaS · App Factory · `/collab` | `npm` · GitHub Stars · CI |
| 对标 | Coze / Dify 执行层 | Claude Code / Codex — **但发 Goal 不是改文件** |

**原则：** llm-gateway **保留** `bun run neura`；本仓负责 **对外 public 信任 + npm 分发**。

---

## 2. 一句话 · PCRRSA

### 反转句（首屏）

| 语言 | 文案 |
|------|------|
| **EN** | Most AI CLIs edit files. **Neura sends goals.** |
| **ZH** | 大多数 AI CLI 改文件。**Neura 发 Goal。** |

### PCRRSA 全渠道

| 段 | 中文 | English |
|----|------|---------|
| **Pain** | 终端里只有 `git`/`kubectl`/`claude`；业务 Goal 仍要开 5 个 Web 工具人肉拼 | Your shell edits repos. Business goals live in five browser tabs. |
| **Conflict** | Claude Code 强在 file edit；Coze 强在 Web Flow — CLI 用户缺「发 Goal → 拿可审计报告」 | Coding CLIs optimize diffs. Ops CLIs don't run domain SOPs. |
| **Reversal** | **Most AI CLIs edit files. Neura sends goals.** | Same |
| **Solution** | `neura send "…"` → 同一 `submitCollabRun` → Intent → Plugin → Workflow → 四 Agent → `finalReport` | One command, same pipeline as NeuraDesk `/collab` |
| **Result** | stdout 报告 + `deskPath` 深链；`--repo` 绑交付仓；`--json` 给 CI | Terminal output + optional Desk review |
| **Action** | `npm i -g @neuradesk/cli` → `neura send "…"` | GitHub README Quick start |

---

## 3. 阶段策略

| 阶段 | 时间 | 目标 | KPI |
|------|------|------|-----|
| **L0 开源冷启动** | W0–W2 | public repo + npm 可装 | Stars · npm weekly |
| **L1 开发者扩散** | W3–W6 | CI/CD 集成 | clone→first send |
| **L2 垂直 demo** | W7–W12 | MCN / 软件交付 / JSON CI | Desk 注册来自 CLI deep link |
| **L3 企业** | 12 月+ | 私有化 `NEURA_SERVER_URL` | Enterprise CLI |

---

## 4. 渠道矩阵

| 渠道 | 形态 | 频率 |
|------|------|------|
| **GitHub README** | 反转句 + Quick start + asciinema | 发版同步 |
| **npm** | `@neuradesk/cli` | 每 tag |
| **asciinema / GIF** | `demo/01-send-mcn.sh` | 首发 + 大版本 |
| **Hacker News** | Show HN: goal-driven ops CLI | 发版日 |
| **掘金 / 知乎** | 《不是 Claude Code 替代品：Goal CLI》 | 双周 |
| **NeuraDesk 官网** | `/welcome/guide?product=cli` | 常驻 |
| **黑客松** | Repo URL 填 **本独立仓** | 表单 |

---

## 5. 与 NeuraDesk 分工

| 触点 | NeuraDesk | NeuraCLI |
|------|-----------|----------|
| Hero | 想法很多，执行很少 | Most AI CLIs edit files |
| Demo | `/collab` 结果卡 | 终端：`neura send` → poll → Desk |
| CTA | `/collab` · `/plugins` | `neura send` · GitHub · npm |
| 量化 | ROI · outcome | `--json` · taskId 可追溯 |

---

## 6. 内容流水线

```text
1. PCRRSA（本文 §2）+ Desk gtm-neuradesk.md 反转句
2. demo/*.sh（MCN · --repo · --json）
3. README · 掘金 · PH tagline（见 MARKETING-COPY.md）
4. 发布 → UTM ?utm_source=cli-readme → Desk 注册监测
5. 高转化 demo 回写 demo/
```

---

## 7. 相关文档

| 文档 | 说明 |
|------|------|
| [DEMO.md](./DEMO.md) | 三条标准 demo + asciinema |
| [MARKETING-COPY.md](./MARKETING-COPY.md) | GitHub / PH / HN / 掘金全文模板 |
| [OWNER-CHECKLIST.md](./OWNER-CHECKLIST.md) | **需 Owner 另外提供的资源** |
| [SYNC.md](./SYNC.md) | monorepo 同步闭环 |

---

*NeuraCLI 对外：Goal-driven shell。NeuraDesk：执行与审阅。*
