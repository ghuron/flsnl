// Technical terms that src/i18n/styleguide.md keeps verbatim in every locale, mapped to the
// canonical URL each should link to. Because the terms are never translated, one entry here
// linkifies the term across all locales — no href duplicated into each content YAML.
export const AUTOLINK_TERMS: Record<string, string> = {
  "portal.azure.com": "https://portal.azure.com/",
  GitHub: "https://github.com/ghuron/flsnl",
  "Andrei Zaikin": "https://www.linkedin.com/in/zaikin/",
};

export type TextSegment = { text: string; href?: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest-first, so a future entry can never be swallowed by a shorter one that is its prefix.
const terms = Object.keys(AUTOLINK_TERMS).sort((a, b) => b.length - a.length);
const pattern = terms.length ? new RegExp(`(${terms.map(escapeRe).join("|")})`, "g") : null;

/**
 * Split prose into plain and linked segments. Punctuation around a term stays in the plain
 * segment, so "Log in at portal.azure.com." links the host and leaves the sentence period out.
 */
export function autolink(text: string): TextSegment[] {
  if (!pattern) return [{ text }];

  return text
    .split(pattern)
    .filter((part) => part !== "")
    .map((part) =>
      Object.hasOwn(AUTOLINK_TERMS, part) ? { text: part, href: AUTOLINK_TERMS[part] } : { text: part },
    );
}
