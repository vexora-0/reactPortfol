import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// Portfolio 2026 — Astro config
// See docs/superpowers/specs/2026-04-10-portfolio-redesign-design.md §7
//
// applyBaseStyles: false — we own the base layer in src/styles/global.css,
// importing @tailwind base manually so our CSS custom properties land first
// and Tailwind's preflight doesn't fight our tokens.
export default defineConfig({
  site: 'https://bhargav.dev', // placeholder — domain per spec §10 #2
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
  ],
  prefetch: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
