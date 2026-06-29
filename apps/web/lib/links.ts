const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const INJECTIVE_EXPLORER_BASE_URL = "https://testnet.blockscout.injective.network";

export function isFullTxHash(value: string | null | undefined): value is string {
  return typeof value === "string" && TX_HASH_PATTERN.test(value);
}

export function injectiveTxUrl(txHash: string): string {
  return `${INJECTIVE_EXPLORER_BASE_URL}/tx/${txHash}`;
}

export function injectiveAddressUrl(address: string): string {
  return `${INJECTIVE_EXPLORER_BASE_URL}/address/${address}`;
}

/** Shorten a wallet address for display: 0x + 6 chars … last 4 chars. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Shorten a long hex hash for display: 0x + 8 chars … last 6 chars. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
