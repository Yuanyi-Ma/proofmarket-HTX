/**
 * Authoritative source-library registry. Every provider declares which
 * libraries it holds access to, every briefing answer is tagged with the
 * library its source came from, and every juror declares which libraries it
 * can reach for original-text verification. Juror assignment requires the
 * juror's access to cover the counter-evidence's library.
 *
 * Names are real, well-known databases so the catalog reads like a
 * professional research marketplace; access kinds distinguish paid
 * subscriptions from open archives (open archives need no license to verify
 * against, which matters for juror assignment).
 */
export type LibraryId =
  // 学术论文库
  | "ieee-xplore"
  | "acm-dl"
  | "sciencedirect"
  | "springer-link"
  | "arxiv"
  | "usenix"
  | "cnki"
  // 行业研究 / 咨询报告库
  | "messari-pro"
  | "delphi-digital"
  | "galaxy-research"
  | "gartner"
  | "idc"
  | "forrester"
  | "statista"
  | "cb-insights"
  // 金融数据库
  | "bloomberg"
  | "wind"
  | "spcapitaliq"
  // 法规 / 判例库
  | "pkulaw"
  | "wolters-kluwer"
  | "lexisnexis"
  | "westlaw"
  | "eur-lex"
  | "npc-flk"
  // 兜底：未经授权库背书的公开网页
  | "open-web";

import { normalizeLocale, type Locale } from "./locale";

export type LibraryKind =
  | "Academic literature database"
  | "Industry research database"
  | "Financial database"
  | "Legal and regulatory database"
  | "Public web";

export type LibraryInfo = {
  /** Display name, the official product name. */
  name: string;
  kind: LibraryKind;
  /** Paid subscription = license-gated; open access/public = anyone can verify. */
  access: "Paid subscription" | "Open access" | "Official public source";
};

export const LIBRARIES: Record<LibraryId, LibraryInfo> = {
  "ieee-xplore": { name: "IEEE Xplore", kind: "Academic literature database", access: "Paid subscription" },
  "acm-dl": { name: "ACM Digital Library", kind: "Academic literature database", access: "Paid subscription" },
  sciencedirect: { name: "Elsevier ScienceDirect", kind: "Academic literature database", access: "Paid subscription" },
  "springer-link": { name: "SpringerLink", kind: "Academic literature database", access: "Paid subscription" },
  arxiv: { name: "arXiv", kind: "Academic literature database", access: "Open access" },
  usenix: { name: "USENIX", kind: "Academic literature database", access: "Open access" },
  cnki: { name: "CNKI", kind: "Academic literature database", access: "Paid subscription" },
  "messari-pro": { name: "Messari Pro", kind: "Industry research database", access: "Paid subscription" },
  "delphi-digital": { name: "Delphi Digital", kind: "Industry research database", access: "Paid subscription" },
  "galaxy-research": { name: "Galaxy Research", kind: "Industry research database", access: "Open access" },
  gartner: { name: "Gartner", kind: "Industry research database", access: "Paid subscription" },
  idc: { name: "IDC", kind: "Industry research database", access: "Paid subscription" },
  forrester: { name: "Forrester", kind: "Industry research database", access: "Paid subscription" },
  statista: { name: "Statista", kind: "Industry research database", access: "Paid subscription" },
  "cb-insights": { name: "CB Insights", kind: "Industry research database", access: "Paid subscription" },
  bloomberg: { name: "Bloomberg Terminal", kind: "Financial database", access: "Paid subscription" },
  wind: { name: "Wind", kind: "Financial database", access: "Paid subscription" },
  spcapitaliq: { name: "S&P Capital IQ", kind: "Financial database", access: "Paid subscription" },
  pkulaw: { name: "PKULaw", kind: "Legal and regulatory database", access: "Paid subscription" },
  "wolters-kluwer": { name: "Wolters Kluwer", kind: "Legal and regulatory database", access: "Paid subscription" },
  lexisnexis: { name: "LexisNexis", kind: "Legal and regulatory database", access: "Paid subscription" },
  westlaw: { name: "Westlaw", kind: "Legal and regulatory database", access: "Paid subscription" },
  "eur-lex": { name: "EUR-Lex", kind: "Legal and regulatory database", access: "Official public source" },
  "npc-flk": { name: "National Laws and Regulations Database", kind: "Legal and regulatory database", access: "Official public source" },
  "open-web": { name: "Open Web", kind: "Public web", access: "Open access" }
};

