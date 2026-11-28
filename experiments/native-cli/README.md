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

## Linux follow-up: runtime packaging constraints

Tested the exact x86-64 Linux release artifact from runtime commit
`2d1180755861fbab450b7a61e3a8379d3ae2e4aa` (source carried unchanged by
docs head `9f500a872e5d8a138f533e7d16517e2101a37f0e`). SHA-256:
`6c8e52d9f8ef885cb826f67c3ed9af30710f075b0dbb7155f8fb8c39ecc79fda`.

| Property | Observed |
| --- | --- |
| Object | ELF64 LE PIE, x86-64-baseline ISA note |
| Program interpreter | `/lib64/ld-linux-x86-64.so.2` |
| Direct `DT_NEEDED` | `libgcc_s.so.1`, `libc.so.6` |
| `RPATH` / `RUNPATH` | Neither |
| Highest versioned glibc requirement | `GLIBC_2.34` (including the undefined `__libc_start_main` reference) |

To inspect an exact Linux artifact offline:

```sh
sha256sum "$artifact"
LC_ALL=C readelf -hW "$artifact"
LC_ALL=C readelf -nW "$artifact"
LC_ALL=C readelf -lW "$artifact" | grep 'Requesting program interpreter'
LC_ALL=C readelf -dW "$artifact" | grep -E 'NEEDED|RPATH|RUNPATH'
LC_ALL=C readelf -VW "$artifact" | sed -n '/Version needs section/,$p'
LC_ALL=C objdump -T "$artifact" | grep -F '(GLIBC_2.34)'
```

The static readback establishes a glibc symbol requirement, not support for
every environment that reports glibc 2.34. A minimal read-only mount namespace
on the same host contained just the binary, the same host's glibc 2.41 loader
and libc, and its libgcc, with empty working directory/HOME and no runtime in
PATH. Direct launch (not via an explicitly selected dynamic loader) returned
0, empty stderr and the exact 3,251 help bytes from above. Removing
`libgcc_s.so.1` made the same launch exit 127 with zero stdout and a missing
library diagnostic. No new runtime was installed.

### Paired older-userspace replay

Reused the exact native binary above, without rebuilding. On the same x86-64
Linux 6.18.57 kernel we ran two minimal, separately extracted distro userspaces.
APT validated the signed vendor indexes and package hashes before extraction.
At execution the distro root and fixture stage were mounted read-only inside
Bubblewrap, with private temporary storage, a synthetic working directory and
HOME, a cleared environment, and socket creation/connect denied. There were no
host-library mounts or service calls. These are userspace tests, not guest-OS
boots, ISA compatibility tests, or certifications for a target distro.

| Extracted amd64 userspace | Native positional `help` | Installed Node/Bun CLI |
| --- | --- | --- |
| Debian Bullseye, `libc6 2.31-13+deb11u11`, `libgcc-s1 10.2.1-6` | Exit 1, zero stdout; loader reports missing `GLIBC_2.32`, `GLIBC_2.33` and `GLIBC_2.34` | `help`, `--help`, `-h` and synthetic local catalog all pass |
| Ubuntu Impish archive, `libc6 2.34-0ubuntu3.2`, `libgcc-s1 11.2.0-7ubuntu2` | Exit 0, exact 3,251 stdout bytes, empty stderr | Same four cases pass |

The control is the offline npm-installed composition of #1/#5/#6, using the
actual `node_modules/.bin/neura` entry (Node 24.22.3 and Bun 1.3.5), not an
unpacked bundle or a replacement launcher. The measured composition used
main `6b528dd36fd08ee1f084156c9edd5824aa891e02`, #1 `4fed909`,
#5 `b3b008c`, and #6 `275737d` (tree
`48452366d20a680a1640a63b3e58f3b2b1cd144a`). The npm pack SHA-256 is
`51e9fcd36fa4d3b32ba721d33f6f8208fbe1ac18d2f09b49acdc652d90b2bb6b`.
Each passing help variant had the same stdout hash
`63ac9e24f850994f8a652353384aa147e6ea52b7dda455ffd741bff8e9fc29f0`.
The installed `connector list --plugin local-probe --json` opened a synthetic
bundled YAML catalog and returned the expected 254-byte JSON (SHA-256
`d2e18ed604342e28d719164bb911b11af625ee924df7442b2766c387ecc0f298`);
the native binary on 2.34 correctly rejected that unsupported command with
exit 2. Check the actual launch rather than only `ld.so --list`: the Bullseye
loader listed dependencies and returned 0 despite emitting version errors.

For an offline recheck, pin the package sources and hashes, extract each
set into its own directory without installing it, and expose only that
userspace and an isolated stage containing the exact artifacts and fixture
above. Inspect the distro libc and dependency paths inside the sandbox, then
run both commands directly via their actual entry points and capture exit,
stdout bytes and stderr. The libc package hashes were
`05f7264da867b37f4c5ce49266b558ea1e81e05a9464f623152fca70f3550282`
(Bullseye) and `2d0509f10c42ad55da3e4ec721288ca6afa7e2db13eaf7a4b7f819e4d4ef3e47`
(Impish). The applicable signed archive indexes came from
[Debian Bullseye](https://deb.debian.org/debian/dists/bullseye/InRelease)
and [Ubuntu Impish updates](https://old-releases.ubuntu.com/ubuntu/dists/impish-updates/InRelease).
Impish is an archived fixture, not a suggested deployment target.

**Decision:** this binary would fail on a tested glibc 2.31 userspace where
the installed CLI works. Keep Rust opt-in. If 2.31 is part of the supported
floor, build a compatible native artifact and repeat the packaged install/run
check before considering a default switch. Other glibc builds, musl, CPU
generations, macOS, Windows, and real installed-host distribution remain
unverified. No published package or default entry changed.

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

## Linux output-sink parity

On the pinned Linux builds above (one native executable and the main and
lightweight archives, each via the installed wrapper and direct Bun), one normal
`help` per entry returned 0, no stderr and the same 3,251 stdout bytes. Five
fresh attempts per entry per failure mode produced:

| Stdout sink | Native Rust | Main and lightweight, both entry points |
| --- | --- | --- |
| Pipe with its read end already closed | Exit 0, no stderr | Exit 0, no stderr |
| Linux `/dev/full` | Exit 1; reports `No space left on device (os error 28)` to stderr | Exit 0, no stderr |

No disk was filled. To replay offline, for each **absolute** command prefix use
a fresh empty current directory and clean HOME, with the matching Node/Bun on
PATH. In Python, use either `read_fd, fd = os.pipe(); os.close(read_fd)` or
`fd = os.open('/dev/full', os.O_WRONLY)`, then run
`subprocess.run([*cmd, 'help'], stdout=fd, stderr=subprocess.PIPE, env=env, cwd=cwd, timeout=5)`
and close `fd` in a `finally` block. Compare both return code and stderr;
use `stdout=subprocess.PIPE` for the normal byte control.

A deliberate pipe close is quiet in both builds. A hard output failure is not
exit-status compatible; the native experiment surfaces it. Keep the experiment
optional. Before replacing the default, explicitly decide and test which
output-error contract to support rather than silently changing it. This only
covers the Linux `help` path; no packaging, runtime default, or release change.
