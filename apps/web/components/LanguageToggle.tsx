"use client";

import React from "react";
import { LOCALE_COOKIE, nextLocale } from "../lib/i18n";
import { useI18n } from "./I18nProvider";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const target = nextLocale(locale);

  function switchLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocale(target);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={switchLanguage}
      aria-label={t.common.languageSwitch}
    >
      {t.common.languageSwitch}
    </button>
  );
}
