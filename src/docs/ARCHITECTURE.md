# Architecture — Azure Waste Scan site

Decisions locked in 2026-07-24; layout, build and content sections updated 2026-07-27 to match
what is actually built. Supersedes nothing in OFFERING.md; this is the technical implementation
of section 8 ("Website technical constraints") plus website-tech.md.

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

- **Astro**, static output. Zero JS on the landing page — `/` ships no `<script>` at all and
  carries `script-src 'none'`. The scanner is the only client code and lives on `/azure/`, in
  its own chunk outside the critical path (fastest-render-for-NL-users goal in website-tech.md).
- **One self-hosted web font** (Manrope, single variable woff2, `font-display: swap`), served
  from our own origin — no third-party request, so the no-GDPR-banner constraint in
  website-tech.md still holds. Fallbacks are the system stack.
- **No build output is ever committed.** `dist/` and `.astro/` are gitignored; GitHub Actions
  (`withastro/action@v3`) builds from source on every push to `main` and publishes to Pages.
  The repo contains sources only.
- **Everything that ships is processed by Vite** — minified and content-hashed into `_astro/`
  for far-future caching:
  - `src/assets/css/site.css` is imported by `BaseLayout.astro`; the `@font-face` URL inside it
    resolves relative to the stylesheet, so the woff2 is emitted hashed too.
  - `src/scripts/scan.js` is reached only through a dynamic `import()` in the `/azure/` page
    script, so Vite code-splits it into a separate chunk. Vite resolves that chunk relative to
    the loader module, which is what makes the `SITE_BASE=/flsnl/` subpath deploy work without
    any manual URL handling. The chunk is fetched **eagerly on `requestIdleCallback`**, not on
    scroll — see "Offline promise" below for why.
  - Page `<script>` tags must stay **non-inline** (never `is:inline`, never `define:vars` —
    both force an inline script). Astro emits them as external module scripts, which is what
    keeps `script-src 'self'` satisfiable. Pass values into client code via `data-` attributes.
- **`public/` holds only assets that need fixed, unhashed URLs**: favicons, PWA icons,
  `site.webmanifest` (its icon paths are relative, so the base path does not affect it), and
  the logo. `src/lib/url.ts` (`withBase`) exists for exactly those, plus internal hrefs.

## Repo layout

```
src/
  pages/          index.astro (/), azure/index.astro (/azure/) — both currently NL-only
  layouts/        BaseLayout.astro — head, CSP meta, topbar, footer
  content/        common|home|azure × {en,nl}.yaml, schema in src/content.config.ts
  i18n/           glossary.yaml + styleguide.md — staged for a future EN→NL step
  assets/         css/site.css, fonts/manrope-latin.woff2 — Vite-processed
  components/     ProseText.astro — autolinks technical terms in content strings
  scripts/        scan.js — the browser scanner; connectivity.js — online/offline strip
  lib/            url.ts (withBase)
  docs/           this file + planning docs; csv/ = local billing samples (gitignored)
public/           favicons, PWA icons, site.webmanifest, logo — copied verbatim
.github/workflows/ deploy.yml → build + publish to Pages
```

Nothing under `src/docs/` reaches the build: content-collection globs are scoped to
`src/content/{common,home,azure}`, and only files under `src/pages/` become routes. Verified by
grepping `dist/` after a build.

### Planned, not yet built

None of the following exists in the repo yet; they are the intended direction, not current
layout. The shipped scanner is hand-written JS with its own CSV parser (`src/scripts/scan.js`),
**not** DuckDB-WASM.

```
src/detectors/           D1–D11 ported from the mini-trial SQL, index.ts registry
src/lib/duckdb/          wasm init, self-hosted + SRI-pinned
src/lib/alias/           aliasing engine + mapping-file generator (OFFERING.md 5.2/5.3)
src/lib/report/          mirror/questions/honest-ending renderer, boarding-pass HTML+JSON
src/lib/schema-adapters/ v1 MCA/PAYG CSV adapter (v2 EA/CSP later)
fixtures/                mini-trial anonymized CSVs — permanent regression fixtures (section 7)
tests/detectors/         each detector run against fixtures, asserts exact numbers
.github/workflows/ci.yml lint/typecheck/detector-regression/build
CNAME                    firstlinesoftware.nl (once the domain is wired up)
```

If DuckDB-WASM does land, the standing decision is to vendor it into the build (not CDN-load it)
with SRI hashes pinned — that gets iteration-3's "served-bundle hash match" promise nearly free.

## Offline promise (`/azure/`)

