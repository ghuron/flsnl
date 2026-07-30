# firstlinesoftware.nl — Full Site Specification (handoff v1.0)
Self-contained brief for copywriting + implementation. Everything marked [square brackets] is a placeholder or unconfirmed fact — ask the owner, never invent. Prepared July 2026.

⚠️ Domain note: earlier working decision was `nl.firstlinesoftware.com`; this brief was requested for `firstlinesoftware.nl`. Confirm final domain with the owner; the spec is domain-agnostic. If both exist, one must 301-redirect to the other.

---

## 1. Context (read first)

**Company.** First Line Software (FLS): software engineering firm, ~[300] engineers, founded 2010, HQ Cambridge, MA (US). Delivery centers: Montenegro, Serbia, Slovakia, Czech Republic, Spain. ISO 27001, 9001 and 14001 held by the Montenegro, Serbia and Czech Republic entities. Microsoft Solutions Partner for **Data & AI** and **Digital & App Innovation**; live NL business profile on Microsoft Marketplace anchored to the Dutch entity in 's-Gravenhage ([link to live profile]). Dutch entity: [statutory name, KvK, BTW, address]. First contact person in NL: [NAME], [title] — the owner of this brief.

**Positioning (recently decided — this overrides older drafts).** Capability-led, not vertical-led. FLS sells three capabilities: **document processing, data integration, process automation** — delivered as working software in 4–6 weeks at a fixed price, then operated with per-unit pricing. Verticals (healthcare data, commerce/logistics) appear ONLY as track record ("bewezen in de praktijk"), never as claimed specialisms — the company is deliberately earning the right to verticalize later. Anti-positioning: not a body shop, no time-and-materials by default ("geen uurtje-factuurtje"), no slideware ("AI die werk oplevert, geen slides").

**The site's job.** It converts warm, skeptical visitors — Microsoft sellers doing referral diligence, PE/ISV contacts after an intro, operations directors after outreach, procurement/security officers pre-contract — into booked meetings. Every page answers one or more of five verification questions: *Are they real and local? Can they do my specific problem? Are they safe to contract with? Who already trusts them? What happens if I reach out?* The site is not expected to generate cold leads; the exception is `/azure` (interactive analyzer), which is a lead-capture tool.

**Approved copy fragments (reuse verbatim or near-verbatim, do not water down):**
- Hook: `Werkende AI in 4-6 weken: documenten verwerken, data ontsluiten, processen automatiseren. Vaste prijs.`
- `Geen uurtje-factuurtje.`
- `AI die werk oplevert, geen slides.`
- `We reageren binnen één werkdag — ook als het antwoord is dat we je niet kunnen helpen.`
- Vertical framing: `Bewezen in de praktijk: EPD-ontsluiting en FHIR/OMOP-pipelines voor zorgorganisaties; catalogus-, order- en documentautomatisering voor commerce en logistiek.`
- The full Microsoft business-profile description (NL + EN) exists and is the canonical short company story; site copy must stay consistent with it (one-story rule: site ↔ Microsoft profile ↔ LinkedIn tell the identical story).

**Existing draft material.** Five Dutch page drafts exist (home, healthcare, trust, about, contact, v0.1). Trust/about/contact remain largely valid. Home needs its hero swapped to the capability hook. The healthcare page is **deprecated as a standalone page**: redistribute its content into the capability pages and Cases, with "specialisme" phrasing softened to track record.

---

## 2. Global rules

**Language.** Dutch-first, professional native-quality (never machine-translated), informal register ("je") used consistently. English versions: required for `/microsoft`, `/cases`, `/portfolio` and useful site-wide; hreflang correctly set. English tone mirrors the Dutch: plain, concrete, no superlatives.

**Tone of voice.** Engineering sobriety with dry confidence. Short sentences. Numbers over adjectives. Willing to say what FLS does NOT do. No "wereldklasse", no "toonaangevend", no exclamation marks, no AI-hype vocabulary ("revolutionair", "game-changer" verboden).

