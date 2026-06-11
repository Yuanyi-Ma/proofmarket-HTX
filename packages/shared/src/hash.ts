// Pure-JS sha256 (no node:crypto): this module is imported by client
// components via fixtures.ts, so it must bundle for the browser too.
// Same algorithm, same hex output as the previous createHash("sha256").
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

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
  return `0x${bytesToHex(sha256(new TextEncoder().encode(stableStringify(input))))}`;
}
