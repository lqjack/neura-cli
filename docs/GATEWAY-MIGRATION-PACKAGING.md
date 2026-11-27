# Separate CLI packaging from the legacy gateway

Refs lqjack/neura-os#1220. From the independent checkout on Node 24/npm 11:

```sh
bash scripts/verify-gateway-migration-package.sh
```

The local check uses npm pack twice, in offline mode with lifecycle scripts
disabled and an isolated cache. It requires byte-identical archives and
checks the archive contains the CLI entry paths. For a stronger gate, put Bun
on `PATH` and supply trusted local dependency tarballs matching the pins and
integrities in `bun.lock` (for 0.1.2, dotenv 16.6.1 and yaml 2.9.0):

```sh
bash scripts/verify-gateway-migration-package.sh --smoke /path/to/dotenv.tgz /path/to/yaml.tgz
```

The smoke test installs the newly packed tarball with those dependencies into
a temporary prefix, with the registry offline and lifecycle scripts disabled.
It then runs the installed `neura help` executable from a separate empty
working directory with an isolated home and no inherited credentials or
gateway variables. Require `{"installedCliSmoke":"passed"}` in addition to
an exit status of zero; pack-only mode does not provide that receipt. It never
publishes, changes a workflow or tag, or contacts either gateway. These local
checks do not prove registry provenance or network compatibility.

Prior clean-room baseline at `6b528dd36fd08ee1f084156c9edd5824aa891e02`
matched all 78 tracked blobs; the unpacked CLI `help` passed and the 47
existing Bun tests passed with pinned local runtime and lockfile dependencies.
As of the verified migration baseline the registry contained 0.1.1 from the
old repo, while the standalone 0.1.2 GitHub release's publish job failed.
Use a future authorized independent registry receipt, integrity digest and
provenance before changing or disabling old release triggers.
