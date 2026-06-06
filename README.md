# NeuraCLI

[![npm version](https://img.shields.io/npm/v/@neuradesk/cli.svg)](https://www.npmjs.com/package/@neuradesk/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Most AI CLIs edit files.

**Neura sends goals.**

Send a business goal from your terminal. [NeuraDesk](https://gateway.datapro.asia) runs domain SOP + multi-agent collab on the server — same pipeline as `/collab`.

```bash
npm i -g @neuradesk/cli
export NEURA_SERVER_URL=https://gateway.datapro.asia
export NEURA_API_KEY=gw-your-key-from-settings
neura send "MCN: analyze competitor hooks for skincare vertical"
```

> **中文：** 在终端把业务 Goal 交给 NeuraOS 执行，不是又一个改文件的 AI CLI。

## Why not another coding CLI?

| | Claude Code / Codex | NeuraCLI |
|---|---------------------|----------|
| Unit of work | File / repo | **Goal** |
| Routing | Local model | **NeuraOS** Intent → Plugin → Workflow |
| Review | Terminal diff | **Desk** `/collab?task=…` |
| Output | Code patch | **Structured report** + optional `--json` for CI |

## Quick start

```bash
# Global install (recommended)
npm i -g @neuradesk/cli
neura send "Review our API release checklist" --timeout 120

# Or clone this repo (requires Bun >= 1.1)
git clone https://github.com/lqjack/neura-cli.git
cd neura-cli && bun install
bun run neura send "Review our API release checklist" --timeout 120
```

### Auth

| Variable | Description |
|----------|-------------|
| `NEURA_API_KEY` | Bearer `gw-…` from NeuraDesk settings |
| `NEURA_SERVER_URL` | Gateway base URL (default `https://gateway.datapro.asia`; local dev: `http://127.0.0.1:3000`) |
| `GITHUB_TOKEN` | Optional — `neura repo ensure owner/repo` |

Config file (optional): `~/.config/neura/cli.env` — see [.env.example](./.env.example).

## Demos

| Script | What it shows |
|--------|----------------|
| [`demo/01-send-mcn.sh`](./demo/01-send-mcn.sh) | MCN business goal · ~90s |
| [`demo/02-send-repo-software.sh`](./demo/02-send-repo-software.sh) | `--repo owner/app` · ~120s |
| [`demo/03-send-json-ci.sh`](./demo/03-send-json-ci.sh) | `--json` for CI · ~60s |

```bash
./demo/01-send-mcn.sh
```

Record for README: `asciinema rec -c "./demo/01-send-mcn.sh"` — see [docs/DEMO.md](./docs/DEMO.md).

## Core commands

```bash
neura send "<goal>" [--json] [--poll 2] [--timeout 600] [--repo owner/repo]
neura repo show | repo set owner/repo | repo ensure owner/repo
neura connector list | connector status | connector import
neura task action <taskId> slack.post_summary --connector slack
```

Full help: `neura --help`

## Architecture

NeuraCLI is a **thin client**. It does not embed LLMs or plugins.

```text
Terminal: neura send "…"
    → POST /api/cli/send (NeuraDesk)
    → Intent → Domain Router → Plugin Workflow → Multi-Agent Collab
    → GET /api/cli/tasks/:id (poll)
    → stdout finalReport + deskPath deep link
```

## CI integration

Example GitHub Action: [`demo/github-action-neura-send.yml`](./demo/github-action-neura-send.yml)

## Optional: repo + connectors

```bash
export GITHUB_TOKEN=ghp_…
neura repo ensure your-org/your-app
neura connector import --plugin software-evol-os-plugin
neura send --repo your-org/your-app "RIS: competitor scan" --force-run
```

Set `NEURA_PLUGIN_BUNDLE_ROOT` to a checkout of [llm-gateway plugins](https://github.com/lqjack/llm-gateway/tree/main/plugins) for local `connector list`.

## Related products

| Product | Role |
|---------|------|
| [NeuraDesk](https://gateway.datapro.asia) | Web console — approval, plugins, quant |
| [NeuraRunner](https://github.com/lqjack/llm-gateway/tree/main/packages/runner) | Local sandbox — `neura send --use-runner` |
| [Plugin SDK](https://github.com/lqjack/llm-gateway/blob/main/plugins/PLUGIN_DEVELOPMENT_GUIDE.md) | Domain SOP authoring |

## Docs

| Doc | Description |
|------|-------------|
| [docs/GTM.md](./docs/GTM.md) | Marketing · PCRRSA · channels |
| [docs/DEMO.md](./docs/DEMO.md) | Demo runbook · asciinema |
| [docs/MARKETING-COPY.md](./docs/MARKETING-COPY.md) | GitHub / PH / HN / 掘金 templates |
| [docs/OWNER-CHECKLIST.md](./docs/OWNER-CHECKLIST.md) | **Resources you must provide** |
| [docs/SYNC.md](./docs/SYNC.md) | Monorepo sync loop |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Where to send PRs |

## Development (monorepo maintainers)

Sources sync from [llm-gateway](https://github.com/lqjack/llm-gateway):

```bash
cd llm-gateway
bun run neura-cli:sync -- ../neura-cli
bun run neura-cli:push      # git push standalone repo
bun run neura-cli:publish   # npm @neuradesk/cli
```

Do not hand-edit `src/` in this repo — run sync from monorepo.

## License

MIT — see [LICENSE](./LICENSE)

## Links

- [npm @neuradesk/cli](https://www.npmjs.com/package/@neuradesk/cli)
- [NeuraDesk welcome guide](https://gateway.datapro.asia/welcome/guide)
- [Issues](https://github.com/lqjack/neura-cli/issues)
