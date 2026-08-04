import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const cta = z.object({ label: z.string(), href: z.string() });

const hero = z.object({
  eyebrow: z.string(),
  headlinePre: z.string(),
  headlineEm: z.string(),
  headlinePost: z.string(),
  lede: z.string(),
  ctaPrimary: cta,
});

// The closing CTA block (spec §2: "every page ends with a single clear CTA — usually: book a
// call with [NAME], photo included"). One shape, reused by every page that has one, so the
// promise/booking-link/photo treatment can't say something different from page to page.
const ctaBlock = z.object({
  heading: z.string(),
  name: z.string(),
  role: z.string(),
  bookingHref: z.string(),
  bookingLabel: z.string(),
  responsePromise: z.string(),
  photoSrc: z.string().optional(),
});

const faqItem = z.object({ question: z.string(), answer: z.string() });

const common = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/common" }),
  schema: z.object({
    nav: z.object({
      contactLabel: z.string(),
      contactHref: z.string(),
      home: z.string(),
      offers: z.string(),
      cases: z.string(),
      trust: z.string(),
      about: z.string(),
      contactPage: z.string(),
      kennis: z.string(),
      privacy: z.string(),
      menuLabel: z.string(),
      langSwitchLabel: z.string(),
    }),
    // Footer facts block — spec §2. Legal identity fields are placeholders (bracketed) until
    // the owner confirms them; the KvK number is the one already-known real fact.
    facts: z.object({
      legalName: z.string(),
      kvk: z.string(),
      btw: z.string(),
      address: z.string(),
      phone: z.string(),
      privacyLabel: z.string(),
      isoLabel: z.string(),
      isoHref: z.string(),
      microsoftPartnerLabel: z.string(),
      microsoftPartnerHref: z.string(),
      anthropicPartnerLabel: z.string(),
      anthropicPartnerHref: z.string(),
    }),
    a11y: z.object({ newTab: z.string() }),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/home" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    hero: hero.extend({ ctaSecondary: cta }),
    howWeWork: z.object({
      heading: z.string(),
      steps: z.array(z.object({ heading: z.string(), body: z.string() })).length(3),
    }),
    proof: z.object({
      // imageSrc/imageAlt are for the two partner badges (Microsoft, Anthropic) — when present,
      // the badge artwork replaces the plain-text value, since the logo is the verification.
      metrics: z.array(
        z.object({
          value: z.string(),
          label: z.string(),
          href: z.string().optional(),
          imageSrc: z.string().optional(),
          imageAlt: z.string().optional(),
        })
      ),
    }),
    trackRecord: z.object({ text: z.string(), linkLabel: z.string() }),
    azureTeaser: z.object({ heading: z.string(), body: z.string(), linkLabel: z.string() }),
    cta: ctaBlock,
    footer: z.object({ text: z.string() }),
  }),
});

const azure = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/azure" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    hero,
    // Above-the-fold link to the export how-to (spec §4.6 block 1) — not a third hero button,
    // just a small link near the upload prompt. Href is always the #export anchor already on
    // this page, so only the label lives in content.
    heroExportLinkLabel: z.string(),
    expect: z.object({
      heading: z.string(),
      intro: z.string(),
      items: z.array(z.string()).length(5),
    }),
    files: z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()).length(3),
      verifyNote: z.string(),
    }),
    free: z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()).length(3),
    }),
    connectivity: z.object({
      online: z.string(),
      offline: z.string(),
    }),
    export: z.object({
      heading: z.string(),
      intro: z.string(),
      steps: z.array(z.string()).length(3),
      multiMonth: z.string(),
      noteRole: z.string(),
    }),
    app: z.object({
      heading: z.string(),
      intro: z.string(),
      dropzone: z.object({
        title: z.string(),
        suffix: z.string(),
        hint: z.string(),
        ariaLabel: z.string(),
      }),
      sampleLabel: z.string(),
      analyzeLabel: z.string(),
      loadError: z.string(),
      noscript: z.string(),
    }),
    // Spec §4.6 block 5: EEA processing / no-credentials / deletion-policy microcopy, linking
    // out to /privacy and /vertrouwen. Honest given this tool has no server at all — see the
    // body copy itself, not invented boilerplate.
    trust: z.object({ body: z.string(), privacyLabel: z.string(), vertrouwenLabel: z.string() }),
    // Spec §4.6 block 4: the bridge to the paid Azure Waste Audit offer on /aanbod.
    bridge: z.object({ heading: z.string(), body: z.string(), linkLabel: z.string() }),
    footer: z.object({
      text: z.string(),
      backLink: cta,
    }),
  }),
});

