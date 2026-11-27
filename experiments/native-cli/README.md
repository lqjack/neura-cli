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

## Linux follow-up: peak RSS and apparent install bytes

Scope: positional `help` only at native commit
`2d1180755861fbab450b7a61e3a8379d3ae2e4aa`. The existing TS baseline is
an offline npm install of main `6b528dd36fd08ee1f084156c9edd5824aa891e02`;
the real lightweight control is the **same main** plus Drafts
[#1](https://github.com/lqjack/neura-cli/pull/1) `4fed90902710f339a8fd791ac4fa2de5b3b0eb5d`,
[#5](https://github.com/lqjack/neura-cli/pull/5) `b3b008c8776170c12c5f4d17d0606a9b142304f0` and
[#6](https://github.com/lqjack/neura-cli/pull/6) `275737de47bc1ad680de2fbeeda6a27f0aa392d3`
with disjoint paths (composed tree `48452366d20a680a1640a63b3e58f3b2b1cd144a`).
Pack with `npm pack --offline --ignore-scripts` and install each archive
in an empty prefix with `npm --prefix PREFIX install --offline --ignore-scripts --no-audit --no-fund --no-package-lock ARCHIVE DOTENV_TGZ YAML_TGZ`,
using trusted local dotenv 16.6.1 and yaml 2.9.0 tarballs.

Archive SHA-256 (main, then lightweight):

- `30eeefb5cb54965cbaccdbef7b689e2c9defc578cfda31ed4ee8d6754df6d140`
- `51e9fcd36fa4d3b32ba721d33f6f8208fbe1ac18d2f09b49acdc652d90b2bb6b`

Linux x86_64, CPU 0, Node 24.22.3, Bun 1.3.5, Rust 1.85.1. Fifty fresh
processes per case after five warmup rounds, shuffled per round (seed 2230),
from isolated HOME and an unrelated CWD. All runs exited 0 with empty stderr
and 3,251 identical stdout bytes (SHA-256
`63ac9e24f850994f8a652353384aa147e6ea52b7dda455ffd741bff8e9fc29f0`).

| Entry | p50 RSS (KiB) | p95 RSS (KiB) |
| --- | ---: | ---: |
| Main installed Node → Bun | 55,932 | 56,572 |
| Main installed TS, direct Bun | 56,068 | 56,836 |
| Lightweight installed Node → Bun | 35,516 | 35,516 |
| Lightweight installed TS, direct Bun | 35,508 | 35,512 |
| Native Rust experiment | 944 | 972 |

This is Linux `wait4`/`ru_maxrss`: the largest individual resident peak
accounted for in the reaped process and descendants it waited for. In a wrapper
row it is **not** Node-only RSS, the sum of Node and Bun peaks, or the maximum
simultaneous process-tree memory. The direct-Bun rows measure Bun without the
Node launcher. Do not compare these figures with container memory totals.

| Local artifact | Main bytes | Lightweight bytes |
| --- | ---: | ---: |
| Compressed CLI npm tarball | 1,085,471 | 1,086,545 |
| Regular-file apparent bytes in clean npm prefix, incl. dependencies | 2,189,446 | 2,192,112 |

For prefix bytes, sum `stat().st_size` for regular files, excluding symlinks,
directory metadata and external caches. The opt-in Rust executable was 362,976
bytes (stripped, dynamically linked); the preinstalled Node and Bun executable
files were 126,951,512 and 104,272,464 bytes. These are separately reported
file lengths, not full runtime installs or additive system costs; they exclude
shared libraries, allocation overhead and caches.

### Replay the RSS sample (Linux)

Compile the following helper with `cc -O2 -Wall -Wextra peak-rss.c -o peak-rss`.
Call it as `./peak-rss OUT ERR /absolute/path/to/command [args...]`, with a
clean environment that sets HOME and PATH and the same process affinity for
all arms. Use the installed `PREFIX/node_modules/.bin/neura help` in wrapper
arms and `/absolute/bun PREFIX/node_modules/@neuradesk/cli/src/cli.ts help`
in direct arms. Rust uses `neura-native-experiment help`. Validate each
reported exit and captured OUT/ERR before accepting its KiB sample. Interleave
the commands with a seeded shuffle per round, keep rounds 6–55, then calculate
the median and nearest-rank 95th percentile per entry.

```c
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <spawn.h>
#include <stdio.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>
extern char **environ;
int main(int argc, char **argv) {
    if (argc < 4) return 125;
    posix_spawn_file_actions_t files;
    if (posix_spawn_file_actions_init(&files)) return 125;
    if (posix_spawn_file_actions_addopen(&files, STDOUT_FILENO, argv[1], O_TRUNC|O_CREAT|O_WRONLY, 0600) ||
        posix_spawn_file_actions_addopen(&files, STDERR_FILENO, argv[2], O_TRUNC|O_CREAT|O_WRONLY, 0600)) return 125;
    pid_t pid;
    int e = posix_spawn(&pid, argv[3], &files, NULL, argv+3, environ);
    posix_spawn_file_actions_destroy(&files);
    if (e) { fprintf(stderr, "posix_spawn: %s\n", strerror(e)); return 125; }
    struct rusage usage;
    int status;
    while (wait4(pid, &status, 0, &usage) < 0) {
        if (errno != EINTR) { perror("wait4"); return 125; }
    }
    if (!WIFEXITED(status)) return 126;
    if (printf("%d %ld\n", WEXITSTATUS(status), usage.ru_maxrss) < 0) return 125;
    return 0;
}
```

The Linux help-only resource measurements favor the native probe, but do not
justify replacing the default runtime. Keep the lightweight TS change separate
and require macOS/Windows checks plus equivalent non-help command contracts
before broadening native distribution.

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