const ZH_LIBRARY_LABELS: Record<LibraryId, LibraryInfo> = {
  "ieee-xplore": { name: "IEEE Xplore", kind: "Academic literature database", access: "Paid subscription" },
  "acm-dl": { name: "ACM Digital Library", kind: "Academic literature database", access: "Paid subscription" },
  sciencedirect: { name: "Elsevier ScienceDirect", kind: "Academic literature database", access: "Paid subscription" },
  "springer-link": { name: "SpringerLink", kind: "Academic literature database", access: "Paid subscription" },
  arxiv: { name: "arXiv", kind: "Academic literature database", access: "Open access" },
  usenix: { name: "USENIX", kind: "Academic literature database", access: "Open access" },
  cnki: { name: "中国知网 CNKI", kind: "Academic literature database", access: "Paid subscription" },
  "messari-pro": { name: "Messari Pro", kind: "Industry research database", access: "Paid subscription" },
  "delphi-digital": { name: "Delphi Digital", kind: "Industry research database", access: "Paid subscription" },
  "galaxy-research": { name: "Galaxy Research", kind: "Industry research database", access: "Open access" },
  gartner: { name: "Gartner", kind: "Industry research database", access: "Paid subscription" },
  idc: { name: "IDC", kind: "Industry research database", access: "Paid subscription" },
  forrester: { name: "Forrester", kind: "Industry research database", access: "Paid subscription" },
  statista: { name: "Statista", kind: "Industry research database", access: "Paid subscription" },
  "cb-insights": { name: "CB Insights", kind: "Industry research database", access: "Paid subscription" },
  bloomberg: { name: "Bloomberg Terminal", kind: "Financial database", access: "Paid subscription" },
  wind: { name: "Wind 万得", kind: "Financial database", access: "Paid subscription" },
  spcapitaliq: { name: "S&P Capital IQ", kind: "Financial database", access: "Paid subscription" },
  pkulaw: { name: "北大法宝", kind: "Legal and regulatory database", access: "Paid subscription" },
  "wolters-kluwer": { name: "威科先行（Wolters Kluwer）", kind: "Legal and regulatory database", access: "Paid subscription" },
  lexisnexis: { name: "LexisNexis", kind: "Legal and regulatory database", access: "Paid subscription" },
  westlaw: { name: "Westlaw", kind: "Legal and regulatory database", access: "Paid subscription" },
  "eur-lex": { name: "EUR-Lex", kind: "Legal and regulatory database", access: "Official public source" },
  "npc-flk": { name: "国家法律法规数据库", kind: "Legal and regulatory database", access: "Official public source" },
  "open-web": { name: "公开网页", kind: "Public web", access: "Open access" }
};

export function libraryName(id: LibraryId): string {
  return LIBRARIES[id].name;
}

export function libraryNames(ids: readonly LibraryId[]): string {
  return ids.map((id) => LIBRARIES[id].name).join(" · ");
}

export function libraryInfo(id: LibraryId, locale: Locale = "en"): LibraryInfo {
  return normalizeLocale(locale) === "zh" ? ZH_LIBRARY_LABELS[id] : LIBRARIES[id];
}

export function libraryNamesForLocale(ids: readonly LibraryId[], locale: Locale = "en"): string {
  return ids.map((id) => libraryInfo(id, locale).name).join(" · ");
}
