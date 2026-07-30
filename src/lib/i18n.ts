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
  documentProcessing: { nl: "/documentverwerking/", en: "/en/document-processing/" },
  dataIntegration: { nl: "/data-ontsluiting/", en: "/en/data-integration/" },
  processAutomation: { nl: "/procesautomatisering/", en: "/en/process-automation/" },
  offers: { nl: "/aanbod/", en: "/en/offers/" },
  // Already built and shipped this session as URL-prefixed routing (matching every other page
  // here), not the same-URL "bilingual UI" the spec's table annotates it with — see the
  // handoff-plan note for why that reading was kept.
  azure: { nl: "/azure/", en: "/en/azure/" },
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
