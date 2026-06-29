const LEGACY_MINOR_USDC = /\b(?:m|test )USDC\b/g;
const LEGACY_MOCK_USDC = ["Mock", "USDC"].join("");

export function displayAsset(value: string): string {
  return value.replace(LEGACY_MINOR_USDC, "USDC");
}

export function displayAllowedTarget(target: string): string {
  return target === LEGACY_MOCK_USDC ? "Injective USDC" : target;
}
