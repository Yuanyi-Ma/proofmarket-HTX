import { createHash } from "node:crypto";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function compareKeys(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function stableStringify(input: JsonValue): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(input).sort(([a], [b]) => compareKeys(a, b));
  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${stableStringify(value)}`)
    .join(",")}}`;
}

export function stableHash(input: JsonValue): string {
  return `0x${createHash("sha256").update(stableStringify(input)).digest("hex")}`;
}
