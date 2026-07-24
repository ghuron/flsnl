# Architecture — Azure Waste Scan site

Decisions locked in 2026-07-24. Supersedes nothing in OFFERING.md; this is the technical
implementation of section 8 ("Website technical constraints") plus website tech.md.

## Hosting & domain

- **Hosting: GitHub Pages**, built via GitHub Actions. Free, and Pages is a property of the
  repo rather than a separate vendor account — when the repo transfers to the FLS GitHub org,
  hosting comes with it. No second account for IT to take over later.
- **Domain: new apex `firstlinesoftware.nl`**, standalone from the existing
  `nl.firstlinesoftware.com` corporate site.
- **DNS stays at EuroDNS.** Point the apex at GitHub Pages' fixed A/AAAA records (not a
  `<user>.github.io` CNAME) — those IPs are owner-independent, so migrating the repo to the org
  later needs **zero DNS changes**, just re-adding/re-verifying the custom domain in the org
  repo's Pages settings (one-time TXT verification record at EuroDNS). DNSSEC is unaffected
  since EuroDNS stays authoritative NS throughout.

## CSP delivery (accepted tradeoff)

GitHub Pages can't send custom HTTP response headers, so CSP ships as
`<meta http-equiv="Content-Security-Policy">` rather than a real header. Covers
`connect-src 'none'`, script/style restrictions, etc. — everything in section 5.5 except
`frame-ancestors` (meta tags can't set it; not a real loss, nothing here should ever be framed).
Chosen over Cloudflare Pages specifically to avoid a second vendor account that would need its
own ownership transfer separate from the GitHub repo transfer.

## Framework & build

- **Astro**, static output. Zero JS on the landing page by default; DuckDB-WASM loads only as an
  island on `/demo`, keeping the marketing page tiny (fastest-render-for-NL-users goal in
  website tech.md).
- System font stack — no web fonts, no self-hosting/licensing overhead.
- DuckDB-WASM vendored into the build (not CDN-loaded) with SRI hashes pinned — gets you
  iteration-3's "served-bundle hash match" promise essentially for free from iteration 1.

## Repo layout

```
src/
  pages/                 index.astro, demo/index.astro, verify/index.astro (stub), nl/ (iter. 2)
  detectors/             D1–D11 ported from the mini-trial SQL, index.ts registry
  lib/duckdb/             wasm init, self-hosted + SRI-pinned
  lib/alias/               aliasing engine + mapping-file generator (OFFERING.md 5.2/5.3)
  lib/report/              mirror/questions/honest-ending renderer, boarding-pass HTML+JSON generator
  lib/schema-adapters/     v1 MCA/PAYG CSV adapter (v2 EA/CSP later)
fixtures/                 mini-trial anonymized CSVs — permanent regression fixtures (section 7)
tests/detectors/          each detector run against fixtures, asserts exact numbers
.github/workflows/        ci.yml (lint/typecheck/detector-regression/build), deploy.yml → Pages
docs/                      this file + existing planning docs
CNAME                      firstlinesoftware.nl
```

## Test strategy

- Detector regression tests against the mini-trial fixtures wired into CI from day one — the
  product's own hard rule is "wrong numbers are not fine."
- Playwright test asserting `/demo` makes zero network requests after load — continuously verify
  the "nothing transmitted" privacy claim instead of only asserting it in copy.

## Performance measurement

- **Lighthouse CI** as a GitHub Actions step on every PR — headless Chrome against the built
  static output, no external account/API key. Explicit budgets (landing-page JS weight,
  LCP/TTFB thresholds) fail the build on regression rather than shipping it.
- **Bundle-size check** on build output, keeping the DuckDB-WASM island isolated from marketing
  pages — the main lever for "fastest possible" per website tech.md.
- **WebPageTest.org** (free, no login) with an Amsterdam test node for real-world NL
  network/latency validation once deployed — manual, run against the live domain.

## Domain scope

- `firstlinesoftware.nl` stands alone — no redirect/link/integration with the existing
  `firstlinesoftware.com` or `nl.firstlinesoftware.com` sites. Discovered independently via
  Marketplace listing, direct outbound, etc.

## Migration path to FLS GitHub org

1. Build and ship now under a personal public GitHub repo.
2. When ready: GitHub "Transfer repository" (preserves history/issues/PRs, redirects old URL) —
   not a fresh clone+push.
3. Re-verify the custom domain in the org repo's Pages settings (one TXT record at EuroDNS).
4. No secrets exist in this architecture (zero backend, nothing transmitted), so there is nothing
   to rotate at transfer time — it's purely an ownership change.
