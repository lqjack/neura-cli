# Gateway URL 映射 — NeuraCLI 对外链接

> **是否有必要？** 有必要。npm `homepage`、README、Desk 交叉引流都指向 `gateway.datapro.asia`；404 会直接损失转化。

## 生产 URL 清单（2026-06-06 验证）

| URL | 用途 | 状态 |
|-----|------|------|
| https://gateway.datapro.asia/ | NeuraDesk 首页 | 200 |
| https://gateway.datapro.asia/collab | Collab 工作台 · demo 深链 | 200 |
| https://gateway.datapro.asia/welcome/guide | 通俗指南（rewrite → `?guide=1`） | 200 |
| https://gateway.datapro.asia/welcome/guide?product=cli | **CLI 专页** · npm homepage | 200 · 顶栏 NeuraCLI 安装卡 |
| https://gateway.datapro.asia/welcome?guide=1 | 指南别名 | 200 |

## npm / GitHub 外链

| 资源 | URL |
|------|-----|
| 独立仓 | https://github.com/lqjack/neura-cli |
| npm | https://www.npmjs.com/package/@neuradesk/cli |

## 路由说明

- `next.config.ts`：`/welcome/guide` → `/welcome?guide=1`（query 保留，`product=cli` 有效）
- `?product=cli`：欢迎指南页顶部展示 NeuraCLI 安装卡（`CliProductBanner`）

## 维护

发版前：

```bash
bun run neura-cli:verify:func   # 含 gateway 连通 + CLI auth
```

Desk 部署含 `CliProductBanner` 后，`?product=cli` 才在线上可见（需 `deploy:ubuntu` 或 Vercel）。
