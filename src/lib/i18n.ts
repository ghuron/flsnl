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
 * Every page's URL in every locale it exists in, one row per page from the site spec's §3
 * sitemap table (src/docs/firstlinesoftware-nl-site-spec.md). `null` means that page doesn't
 * exist in that locale (Microsoft/Portfolio are English-only at an unprefixed path; Odoo is
 * Dutch-only). This is the single source both the nav and each page's hreflang alternate read
 * from — a URL written twice (once in nav, once in the page it links to) is exactly the kind of
 * two-source drift that broke month labels earlier in this project.
 */
export const ROUTES = {
  home: { nl: "/", en: "/en/" },
  offers: { nl: "/aanbod/", en: "/en/offers/" },
  // The Azure funnel lives under the offers path in both locales: hub -> free self-scan ->
  // paid human-led audit. Dutch slugs use "kosten" rather than a literal translation of the
  // product name ("verspilling"/waste), because "azure kosten besparen" is what Dutch buyers
  // actually search; EN mirrors that with "cost-*". The products keep their Waste Scan /
  // Waste Audit names on the page itself.
  azure: { nl: "/aanbod/azure/", en: "/en/offers/azure/" },
  azureScan: { nl: "/aanbod/azure/kostenscan/", en: "/en/offers/azure/cost-scan/" },
  azureAudit: { nl: "/aanbod/azure/kostenaudit/", en: "/en/offers/azure/cost-audit/" },
  cases: { nl: "/cases/", en: "/en/cases/" },
  trust: { nl: "/vertrouwen/", en: "/en/trust/" },
  about: { nl: "/over-ons/", en: "/en/about/" },
  contact: { nl: "/contact/", en: "/en/contact/" },
  microsoft: { nl: null, en: "/microsoft/" },
  kennis: { nl: "/kennis/", en: "/en/notes/" },
  privacy: { nl: "/privacy/", en: "/en/privacy/" },
  thanks: { nl: "/bedankt/", en: "/en/thanks/" },
  portfolio: { nl: null, en: "/portfolio/" },
  odoo: { nl: "/odoo/", en: null },
} as const satisfies Record<string, Record<Locale, string | null>>;

export type PageKey = keyof typeof ROUTES;

/** This page's URL in `lang` — throws if that page doesn't exist in that locale, since a caller
 *  asking for a route that isn't there is a bug (a broken link), not something to paper over. */
export function routeFor(page: PageKey, lang: Locale): string {
  const path = ROUTES[page][lang];
  if (!path) throw new Error(`No ${lang} route for "${page}"`);
  return path;
}

/** This page's other-locale URL, or null if it has none (unprefixed/single-locale pages don't
 *  get an EN/NL switch link). */
export function altRouteFor(page: PageKey, lang: Locale): string | null {
  const other = lang === "nl" ? "en" : "nl";
  return ROUTES[page][other];
}
