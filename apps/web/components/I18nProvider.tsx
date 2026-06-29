"use client";

import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { getUiText, type UiText } from "../lib/i18n";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: UiText;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  children
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initialLocale));
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(normalizeLocale(next)),
      t: getUiText(locale)
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return (
    useContext(I18nContext) ?? {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: getUiText(DEFAULT_LOCALE)
    }
  );
}
