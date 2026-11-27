#!/usr/bin/env bun
// Keep the common help path free of config and integration imports.
if (process.argv.length === 3 && process.argv[2] === "help") {
  const { printHelp } = await import("./cli-help")
  printHelp()
} else {
  await import("./cli-full")
}
