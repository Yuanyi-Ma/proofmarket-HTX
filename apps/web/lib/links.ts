const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isFullTxHash(value: string | null | undefined): value is string {
  return typeof value === "string" && TX_HASH_PATTERN.test(value);
}

export function sepoliaTxUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

/** Shorten a long hex hash for display: 0x + 8 chars … last 6 chars. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
