import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const cta = z.object({ label: z.string(), href: z.string() });

const common = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/common" }),
  schema: z.object({
    nav: z.object({ contactLabel: z.string(), contactHref: z.string() }),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/home" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    hero: z.object({
      eyebrow: z.string(),
      headlinePre: z.string(),
      headlineEm: z.string(),
      headlinePost: z.string(),
      lede: z.string(),
      ctaPrimary: cta,
    }),
    promo: z.object({
      tag: z.string(),
      heading: z.string(),
      body: z.string(),
      cta,
    }),
    footer: z.object({ text: z.string() }),
  }),
});

const azure = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/azure" }),
  schema: z.object({
    meta: z.object({ title: z.string(), description: z.string() }),
    hero: z.object({
      eyebrow: z.string(),
      headlinePre: z.string(),
      headlineEm: z.string(),
      headlinePost: z.string(),
      lede: z.string(),
      ctaPrimary: cta,
      ctaGhost: cta,
    }),
    steps: z.object({
      heading: z.string(),
      items: z.array(z.string()).length(3),
    }),
    why: z.object({
      heading: z.string(),
      items: z.array(z.object({ strong: z.string(), text: z.string() })).length(4),
      trustLine: z.string(),
    }),
    export: z.object({
      heading: z.string(),
      intro: z.string(),
      direct: z.object({
        heading: z.string(),
        steps: z.array(z.string()).length(3),
        noteMonthly: z.string(),
        multiMonth: z.string(),
        noteCSP: z.string(),
      }),
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
      analyzeLabel: z.string(),
      saveLabel: z.string(),
      noscript: z.string(),
    }),
    footer: z.object({
      text: z.string(),
      backLink: cta,
    }),
  }),
});

export const collections = { common, home, azure };
