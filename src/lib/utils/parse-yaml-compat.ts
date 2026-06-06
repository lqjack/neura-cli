import { parse as parseYaml } from "yaml"

/** Parse YAML in Bun scripts and Node.js (Next standalone / dev). */
export function parseYamlCompat(raw: string): unknown {
  const bun = (globalThis as { Bun?: { YAML?: { parse: (s: string) => unknown } } }).Bun
  if (bun?.YAML?.parse) return bun.YAML.parse(raw)
  return parseYaml(raw)
}
