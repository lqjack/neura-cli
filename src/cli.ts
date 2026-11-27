#!/usr/bin/env bun
// Keep the common help path free of config and integration imports.
if (process.argv.length === 3 && ["help", "--help", "-h"].includes(process.argv[2] ?? "")) {
  const { printHelp } = await import("./cli-help")
  printHelp()
} else {
  await import("./cli-full")
}
