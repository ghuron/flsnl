# Azure Waste Scan / FinOps-for-AI — Complete Offering Brief (Claude Code handoff)

Lives at `src/docs/OFFERING.md` in the website repo (never reached by the build — see ARCHITECTURE.md). It is the single source of truth for everything decided about the offering. Build tasks live in section 7; everything else is context that copy, UI text, and behavior must stay consistent with.

---

## 1. Company context (fixed facts)

- First Line Software (FLS): software engineering firm, ~300 delivery engineers, HQ Cambridge MA; delivery centers Montenegro, Serbia, Slovakia, Czech Republic, Spain. ISO 27001/9001/14001 (Montenegro, Serbia, Czech entities).
- Microsoft Solutions Partner: Digital & App Innovation + Data & AI. Anthropic Claude Partner Network Select Partner (services).
- NL market entry: virtually no Dutch customers yet, historically high CAC, moving from T&M to productized outcome-priced offers. GTM: Microsoft co-sell + marketplace listing, PE/ISV motion (Main Capital, The Hague, 55+ software portfolio companies), small set of named accounts.
- Site: nl.firstlinesoftware.com, Dutch pages in informal "je" register. First contact: Andrei Zaikin (https://www.linkedin.com/in/zaikin/).
- Strategic guardrail: this offer is wedge #1. The company brand destination is AI systems that do work (healthcare data, commerce/logistics). Every engagement must end with the AI budget map or the wedge leads nowhere.

## 2. Positioning (non-negotiables)

- One line: "We find the ~29% waste in your Azure spend and turn it into your AI budget."
- Never brand as cost-cutting. Frame = optimize-to-fund-AI. Reason: Microsoft partner scores and field sellers reward consumption growth; redirected savings keep Azure consumption net-neutral/growing and make MS sellers a referral channel (they want customers optimized before EA/MACC renewals).
- Market facts used in copy: 29% cloud spend wasted, first rise in 5 years, driven by AI workloads (Flexera 2026); budgets exceeded ~17%; spend +28%/yr; focused Azure reviews surface 20–40% within weeks (practitioner consensus).
- Differentiator stack (all three together): (1) we look inside the workload — code, IaC, data access patterns, prompts; agents make it affordable; (2) outcome pricing with honest effort tiers, backed by a 300-engineer bench; (3) AI spend treated as a first-class cost domain with eval-backed evidence ("FinOps for AI" — nearly empty in NL).
- No-sysadmin positioning is shown structurally, never preached: the scan hands out a mirror and questions, not manuals. (User decision: the "we don't sell system administration" speech is deleted from copy.)
- Competitive frame: crowded shallow end (Azure Cost Management, FinOps tools, CSP resellers, free QuickScans). Jujitsu line for sales: "run the free QuickScans first — we start where they stop." Anchors: Xebia day rates €1,500–3,500 (T&M weakness), Freeday normalized pay-per-outcome in NL, Levi9 proves CEE delivery wins Dutch trust.
- Do not lead with certifications/badges/headcount alone. Never promise MACC eligibility or "pay from committed spend" (listing-only; services aren't MACC-eligible).

## 3. The service ladder (canonical, 8 steps)

Thread: money and access rise together — file on their laptop → a summary they choose to email → self-expiring read-only account → source code. Every promise self-verifiable.

1. **Get the file (~2 min).** Channel chooser first (pay directly / enterprise agreement / via reseller) — paths differ; CSP customers must request the file from their reseller. Static screenshots anchored on slow-moving landmarks (portal search box, "Cost Management + Billing → Invoices"), Microsoft docs linked as canonical fallback. Steer to monthly invoice files, never hourly exports. Quarterly calendar rule: re-verify the guide against the live portal.
2. **Browser scan (~2 min).** Everything in-browser; nothing transmitted (v1: no server exists). Explicit "fully loaded — you can go offline" state; airplane-mode ritual advised, optional; "don't refresh" warning (no service worker by design). No account, no cookies, no tracking.
3. **Report.** Three parts: (a) fix-it-yourself items — resource-level savings as ideas with Microsoft-doc links, never step-by-step manuals we'd have to maintain; (b) "smells like engineering" — hypotheses with annualized € ranges, explicitly marked hypotheses (a bill shows habits, not reasons; we only see ~3 months); (c) price band for the paid study from the sizing rule. Honest negative verdict path: "your bill is clean — the study isn't worth it yet." Two downloads: full report (real names, for them only) + share version (aliased, same numbers). PDF via print stylesheet. Canonical artifact = self-contained HTML boarding pass (see 5.5).
4. **They contact us — their move.** Mailto CTA: "interested? email us the share version." No backend, no lead capture, conscious funnel blindness (revisit: section 7, iteration 5).
5. **One call, then proposal.** 30-min engineer call over their report. Checks: telemetry coverage (App Insights; Query Store enabled — needs ~2 weeks of history, so switch on at contract signing), decompilation consent (client's own assemblies only; third-party/NuGet DLLs excluded; obfuscated → telemetry-only fallback). Proposal within days. Clock starts only when the access/homework checklist is green.
6. **The study.** ~€10k / 1 week / top-3 cost drivers (smaller estates) or €15–20k / 2 weeks / top 5–7 (larger). Two engineers + AI tooling. Deliverables: what the money actually buys, verified in production; savings with size/confidence/effort; signed one-page measurement baseline & methodology; the AI budget map; optional fixed-price reengineering proposal with an assumptions register verified in week 1 of any build. Findings are theirs standalone — free to implement with anyone (antidote to "paid sales pitch" smell).
7. **Build (optional).** Track A: reengineer to cut. Track B: build what the savings fund (the strategic destination). Fixed per milestone default; gainshare option on engineering savings only (50% of verified savings for 6 months, tiered — commercial levers ~15–20%; spend floor applies; absolute fee cap; client keeps 100% after).
8. **Cost Guardrail (subscription).** Monthly check against the signed baseline; drift alerts; first recurring-revenue line.

## 4. Target client and routing

**Ideal client:** hygienic estate (few commercial findings) + strong engineering/ML surface + real spend. For them, the compliment is the pitch: "you're well-run — which is why what's left is architectural."

**Architecture signals visible in billing:** IaaS-heavy mix (SQL on VMs, thin PaaS share); always-on compute with batch-shaped names (worker/etl/queue/render 24/7); flat provisioned capacity (Cosmos RU/s, DTU/vCore identical daily); heavy egress/cross-region bandwidth vs compute; AKS at steady node counts; observability outsized vs compute; cost growing linearly with business (no economies of scale).

**ML signals:** frontier-model monoculture (no cheap-model meters); input:output token ratio >~15:1 (context bloat, no caching); no batch meters despite steady volume; PTUs reserved but thin; GPU VMs on-demand 24/7, no spot; monthly re-embedding patterns next to vector search.

**Segments:** <~€10k/month → robot-only forever, except AI-native scale-ups where AI spend dominates (high AI share overrides low total → compact ML-optimization sprint, founder-speed decision). €25–150k/month → the target; PE-backed ISVs are the beachhead (Azure = COGS → gross margin → valuation multiple; one fund opens dozens of identical companies; source code + engineering culture in-house). Large enterprise/government → not now (tenders, BIO reviews, zero NL references); autonomous divisions welcome inbound; revisit after 2–3 citable references. Public marketing floor: "makes sense from ~€50k/month"; internal attention from €25k+.

**Politics (mid-market):** the sponsor is usually the person whose decisions created the waste — the narrative must make him the hero who found the AI budget. Incumbent MSP/CSP will resist (findings grade their homework, savings cut their margin) — no-sysadmin stance doubles as the peace signal.

**Contact ops:** first reply from Andrei personally, no CC. Five elements: mirror their headline number; name their 2–3 signals; the honest line ("commercially tight; what's left is architectural"); one ask; booking link. Engineer is CC'd only after the client's own reply puts findings on the thread. Engineer prep = auto-generated pre-call sheet from the share-version JSON (price band, staffing, homework flags, agenda questions); target ≤10 min prep per call.

## 5. Free scan — product spec

### 5.1 Report structure ("mirror, questions, honest ending")
- **The mirror:** their spend sorted into piles nobody internally has ever seen — top 10 items, always-on vs sometimes-on, prod-named vs test-named, AI token spend by model. No advice; can't be wrong; can't go stale.
- **The questions:** per finding — what we saw, yearly € range, one question ("six machines named *test* ran every night for three months, ~€9k/year — does anyone need them at 3 a.m.?"). Name the lever concept ("Azure sells reservations for exactly this pattern"), never the portal buttons; link Microsoft docs and let Microsoft maintain them.
- **The honest ending:** "patterns, not verdicts — verdicts need production access, longer history, your engineers in the room; that's the study, roughly €X for your size." Clean-bill sentence when true. This paragraph adapts to the routing quadrant (hygiene × engineering surface).

### 5.2 Two artifacts + aliasing
- **Full report:** real names; never leaves the machine; for internal client use.
- **Share version:** stable per-session aliases (vm-app-01 stays vm-app-01 throughout); field-level replacement of subscription GUIDs, resource/RG names, resource IDs, ALL tags (tags carry owner emails = personal data); belt-and-braces regex sweep for GUID-shapes and client naming patterns incl. inside AdditionalInfo/meter strings; marketplace vendor names aliased.
- **Local mapping file:** alias → real name, salted per session, salt never transmitted; client's private decoder ring; downloadable.
- Identity separation: the artifact names no company — who it belongs to arrives only via the email envelope.

### 5.3 Share version content — six blocks (inclusion test: does it change price band, staffing, homework, or call agenda?)
1. **Estate profile:** counts only — subscriptions, resource groups, resources, distinct services, regions.
2. **Spend picture:** 3 monthly totals (trend), top 5–10 cost drivers by service family (cost + share), IaaS/PaaS/data/observability/AI split. Aggregates only — NEVER unit prices (EffectivePrice exposes their negotiated Microsoft discount). Optional toggle: round amounts into bands.
3. **Hygiene scorecard:** commercial findings totals + % of spend (reservation gap, 24/7 non-prod, orphans, license gaps, marketplace zombies).
4. **Engineering hypotheses (top 5–7):** pattern + aliased examples + evidence counts (never raw rows), annualized € range, confidence, detector id, and "the question we'd ask" — this block IS the call agenda.
5. **Stack & telemetry fingerprint:** SQL-on-VM vs managed, AKS node counts, App Service tiers, queues/functions presence (event posture), Cosmos, AI panel (models, token ratio, PTU, batch, GPU SKUs), Windows/Linux mix; telemetry posture (App Insights / Log Analytics present or absent) — absent diagnostics pre-writes the homework list.
6. **Scan metadata:** months covered, granularity, agreement type (EA/MCA/CSP), currency, % rows parsed cleanly, detector version, report hash.
- Printed on the artifact itself, the exclusion list: no names, no GUIDs/resource IDs, no tags, no unit prices, no vendor names, no raw rows.

### 5.4 Boarding pass
Self-contained HTML with human report on top and embedded machine-readable JSON (findings, schema version, scan date, checksum). Dropping an old report back on the site restores full context — nobody re-extracts usage files. Old-vs-new delta ("your token spend doubled since July") is the re-engagement hook. Timestamped artifact also serves as who-found-what-when evidence for later attribution disputes.

### 5.5 Privacy / trust architecture (layered; v1 implements 1–4 trivially by having no server)
1. Download-first default; airplane-mode ritual; single-file offline build (later).
2. Browser-enforced: strict CSP (v1: connect-src 'none'), all assets self-hosted (no Google Fonts, no CDNs), SRI on scripts, no service worker, no iframes, no analytics or crash reporting on the analyzer page, memory-only (no localStorage/IndexedDB).
3. If/when an endpoint exists: exactly one route, schema-validated JSON, ~256 KB cap at the LB (a usage CSV physically can't fit), no upload endpoint at all; schema + cap published.
4. Client strips AND server rejects GUID-shaped/resource-ID payloads — a bug in one layer isn't a breach.
5. WYSIWYG consent (endpoint era): the preview IS the payload, uncompressed human-readable JSON in the Network tab.
6. /verify page (iteration 3): airplane-mode walkthrough, CSP explained, open-sourced analyzer with tagged releases + SRI hash match, endpoint schema, retention line (EEA, [90] days for anything received), annual third-party review letter. Honest boundary statement: verifiable-by-construction before the click, policy-based after.

## 6. Detector catalog (deterministic; DuckDB-WASM in browser; seeded by the internal mini-trial SQL)

Ground rules: all numbers from deterministic queries; telemetry-blind findings are labeled signals, never verdicts; conservative math with stated assumptions; reconcile totals before any detector; skip cleanly when meters don't occur ("no GPU or OpenAI meters found").

- D1 Commitment coverage (commercial): OnDemand compute with steady ≥~700 h/month across the window → 30% (1-yr) / 55% (3-yr) assumed discount; list candidates.
- D2 24/7 non-production (engineering-lite): name/RG/tag regex (dev|tst|test|acc|stag|qa|sbx|sandbox|demo|poc) with full-month hours → ~68% reduction (12x5 schedule assumption).
- D3 Hybrid Benefit (commercial): Windows/SQL license meters → savings if licenses owned; low confidence until confirmed.
- D4 Observability (engineering): Log Analytics / App Insights ingestion+retention share of spend; per-GB rate.
- D5 Storage tiering (engineering): hot-tier GB with near-zero transactions → cool/archive; GRS on non-prod.
- D6 Orphans (engineering-lite): disks/IPs/LBs in RGs with zero compute all window; snapshots growing monotonically.
- D7 Flat provisioned PaaS (engineering): identical daily quantity ≥85 of 91 days (Cosmos RU/s, DTU/vCore) → autoscale/serverless candidate.
- D8 Previous-gen SKUs (engineering): v2/v3 series meters → newer-gen price-performance.
- D9 AI spend (the wedge): model mix, input:output ratio >15:1 flag, batch-meter absence, idle PTU, GPU on-demand 24/7 / no spot.
- D10 Marketplace zombies (commercial): recurring Marketplace flat fees, aliased list.
- D11 Drift & anomalies: MoM per service family; resources present in month 3 absent in month 1; refunds/credits.
- Schema adapters: v1 MCA/pay-as-you-go monthly invoice CSV ("Azure usage and charges"); v2 adds EA and CSP/reseller file; FOCUS variant recognized. Expected columns documented in claude-code-prompt-azure-audit.md.
- Scoring for routing: hygiene score (1 − commercial findings share of spend) × engineering-surface score (weighted count of section-4 signals) → quadrant drives the report's closing paragraph and, later, lead triage.

## 7. Build plan (iterative) and MVP definition

**Iteration 0 — offline validation (1–2 wks, partly done).** Detector SQL exists from the internal mini-trial (own bill, ~$1k/mo PAYG, Apr–Jun 2026). Run manually under NDA on 2–3 friendly files (existing non-NL client; a warm Main Capital portfolio contact). Tests: schema variance parses; hypotheses impress a technical reader; report ends in "let's talk." Files become permanent test fixtures; one engagement becomes the citable number.

**Iteration 1 — MVP (3–4 wks, one engineer + Andrei for words). THE BUILD TARGET:**
- One static page, no backend, English only.
- "Get your file" guide for ONE channel: direct/MCA monthly invoice CSV. Say openly: "other formats coming — or email us."
- Drag-and-drop → in-browser analysis (DuckDB-WASM) → report: the mirror + 5–6 highest-signal detectors (D1, D2, D7, D10, D9, optionally D6) + honest verdict incl. clean-bill path + price band + two downloads (full, share) + mailto CTA ("attach the share version").
- Privacy claim true from day one (static, self-hosted assets, no analytics on analyzer page, memory-only). Privacy ceremony (verify page, open source, airplane choreography) deliberately absent.
- Ugly is fine; wrong numbers are not — any € a detector can't defend gets a wide range or is cut.
- Success metric (60–90 days, counted in the inbox): share-version emails → calls → proposals; one paid study proves the machine.

**Iteration 2 — widen the mouth (2–3 wks):** EA + CSP schema adapters; channel chooser with static screenshots + Microsoft-doc fallbacks; Dutch version ("je" register); PDF via print stylesheet; full detector set; oversize-file handling ("an estate this size needs the assessment" CTA); boarding-pass restore. Priority order = whatever actually lost people in It-0/MVP.

**Iteration 3 — trust ceremony (1–2 wks, triggered by first real DPO/security pushback, not before):** /verify page; open-source analyzer, tagged releases, served-bundle hash match; single-file offline build; explicit "you can go offline now" state.

**Iteration 4 — distribution (parallel from MVP launch):** Marketplace listing live (listing-only NL; copy exists; name format fixed: "Azure Waste Audit: 2-Wk Assessment"); co-sell one-pager + deck; Andrei outbound ask ("run this on your bill — it never leaves your browser — tell me what it says"); Main Capital portfolio-wide scan offer.

**Iteration 5 — endpoint (only if earned):** after ~90 days, if calls reveal "scanned weeks ago and hesitated," build the consented-summary endpoint (layers 3–5 of section 5.5). Until then, "there is no server" outweighs analytics.

**Parallel delivery track (ready BEFORE MVP launch):** access annex; proposal template with assumptions register; measurement-methodology one-pager; sizing rule written down; named engineer owning pre-call sheets.

**Standing rhythms:** quarterly 15-min re-verification of the export guide vs the live portal; flywheel rule — every fixture file, failed parse, and paid-study finding becomes a test fixture or a new detector.

## 8. Website technical constraints (must hold true)

- Static site; zero backend in v1; nothing transmitted anywhere, ever, by the analyzer page.
- DuckDB-WASM (or equivalent) for in-browser CSV analysis; memory-only; monthly invoice CSVs are typically small — set an explicit oversize threshold [DECIDE] that routes to the assessment CTA instead of crashing.
- Strict CSP (connect-src 'none' in v1); all fonts/scripts self-hosted; SRI; no service worker; no iframes; no cookies; no analytics/crash reporting on the analyzer page. ("Don't refresh" notice replaces the service worker.)
- Report artifacts: in-page render; full + share HTML downloads (self-contained, embedded JSON block per 5.4); local mapping file download; print stylesheet for PDF.
- Aliasing exactly per 5.2–5.3, including the AdditionalInfo/meter-string regex sweep and the unit-price exclusion.
- Pages: landing/offer page (copy basis: azure-waste-audit-copy-v2.md, EN+NL) and /demo (the scanner); /verify reserved for iteration 3. NOTE: the consent-gate microcopy in copy v2 §4 is superseded by the static mailto design — needs a v3 pass; the ladder on the landing page should follow section 3 of this file (8 steps, price bands €10k / €15–20k).
- Language: EN first; NL in iteration 2, informal "je", consistent with nl.firstlinesoftware.com.

## 9. Step 2 delivery reference (keeps site promises consistent)

- Economics: ~21 person-days (2 engineers ~9d + lead ~3d); CEE loaded cost €300–400/day → €6.5–8.5k against the fee. €10k = 1 week / top-3 drivers; €15–20k = 2 weeks / top 5–7. Contract: clock starts when the access checklist is green.
- Quality gate: a deep-dive finding needs two-domain evidence (billing × telemetry, telemetry × decompiled code, query plans × schema).
- Access annex: Reader, Cost Management Reader, Monitoring Reader, Resource Graph, App Insights (incl. application map), NSG flow logs, SQL Query Store (VIEW DATABASE STATE; ~2 weeks history — enable at signing), Kudu/SCM, ACR pull, artifact-feed read; AKS adds Kubernetes RBAC Reader. Time-boxed PIM guest accounts, auto-expiring; Key Vault and data planes excluded unless opted in. Decompilation consent: client's own assemblies only, third-party/NuGet excluded; obfuscated → telemetry-only fallback.
- Workstreams: WS-A map (13-mo billing via API, inventory, dependency graph, confirm top drivers) → WS-B runtime truth (P95 vs provisioned; N+1, fan-outs, retry storms, zero cache hits, sync-over-async; AKS requests-vs-usage, bin-packing, spot; LA ingestion by table) → WS-C data tier without data (Query Store top-N, wait stats, non-sargable/implicit conversions/key lookups/GUID clustered keys/tempdb spills; tier fit, replicas, cold-history partitioning; Cosmos RU/op, hot partitions, index policy) → WS-D telemetry-targeted assembly review, hard timebox (EF misuse, polling→queue, in-proc schedulers, hot-loop serialization, chatty calls↔egress, scale-unit mismatch, old TFMs, compression; ISVs: cost-per-tenant — the PE-grade number) → WS-E synthesis (env parity, DR vs RTO, event posture, AI confirmed vs code) → WS-F economics + write-up (baseline, methodology annex, AI budget map, assumptions register, readout, optional Step 3 proposal).

## 10. Distribution facts

- Marketplace: consulting-service listing, listing-only works in all markets; leads land in Partner Center Referrals; title format required "Offer Name: Duration Service type"; NL market; keywords FinOps / Azure cost optimization / cloud waste; verified field lengths in copy v2 (summary 95/100, description ~1,880/2,000). No MACC/committed-spend/transactable language.
- Co-sell ready needs: existing designation (have), published offer, one-pager, pitch deck, NL sales contact.

## 11. Existing assets from this chat (drop into repo /docs)

- azure-waste-audit-copy-v2.md — site EN+NL + Marketplace listing + demo microcopy (consent-gate part superseded; needs v3 pass per section 8).
- service-ladder-spec.md — internal spec v0.2 (this file effectively supersedes it as v0.3 content).
- claude-code-prompt-azure-audit.md — detector spec + schema column expectations; mini-trial produced findings.md, detectors/*.sql, anonymized scorecard, reconciliation (in the mini-trial workspace — reuse as seed + fixtures).
- azure-export-instructions.md — internal IT export instructions (basis for the public guide's direct/MCA path).

## 12. Open decisions (placeholders in copy marked [LIKE THIS])

1. Sizing rule formula (spend band × workload count) → exact price points €10k/€15k/€20k and the scan's price-indication logic.
2. Gainshare spend floor to publish (€80k vs €100k/month); fee cap formula (contract-only).
3. Step-2 fee credit against Step 3: yes/no, cap.
4. Guardrail pricing (flat band vs % of monitored spend).
5. Retention for received share versions ([90] days, EEA) + DPA + access-annex legal + NLdigital Voorwaarden sign-off.
6. Offer name final ("Azure Waste Audit" vs "AI Budget Finder"); oversize threshold; iteration-5 endpoint criteria.
7. Internal bench: name the 2–3 FinOps-capable engineers; FinOps Foundation cert / Azure specialization for credibility.

## 13. Standing rules and known risks

- Measurement disputes are failure mode #1 → signed methodology is non-optional, produced by the study.
- Contingency pricing lengthens legal cycles → fixed-price alternative always on the menu.
- The wedge must not become the brand → every study ends with the AI budget map.
- Guide rot → slow-moving anchors, Microsoft-doc fallbacks, quarterly checks.
- Funnel blindness is a conscious v1 trade — revisit with evidence only.
- Access delays eat study margin → clock-start clause.
- Free-scan credibility: wide ranges or cut; the clean-bill sentence is the credibility engine.
- Politics: make the sponsor the hero; treat incumbent MSPs as channel, not enemy.

---

## Suggested first Claude Code session

1. Scaffold static site (plain HTML/JS or a minimal framework), CSP per section 8, self-hosted assets.
2. Port the mini-trial detector SQL into the browser engine; wire the MCA/PAYG schema adapter; run against the mini-trial fixture CSVs as tests.
3. Build the report renderer: mirror → questions → honest ending; then the two-artifact generator with aliasing + mapping file.
4. Landing page from copy v2 with the section-8 corrections; /demo page with the one-channel file guide.
5. Leave stubs (clearly marked) for: price-band formula, oversize threshold, NL strings, /verify.