// Spec §4.5. Card prices are real bands where the spec authorizes one (Waste Audit); the rest
// are bracketed placeholders per §6's open decisions — a band beats an empty "ask for a quote."
const offers = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/offers" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.object({ heading: z.string(), body: z.string() }),
    cards: z.array(
      z.object({
        name: z.string(),
        scope: z.string(),
        deliverables: z.array(z.string()),
        duration: z.string(),
        price: z.string(),
        afterNote: z.string(),
        // Only the free-scan step needs a way in — it's the one card whose whole point is
        // "go do this now," not "get in touch."
        ctaHref: z.string().optional(),
        ctaLabel: z.string().optional(),
      })
    ),
    guarantee: z.object({ heading: z.string(), body: z.string() }),
    marketplace: z.object({ heading: z.string(), body: z.string() }),
    cta: ctaBlock,
  }),
});

// Spec §4.7. No v0.1 case-study drafts exist in this repo, and the spec's hard constraint is
// "no invented metrics, clients, testimonials — only verified numbers; if unknown, leave
// [placeholder]." Situations/what-we-built stay grounded in the already-approved track-record
// fragments (§1); every number is bracketed until the owner supplies it.
const caseCardSchema = z.object({
  title: z.string(),
  sectorLabel: z.string(),
  capabilityLabel: z.string(),
  capability: z.string(),
  sector: z.string(),
  situationLabel: z.string(),
  situation: z.string(),
  whatWeBuiltLabel: z.string(),
  whatWeBuilt: z.string(),
  resultLabel: z.string(),
  result: z.string(),
  duration: z.string(),
  stack: z.string(),
});
const cases = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/cases" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    items: z.array(caseCardSchema),
    cta: ctaBlock,
  }),
});

// Spec §4.8. Written for procurement/security readers. Hard constraint: never mention NEN 7510.
const trust = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/trust" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    certificates: z.object({
      heading: z.string(),
      scopeNote: z.string(),
      tableHeaders: z.object({
        name: z.string(),
        scope: z.string(),
        number: z.string(),
        validity: z.string(),
        issuer: z.string(),
      }),
      items: z.array(
        z.object({ name: z.string(), scope: z.string(), number: z.string(), validity: z.string(), issuer: z.string() })
      ),
    }),
    avg: z.object({
      heading: z.string(),
      paragraphs: z.array(z.string()),
      dpaLinkLabel: z.string(),
      subprocessorsNote: z.string(),
      privacyContact: z.string(),
    }),
    aiAct: z.object({ heading: z.string(), paragraphs: z.array(z.string()) }),
    security: z.object({ heading: z.string(), body: z.string() }),
    contractBasis: z.object({ heading: z.string(), body: z.string() }),
    insurance: z.object({ heading: z.string(), body: z.string() }),
    whereWeWork: z.object({ heading: z.string(), body: z.string() }),
    questionnaire: z.object({ heading: z.string(), body: z.string() }),
    cta: ctaBlock,
  }),
});

