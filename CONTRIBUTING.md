# Contributing to NeuraCLI

Thanks for your interest. **This repo is synced from [llm-gateway](https://github.com/lqjack/llm-gateway)** — please contribute CLI logic there.

---

## Where to change code

| Change | Location |
|--------|----------|
| CLI commands · send · poll | `llm-gateway/scripts/neura-cli.ts` |
| Client libraries | `llm-gateway/src/lib/neura-cli/` |
| Demo scripts · README · marketing docs | `llm-gateway/packages/neura-cli/` |
| Sync / publish automation | `llm-gateway/scripts/sync-neura-cli-standalone.ts` |

After merging to llm-gateway `main`:

```bash
cd llm-gateway
bun run neura-cli:sync -- ../neura-cli
bun run neura-cli:verify
# maintainers: bun run neura-cli:push
```

**Do not hand-edit `src/` in this repo** — the next sync will overwrite it.

---

## Local development (this repo)

```bash
bun install
bun run neura --help
bun test src/
```

Requires `NEURA_API_KEY` and `NEURA_SERVER_URL` for live `neura send` — see [.env.example](./.env.example).

---

## Reporting issues

| Type | Where |
|------|-------|
| CLI bug · UX · npm package | [neura-cli Issues](https://github.com/lqjack/neura-cli/issues) |
| Server · plugins · Desk UI | [llm-gateway Issues](https://github.com/lqjack/llm-gateway/issues) |

---

## Release (maintainers)

See [docs/SYNC.md](./docs/SYNC.md) · [docs/OWNER-CHECKLIST.md](./docs/OWNER-CHECKLIST.md).

```bash
# in llm-gateway
bun run neura-cli:publish    # npm @neuradesk/cli
bun run neura-cli:push       # git push standalone repo
```

License: MIT
