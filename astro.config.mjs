import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// `base` covers a GitHub Pages project-page deploy (https://<user>.github.io/flsnl/);
// set SITE_BASE=/ once the custom domain (firstlinesoftware.nl) is wired up.
// `site` is the eventual domain regardless of where it's built from today — the sitemap
// integration needs an absolute origin to emit absolute <loc> URLs.
export default defineConfig({
  site: "https://firstlinesoftware.nl",
  base: process.env.SITE_BASE ?? "/",
  trailingSlash: "always",
  integrations: [sitemap()],
});