// Spec §4.9.
const about = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/about" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    facts: z.object({
      heading: z.string(),
      items: z.array(z.object({ label: z.string(), value: z.string() })),
    }),
    history: z.object({ heading: z.string(), paragraphs: z.array(z.string()) }),
    // Two NL contacts, not one: general/phone-capable and technical-depth. Order in the array
    // is display order, not seniority.
    team: z.object({
      heading: z.string(),
      members: z
        .array(
          z.object({
            name: z.string(),
            role: z.string(),
            bio: z.string(),
            linkedinLabel: z.string(),
            linkedinHref: z.string(),
            bookingLabel: z.string(),
            bookingHref: z.string(),
            certImageSrc: z.string().optional(),
            certImageAlt: z.string().optional(),
            photoSrc: z.string().optional(),
          })
        )
        .length(2),
    }),
    cta: ctaBlock,
  }),
});

// Spec §4.10. Form-free by design — booking link + mailto, not a contact form. Two contacts:
// phone rings through to the one who can actually take a Dutch-language call; the other is
// reachable by email/LinkedIn/booking for the technical conversations that follow.
const contact = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/contact" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    contacts: z
      .array(
        z.object({
          name: z.string(),
          role: z.string(),
          email: z.string(),
          phone: z.string().optional(),
          linkedinLabel: z.string(),
          linkedinHref: z.string(),
          bookingHref: z.string(),
          bookingLabel: z.string(),
          photoSrc: z.string().optional(),
        })
      )
      .length(2),
    responsePromise: z.string(),
    address: z.object({ heading: z.string(), lines: z.array(z.string()) }),
    procurement: z.object({ body: z.string(), linkLabel: z.string() }),
  }),
});

// Spec §4.11 — unlisted, single URL, EN-first (no NL variant, per ROUTES.microsoft).
const microsoft = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/microsoft" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    designations: z.object({
      heading: z.string(),
      items: z.array(z.object({ name: z.string(), href: z.string() })),
    }),
    marketplace: z.object({ heading: z.string(), body: z.string(), linkLabel: z.string(), href: z.string() }),
    offers: z.object({ heading: z.string(), body: z.string(), linkLabel: z.string() }),
    architecture: z.object({ heading: z.string(), body: z.string() }),
    contact: z.object({
      heading: z.string(),
      name: z.string(),
      role: z.string(),
      bookingLabel: z.string(),
      bookingHref: z.string(),
    }),
  }),
});

// Spec §4.12. Real posts need real topics ("owner to pick topics" — §6.8, an open blocker), so
// launch content is two clearly-marked stub entries, not invented engineering war stories.
const kennis = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/kennis" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    posts: z.array(z.object({ title: z.string(), dateLabel: z.string(), excerpt: z.string() })),
  }),
});

// Spec §4.13. Mostly restates facts already true of the site today (no analytics anywhere,
// /azure's zero-transmission design) rather than placeholders.
const privacy = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/privacy" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })),
    contact: z.string(),
  }),
});

// Spec §4.14 unlisted landers.
const thanks = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/thanks" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    body: z.string(),
    nextStep: z.object({ body: z.string(), linkLabel: z.string() }),
  }),
});

// EN-only (PE portfolio CTOs after an intro). Peer-to-peer tone, no marketing — spec §4.14.
const portfolio = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/portfolio" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    sections: z.array(z.object({ heading: z.string(), body: z.string() })),
    cta: ctaBlock,
  }),
});

// NL-first, conditional on the go/no-go decision in spec §6.7 — built per the full-skeleton
// decision, but flag this route's status to the owner before launch.
const odoo = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/odoo" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    heading: z.string(),
    intro: z.string(),
    audiences: z.array(z.object({ heading: z.string(), body: z.string() })),
    demoCase: z.object({ heading: z.string(), body: z.string() }),
    cta: ctaBlock,
  }),
});

export const collections = {
  common,
  home,
  azure,
  offers,
  cases,
  trust,
  about,
  contact,
  microsoft,
  kennis,
  privacy,
  thanks,
  portfolio,
  odoo,
};
