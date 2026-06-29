import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { I18nProvider } from "../components/I18nProvider";
import { documentLang, LOCALE_COOKIE } from "../lib/i18n";
import { normalizeLocale } from "@proofmarket/shared/src/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofMarket",
  description: "Trusted Professional Evidence Network for AI Agents",
  icons: {
    icon: "/favicon.svg"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={documentLang(locale)}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
