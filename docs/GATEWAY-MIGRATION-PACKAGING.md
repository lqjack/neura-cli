# Separate CLI packaging from the legacy gateway

Refs lqjack/neura-os#1220. From the independent checkout on Node 24/npm 11:

```sh
bash scripts/verify-gateway-migration-package.sh
```

The local check uses npm pack twice, in offline mode with lifecycle scripts
disabled and an isolated cache. It requires byte-identical archives and
checks actual CLI entry paths. It does not install, publish, mutate workflow,
tag, use live credentials, or contact either gateway. It tests reproducible
artifacts, not verified package provenance or network compatibility.

Prior clean-room baseline at `6b528dd36fd08ee1f084156c9edd5824aa891e02`
matched all 78 tracked blobs; the unpacked CLI `help` passed and the 47
existing Bun tests passed with pinned local runtime and lockfile dependencies.
As of the verified migration baseline the registry contained 0.1.1 from the
old repo, while the standalone 0.1.2 GitHub release's publish job failed.
Use a future authorized independent registry receipt, integrity digest and
provenance before changing or disabling old release triggers.
