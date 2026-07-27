import { defineConfig } from "astro/config";

// `base` covers a GitHub Pages project-page deploy (https://<user>.github.io/flsnl/);
// set SITE_BASE=/ once the custom domain (firstlinesoftware.nl) is wired up.
export default defineConfig({
  base: process.env.SITE_BASE ?? "/",
  trailingSlash: "always",
});
