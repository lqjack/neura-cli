# Native help experiment

Decision: **measure a native slice before rewriting NeuraCLI**. This optional,
dependency-free Rust crate has a separate name, `neura-native-experiment`.
Only the exact command `help` is implemented. Other arguments return exit 2
and point the reader to the existing CLI; there is no automatic fallback or
dispatch. The public npm entry, workflows, auth, config, routing and publishing
are unchanged. The help bytes are the existing CLI snapshot, including
commands that are **not** available in this experiment.

## Reproduce

- Use the standalone CLI commit
  `6b528dd36fd08ee1f084156c9edd5824aa891e02`. A local unpacked npm pack of that
  checkout, with its locked runtime dependencies installed, is the parity
  baseline. No registry publishing is required.
- Use Rust/Cargo 1.85.1 and run `cargo test --locked --offline` and
  `cargo build --release --locked --offline` from this directory. Tests clear
  environment and verify stdout bytes, exit status, and unsupported commands.
- Run:

```bash
python3 benchmark.py \
  --node /absolute/path/to/node --bun /absolute/path/to/bun \
  --native target/release/neura-native-experiment \
  --packaged /absolute/path/to/unpacked-local-cli --n 60
```

The harness verifies the **same 3,251 stdout bytes**, then measures fresh
processes, seeded interleaving, temporary HOME/CWD, five warm-up runs per
case and 60 timed runs per case. Debian 13 x86_64, Node 24.22.3, Bun 1.3.5,
Rust 1.85.1, warm filesystem/runtime caches:

| Entry | p50 ms | p95 ms |
| --- | ---: | ---: |
| Existing npm wrapper | 86.59 | 112.21 |
| Full TypeScript, direct Bun | 56.19 | 68.22 |
| Lightweight Bun control, same static help | 18.06 | 21.15 |
| Rust native help | 1.10 | 1.38 |

Stripped release binary: 362,976 bytes on this host, dynamically linked as
built; this is not an installation-size or platform-portability result. The
lightweight Bun control isolates part of the eager import overhead; it is
not a prototype production TS parser. Do not extrapolate to network latency,
Queue time, memory usage, or other OS/architectures. Verify all parity and
record performance outside mandatory wall-clock CI thresholds.

## Next decision

Optimize a lazy TS entry as a credible cheaper option. If short-command
latency remains material, pilot a native read-only command with an explicit
compatibility contract and shared acceptance fixtures. Next gates: Linux x64,
macOS arm64 and Windows x64 execution/distribution, p95, RSS, install size,
diagnostic output and UX. Any real network command must preserve established
URL/credential precedence, exact scope, timeout/retry/error and approval
semantics. Do not move actions or submissions until a durable request identity
and compatibility tests exist; do not use this experiment to change
lqjack/neura-os#1220 publication or #1217 production routing.

Rust optimization reference:
[The rustc book — Codegen Options](https://doc.rust-lang.org/rustc/codegen-options/index.html).