**Design principles.** Lean, fast, text-forward; feels like it was built by engineers with taste. Real photos only (team, office) — zero stock photography, zero generic AI-illustration style. One accent color max alongside brand blue. Mobile-first. Every page ends with a single clear CTA (usually: book a call with [NAME], photo included). No chatbots, no gated PDFs, no pop-ups, no cookie-wall dark patterns.

**Hard constraints (non-negotiable).**
- Do NOT mention NEN 7510 anywhere.
- No invented metrics, clients, testimonials or logos. Case studies use honest geographic/sector labels ("Amerikaans ziekenhuisnetwerk"). Only verified numbers; if unknown, leave [placeholder].
- Certificate scope stated honestly: ISO certs cover the MNE/SRB/CZ delivery entities that perform the work; NL entity is the contracting party.
- Delivery geography stated plainly (see About/Trust) — transparency is deliberate strategy.
- Claims of "300 engineers" and "since 2010": use whatever number the owner confirms; keep consistent everywhere.

**Facts sheet for the footer and legal blocks.** Legal name [x] · KvK [x] · BTW [x] · address [x, 's-Gravenhage/Den Haag area] · phone [x] · privacy link · ISO badge row linking to /vertrouwen · Microsoft partner profile link · EN/NL switch.

---

## 3. Sitemap

Primary nav: **Home · Oplossingen (3) · Aanbod · Azure-check · Cases · Vertrouwen · Over ons · Contact**
Secondary/utility: Kennis (blog) · EN/NL · Privacy
Unlisted (tagged URLs, not in nav): /microsoft · /portfolio · /odoo (optional) · /bedankt

| Page | NL slug | EN slug |
|---|---|---|
| Home | / | /en/ |
| Documentverwerking | /documentverwerking | /en/document-processing |
| Data-ontsluiting | /data-ontsluiting | /en/data-integration |
| Procesautomatisering | /procesautomatisering | /en/process-automation |
| Aanbod & prijzen | /aanbod | /en/offers |
| Azure-analyse (exists) | /azure | /azure (bilingual UI) |
| Cases | /cases | /en/cases |
| Vertrouwen & compliance | /vertrouwen | /en/trust |
| Over ons | /over-ons | /en/about |
| Contact | /contact | /en/contact |
| Microsoft (channel) | /microsoft | same, EN-first |
| Kennis / Engineering notes | /kennis | /en/notes |
| Privacy & cookies | /privacy | /en/privacy |
| Bedankt (post-form) | /bedankt | /en/thanks |
| PE/portfolio lander | /portfolio | EN-only |
| Odoo lander (optional) | /odoo | NL-first |

---

## 4. Page specifications

### 4.1 Home — `/`
**Purpose:** pass the 3-minute verification test on one screen; route visitors to the right depth.
**Audience:** everyone; assume skeptical and briefly attentive.
**Content blocks, in order:**
1. Hero: the approved hook as H1, one supporting line ("First Line Software bouwt en beheert AI- en dataoplossingen — met [300] engineers in eigen Europese deliverycentra en één vast aanspreekpunt in Nederland."), primary CTA "Plan een gesprek met [NAME]" (photo thumbnail on the button block), secondary CTA "Doe de Azure-check".
2. Three capability cards (Documentverwerking / Data-ontsluiting / Procesautomatisering): one concrete sentence each + linked to their pages. Copy direction: name artifacts a buyer recognizes (facturen, orders, rapporten; verspreide systemen; repeterende workflows).
3. "Zo werken we" — 3 steps: vaste-scope start (4–6 weken, werkende software in jouw eigen Azure-omgeving, evaluatierapport met gemeten prestaties) → naar productie (live zodra de cijfers kloppen) → beheer per verwerkte eenheid.
4. Proof strip: 2–3 verified outcome numbers [placeholders until confirmed], ISO 27001/9001/14001 marks, Microsoft Solutions Partner (2 designaties), Clutch score [if available] — all clickable to evidence.
5. Track-record line (the approved "Bewezen in de praktijk" sentence) linking to /cases.
6. Azure-check teaser: "Upload je Azure-kostenexport en zie binnen twee minuten waar je budget lekt — en wat je ermee kunt bouwen." → /azure.
7. Closing CTA block: [NAME], photo, agenda link, "We reageren binnen één werkdag — ook als het antwoord is dat we je niet kunnen helpen."
**Notes:** no carousel, no logo wall (no permitted logos yet), keep total length ≤ 2 viewport-heights on desktop.

### 4.2–4.4 Capability pages — `/documentverwerking`, `/data-ontsluiting`, `/procesautomatisering`
**Purpose:** let a buyer map their backlog item to a thing FLS demonstrably builds; these are the SEO workhorses.
**Audience:** operations/IT managers with a concrete pain; also MS sellers checking depth.
**Shared template (each page):**
1. H1 = capability in plain problem terms (e.g., "Documenten die zichzelf verwerken").
2. "Wat het is" — 2–3 sentences, concrete artifacts. Documentverwerking: extractie/classificatie van facturen, orders, rapporten, formulieren; gemeten nauwkeurigheid per documenttype; menselijke controle waar nodig. Data-ontsluiting: koppelingen/pipelines die verspreide systemen bruikbaar maken voor rapportage, sturing en AI; expliciet noemen: EPD-data, FHIR/OMOP als bewezen voorbeeld. Procesautomatisering: AI-agents voor repeterende workflows (orderinvoer, documentstromen, klantprocessen); mens blijft eindverantwoordelijk.
3. "Hoe het eruitziet in jouw omgeving" — mini-architecture in words: draait in eigen Azure-tenant, integraties, logging/evaluaties, EU AI Act-conform ontwerp.
4. "Zo starten we" — the 4–6-week fixed-scope start incl. evaluatierapport; then per-unit run pricing; link to /aanbod.
5. 1–2 matching track-record cases (linked cards from /cases) with honest labels + real numbers [or placeholders].
6. FAQ (3–5 questions actually asked by buyers: nauwkeurigheid, wat als het niet werkt, data-eigendom, doorlooptijd, prijsindicatie).
7. CTA block (standard).
**Notes:** these three pages absorb the deprecated healthcare draft's substance; keep FHIR/OMOP/EPD facts, drop "specialisme" framing.

### 4.5 Aanbod & prijzen — `/aanbod`
**Purpose:** the anti-body-shop statement; show productized offers with real prices; mirror Microsoft Marketplace listings word-for-word (one-story rule).
**Audience:** budget holders; procurement doing sanity checks.
**Content blocks:**
1. Intro: how FLS prices — vaste-scope start + beheer per verwerkte eenheid + optioneel abonnement; explicitly contrast with uurtje-factuurtje.
2. Offer cards, each with: name in Microsoft title format ("Naam: X-wk Type"), scope, deliverables, duration, fixed price or price band [owner to confirm all prices], and what happens after.
   - **Azure Waste Audit: 2-wk Assessment** — fixed fee [proposed €7.5–12.5k]. Deliverables: gekwantificeerde besparingsinventaris; ondertekende baseline- & meetmethodiek; lijst van AI-use-cases financierbaar uit de besparing ("van verspilling naar AI-budget"). Afterwards, client chooses: fixed-price implementation OR gainshare **50% van geverifieerde besparingen gedurende 6 maanden** (tiered: [15–20%] op commerciële hefbomen zoals reserveringen; 50% op engineering-besparingen; genormaliseerde 90-dagen-baseline; maandelijkse verificatie; fee-cap [x]; alleen bij ≥ [€80–100k]/maand Azure-uitgaven — daaronder fixed price). From month 7: **Cost Guardrail** subscription [€x/maand].
   - **[AI-offer 2]: 4–6-wk Proof of Concept** — [document processing PoC; name TBD] — fixed [€x]; werkende oplossing in eigen tenant + evaluatierapport; daarna beheer per verwerkte eenheid [€x per document/order].
   - **[AI-offer 3]** — [TBD by owner].
   - **AI Operations** — beheerabonnement voor AI in productie: monitoring, evaluaties, kostenbeheersing, doorontwikkeling [€x/maand of % van run-volume].
3. "Wat we garanderen / wat niet" — honest boundary-setting paragraph (evaluatierapport met gemeten prestaties is altijd onderdeel; geen resultaat, dan zeggen we dat).
4. Marketplace note: same offers purchasable/visible via Microsoft Marketplace [links when live].
5. CTA.
**Notes:** if prices aren't confirmed, publish price bands rather than nothing — published pricing is a deliberate differentiator; empty "vraag offerte aan" defeats the page.

### 4.6 Azure-analyse — `/azure` (EXISTS — completion spec)
**Purpose:** the interactive existence-proof AND the lead engine for the Waste Audit.
**Audience:** anyone with an Azure bill; every meaningful upload = qualified lead.
**Required state:**
1. Above the fold: what it does in one line + "Upload je Azure-kostenexport (CSV) — analyse in ~2 minuten, gegevens verwerkt binnen de EER, [bewaartermijn/verwijderbeleid — state it]." Link to a 30-second how-to-export instruction (Cost Management → export).
2. Results view: waste indication by category (idle resources, right-sizing, orphaned disks/IP's, commitment coverage, [AI/GPU spend if detectable]) + estimated range, clearly labeled as indicatie.
3. Soft lead gate: on-screen summary is free; full PDF report via e-mail (name + business e-mail) — this is the conversion point; feed /bedankt + notification to [NAME].
4. Bridge block: "Van verspilling naar AI-budget" — one paragraph + CTA to the Azure Waste Audit offer on /aanbod.
5. Trust microcopy: EEA processing, no credentials needed (file upload only), data deletion policy, link to /privacy and /vertrouwen.
6. Sample file: "geen export bij de hand? Bekijk een voorbeeldanalyse" (demo dataset).
**Notes:** never auto-claim exact savings; ranges + methodology honesty. Bilingual UI strings.

### 4.7 Cases — `/cases`
**Purpose:** carry the sector signal the capability pages deliberately don't claim.
**Structure:** filterable cards (capability × sector). Strict format per case: uitgangssituatie → wat we bouwden → resultaat in cijfers → doorlooptijd → stack. Honest labels ("Amerikaans ziekenhuisnetwerk", "Europese retailer"); named clients only with written permission. Include one "wij op ons eigen spul" case: interne Odoo-implementatie + intern AI-deliveryplatform. Embed Clutch reviews [if available]. 4–6 cases at launch; placeholders must be filled from real material by owner — do not fabricate.

### 4.8 Vertrouwen & compliance — `/vertrouwen`
Reuse draft v0.1 nearly as-is (it was written for procurement/security readers):
certificates table (ISO 27001/9001/14001; scope = MNE/SRB/CZ delivery entities; cert numbers, validity, issuing bodies [fill]); scope-honesty paragraph; AVG block (EER-only processing, datalocaties [fill], downloadable verwerkersovereenkomst, subverwerkerslijst op aanvraag, privacycontact); EU AI Act statement (risicoclassificatie per use case, documentatie/logging, menselijke controle, hoog-risico-inrichting conform verordening); security practices summary [validate with security officer]; contract basis: NLdigital Voorwaarden [pending legal sign-off]; insurance [fill]; "Waar het werk gebeurt" — delivery geography stated plainly; security-questionnaire service promise ("ingevuld retour binnen [x] werkdagen"). Reminder: no NEN 7510 mention.

### 4.9 Over ons — `/over-ons`
Reuse draft v0.1: feiten-blok (founded 2010, HQ Cambridge MA, NL entity + KvK/BTW/address, engineers count, delivery centers, certs, MS designations with link to live Marketplace profile); the honest-history paragraph (roots in early European agile movement; delivery in Russia fully wound down in 2022; since then EU + EU-candidate countries only; "we vertellen dit liever zelf…" — keep this paragraph, owner fact-checks wording); team NL: [NAME] with real photo, bio, LinkedIn, direct booking; leadership [optional]; careers link to global system.

### 4.10 Contact — `/contact`
Reuse draft v0.1: [NAME] with photo, direct e-mail, NL phone, LinkedIn, 30-min booking link; response promise incl. the "ook als het antwoord…" line; visit address + map; procurement/security routing to /vertrouwen. Form-free by design (booking link + mailto); if a form is added anyway, max 3 fields → /bedankt.

### 4.11 Microsoft — `/microsoft` (unlisted in nav; the URL given to Microsoft sellers)
**Purpose:** 30-second diligence page for MS field sellers + Azure-committed architects; mirrors co-sell one-pager.
**Blocks:** both designations linked to the verifiable partner-directory entry; live NL Marketplace business profile link; consulting-service offer listings [links when live]; one reference architecture per flagship offer (words + simple diagram); named partner-alliance contact ([NAME]) with booking link; EN-first, NL secondary.

### 4.12 Kennis — `/kennis`
Low-frequency engineering blog: one substantive post/month by real delivery leads (eval methodology, document-pipeline architecture, honest post-mortems, Azure cost engineering). Explicitly not a content mill; quarterly beats padded monthly. Launch with 2 posts minimum so it doesn't look dead [owner to pick topics].

### 4.13 Privacy — `/privacy`
Plain-Dutch privacy statement covering: site analytics [tool TBD — prefer cookieless], /azure upload handling (purpose, EEA processing, retention/deletion, no credentials), contact data handling, rights under AVG, contact point. This URL also fills the empty Privacy URL field in the Microsoft business profile — do that after publishing.

### 4.14 Unlisted landers
- **/bedankt** — post-conversion page; confirms the one-business-day promise; suggests one next step (Azure-check or relevant capability page). Conversion-tracking target.
- **/portfolio** (EN) — for PE portfolio CTOs after an intro: fixed-price AI feature delivery per product; product-engineering heritage; engagement model per portfolio company; [NAME] as single owner. Tone: peer-to-peer, no marketing.
- **/odoo** (optional — only if the Odoo channel experiment is confirmed): two audiences on one page (mid-market "Odoo + AI-automatisering"; Dutch Odoo partners needing an engineering/AI bench); internal Odoo implementation as the demo case.

---

## 5. Measurement & SEO
- KPI = verification conversion: share of visitors from warm channels who book a meeting; secondary: /azure upload→email conversion. Per-channel tagged URLs (/microsoft, /portfolio, /odoo + UTM discipline for outreach).
- Analytics: privacy-friendly, cookieless-first [tool TBD]; no consent-wall if avoidable.
- hreflang NL/EN; canonical rules; XML sitemap; sane titles/descriptions per page (capability pages target Dutch search terms like "facturen automatisch verwerken", "AI documentverwerking", "Azure kosten besparen").
- Performance budget: fast static site; /azure is the only heavy interactive element.

## 6. Open decisions for the owner (blockers marked ●)
1. ● Final domain: nl.firstlinesoftware.com vs firstlinesoftware.nl (+ redirect).
2. ● Offer names + prices for AI-offer 2/3; confirm Waste Audit fee, gainshare tiers, floor, cap, Guardrail price.
3. ● [NAME]/title/photo/booking link; confirm engineer count.
4. Case-study source material (4–6 cases with real numbers); Clutch embed yes/no.
5. Cert numbers/validity/issuers; datalocaties; insurance; NLdigital legal sign-off; security-practices validation.
6. /azure retention policy wording + sample dataset; notification recipient.
7. Odoo lander: go/no-go.
8. Launch blog topics (2).

## 7. Deliberately excluded
Full services taxonomy; industries mega-menu; vertical "specialisme" pages (earn them later); gated whitepapers; testimonials without named, contactable sources; stock photography; chatbots; NEN 7510 mentions; any page that can't be kept current.
