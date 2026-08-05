// The one place that says which locales exist and where each one lives.
//
// Before this, "the locale set" was asserted independently by the Props unions in each page
// component, the STR keys in src/scripts/strings.js, the yaml filenames under src/content/,
// the route paths under src/pages/, and a `lang === "en" ? "/en/" : "/"` ternary in two
// components. Every one of those fails loudly when a locale is added except the ternaries,
// which silently point a new locale's logo at the Dutch homepage.

export const LOCALES = ["nl", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Served from the site root; every other locale sits under its own prefix. */
export const DEFAULT_LOCALE: Locale = "nl";

/** Root path of a locale — what the header logo links to. */
export function localeHome(lang: Locale): string {
  return lang === DEFAULT_LOCALE ? "/" : `/${lang}/`;
}

/**
 * One canonical path per page, shared by every locale.
 *
 * This is a Dutch-native site, so the Dutch slug *is* the path — English serves the same page
 * at the same path under the /en prefix (/aanbod/ and /en/aanbod/). Keeping one slug set instead
 * of a per-locale pair means a URL can't drift between languages, the Dutch keywords the site
 * ranks on are the ones in every URL, and adding a page is one line rather than two.
 *
 * `locales` lists the languages a page actually exists in; three pages are single-locale and
 * simply live in that language's namespace (Microsoft and Portfolio are English-only, Odoo
 * Dutch-only), which is why this is a list rather than a boolean.
 */
export const ROUTES = {
  home: { path: "/", locales: ["nl", "en"] },
  offers: { path: "/aanbod/", locales: ["nl", "en"] },
  // The two Azure steps: free self-scan, then the paid human-led audit. Flat under /aanbod/
  // rather than nested under an /aanbod/azure/ hub — the offer tiles on /aanbod already do the
  // choosing the hub was built for, and keeping both meant two near-identical pages competing
  // for the same term. The slugs use "kosten" rather than a literal translation of the product
  // name, because "azure kosten besparen" is what Dutch buyers actually search.
  azureScan: { path: "/aanbod/azure-kostenscan/", locales: ["nl", "en"] },
  azureAudit: { path: "/aanbod/azure-kostenaudit/", locales: ["nl", "en"] },
  cases: { path: "/cases/", locales: ["nl", "en"] },
  trust: { path: "/vertrouwen/", locales: ["nl", "en"] },
  about: { path: "/over-ons/", locales: ["nl", "en"] },
  contact: { path: "/contact/", locales: ["nl", "en"] },
  kennis: { path: "/kennis/", locales: ["nl", "en"] },
  privacy: { path: "/privacy/", locales: ["nl", "en"] },
  thanks: { path: "/bedankt/", locales: ["nl", "en"] },
  microsoft: { path: "/microsoft/", locales: ["en"] },
  portfolio: { path: "/portfolio/", locales: ["en"] },
  odoo: { path: "/odoo/", locales: ["nl"] },
} as const satisfies Record<string, { path: string; locales: readonly Locale[] }>;

export type PageKey = keyof typeof ROUTES;

/** The default locale sits at the site root; every other one under its own prefix. */
function localize(path: string, lang: Locale): string {
  return lang === DEFAULT_LOCALE ? path : `/${lang}${path}`;
}

const existsIn = (page: PageKey, lang: Locale): boolean =>
  (ROUTES[page].locales as readonly Locale[]).includes(lang);

/** This page's URL in `lang` — throws if that page doesn't exist in that locale, since a caller
 *  asking for a route that isn't there is a bug (a broken link), not something to paper over. */
export function routeFor(page: PageKey, lang: Locale): string {
  if (!existsIn(page, lang)) throw new Error(`No ${lang} route for "${page}"`);
  return localize(ROUTES[page].path, lang);
}

/** This page's other-locale URL, or null if it has none (single-locale pages don't get an
 *  EN/NL switch link). */
export function altRouteFor(page: PageKey, lang: Locale): string | null {
  const other: Locale = lang === "nl" ? "en" : "nl";
  return existsIn(page, other) ? localize(ROUTES[page].path, other) : null;
}
