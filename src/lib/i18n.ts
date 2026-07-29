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