Service-ladder step 2 (OFFERING.md §3) advises the airplane-mode ritual. An indicator in the
topbar's right-hand cluster — same row and baseline as the contact button, beside where a nav
menu will go — reports connection state, driven by `src/scripts/connectivity.js`.

- **Two states: online (outline globe, muted grey) / offline (solid airplane, accent blue)**,
  each with a text label, so state is carried by shape and wording rather than colour alone.
  Below 600px the label collapses to screen-reader-only and the icon remains, keeping the logo
  and contact button uncrowded.
- **Explicitly not a red/green health light, and this should not be "fixed" back into one.**
  The page transmits nothing in *either* state (`connect-src 'none'`), so a red offline dot
  would flag the exact behaviour the airplane-mode ritual is steering people toward, and a
  green online dot would imply an all-clear the connection has nothing to do with. Online is
  therefore drawn neutrally and makes no claim; offline gets the accent as a state the reader
  achieved. A padlock metaphor was rejected for the same reason — an open lock while online
  would assert an exposure that does not exist.
- Both icons ship inline in the markup and CSS reveals one. No client code builds DOM, and no
  icon font or sprite is fetched.
- The offline label says "Vliegtuigmodus" / "Airplane mode", which names the recommended ritual
  rather than the literal signal: `navigator.onLine` is also false for a dropped wifi link or
  an unplugged cable. If that imprecision ever matters, the label is one line per locale in
  `src/content/azure/{en,nl}.yaml`.
- Step 2 also promises an explicit "fully loaded — you can go offline" state. The indicator no
  longer carries that (it tracks the connection, not the scanner); if that promise is to be
  kept, it needs somewhere else to live — most naturally the scan section's own status line.
- **The module map caches failures, and that still shapes the loader.** A rejected `import()`
  stays rejected for the life of the document: re-importing the same specifier returns the
  cached rejection, so a failed load can never be retried in place. Two consequences in
  `src/pages/azure/index.astro`, both load-bearing — do not "simplify" either away:
  1. The loader refuses to attempt the import while `navigator.onLine` is false. One doomed
     fetch would poison the specifier permanently, so the attempt is deferred to the `online`
     event, where it becomes a clean *first* try that actually succeeds.
  2. If an attempt is made and fails anyway (online but the chunk 404s, e.g. a stale HTML page
     pointing at a hash a deploy replaced), the `dead` flag stops further retries and the scan
     section's status line tells the reader to reload. Retrying is not merely wasteful, it
     cannot work.
- **This is why the scanner loads on idle rather than on scroll.** The strip invites the reader
  to switch on airplane mode near the top of the page; a chunk that only downloaded once `#scan`
  approached the viewport would then never arrive. The earlier load-on-scroll was better for raw
  bytes-at-first-paint, but it made the offline claim false in the exact flow we recommend.
  Idle-time fetch keeps it off the critical path and costs ~7 KB gzip.
- `navigator.onLine` is the only signal used, deliberately: `connect-src 'none'` forbids probing
  a server for reachability, and doing so would contradict the no-transmission promise. Its
  usual weakness ("on a network" ≠ "internet reachable") does not apply to airplane mode.
- Any future client feature that needs the network must not be added to this page without
  revisiting the claim.

## Content pipeline (current state)

- Copy lives in YAML under `src/content/`, validated by a Zod schema in `src/content.config.ts`.
  Pages read it with `getEntry()`; no copy is hardcoded in templates.
- **`en.yaml` is the authored source but is not yet live** — both pages call
  `getEntry(..., "nl")` directly, so only the NL files render. `nl.yaml` was translated by hand.
- `src/i18n/glossary.yaml` (empty) and `src/i18n/styleguide.md` are staged for an automated
  EN→NL pass that **does not exist yet**.
- Publishing EN requires routing first — either `src/pages/en/` or a `[lang]` route with
  `getStaticPaths()` — plus lifting the hardcoded `"nl"` out of the two page frontmatters and
  the one Dutch error string in the `/azure/` loader script.

## Test strategy

No automated tests exist yet. Intended:

- Detector regression tests against the mini-trial fixtures wired into CI from day one — the
  product's own hard rule is "wrong numbers are not fine."
- Playwright test asserting `/azure/` makes zero network requests after the scanner chunk loads
  — continuously verify the "nothing transmitted" privacy claim instead of only asserting it in
  copy.

## Performance measurement

- **Lighthouse CI** as a GitHub Actions step on every PR — headless Chrome against the built
  static output, no external account/API key. Explicit budgets (landing-page JS weight,
  LCP/TTFB thresholds) fail the build on regression rather than shipping it.
- **Bundle-size check** on build output, keeping the scanner chunk isolated from marketing pages
  — the main lever for "fastest possible" per website-tech.md.
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
