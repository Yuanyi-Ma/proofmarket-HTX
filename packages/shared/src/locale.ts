export type Locale = "en" | "zh";

export const DEFAULT_LOCALE: Locale = "en";

export function normalizeLocale(value: unknown): Locale {
  return value === "zh" ? "zh" : DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh";
}
