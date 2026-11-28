"""Measure fresh processes on one warmed host. Offline; no speed threshold."""
import argparse
import json
import math
import os
import pathlib
import random
import statistics
import subprocess
import tempfile
import time


def main():
    args = argparse.ArgumentParser(description=__doc__)
    for flag in ("node", "bun", "native", "packaged"):
        args.add_argument("--" + flag, required=True, type=pathlib.Path)
    args.add_argument("--n", default=60, type=int)
    cfg = args.parse_args()
    if not 20 <= cfg.n <= 300:
        args.error("--n must be 20–300")
    with tempfile.TemporaryDirectory() as home:
        node, bun, native, pkg = (getattr(cfg, field).resolve() for field in ("node", "bun", "native", "packaged"))
        light = pathlib.Path(home) / "help-control.ts"
        snapshot = pathlib.Path(__file__).resolve().parent / "src/help.txt"
        light.write_text("process.stdout.write(" + json.dumps(snapshot.read_text(encoding="utf-8")) + ");\n", encoding="utf-8")
        commands = {
            "npm-wrapper": [node, pkg / "bin/neura.js", "help"],
            "bun-direct": [bun, pkg / "src/cli.ts", "help"],
            "bun-lightweight-control": [bun, light],
            "rust-native": [native, "help"],
        }
        env = {"HOME": home, "USERPROFILE": home, "PATH": os.pathsep.join([str(bun.parent), str(node.parent), os.defpath])}

        def run(name):
            start = time.perf_counter()
            result = subprocess.run(commands[name], check=True, capture_output=True, cwd=home, env=env, timeout=10)
            elapsed = 1000 * (time.perf_counter() - start)
            if result.stderr:
                raise RuntimeError(f"{name}: stderr not empty")
            return result.stdout, elapsed

        reference, _ = run("npm-wrapper")
        for name in commands:
            for _ in range(5):
                actual, _ = run(name)
                if actual != reference:
                    raise RuntimeError(f"{name}: help parity failed")
        samples = {name: [] for name in commands}
        order = list(commands) * cfg.n
        random.Random(68).shuffle(order)
        for name in order:
            actual, t = run(name)
            if actual != reference:
                raise RuntimeError(f"{name}: help parity failed")
            samples[name].append(t)
        print(json.dumps({
            "runs_per_case": cfg.n, "help_bytes": len(reference), "native_binary_bytes": native.stat().st_size,
            "cases": {name: {"p50_ms": round(statistics.median(values), 2),
                             "p95_ms": round(sorted(values)[math.ceil(.95 * len(values)) - 1], 2)}
                      for name, values in samples.items()},
        }, indent=2))


if __name__ == "__main__":
    main()
