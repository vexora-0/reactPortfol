# Bhargav.M — Portfolio

Edition 02 · 2026. *Systems that don't need watching.*

Built with [Astro](https://astro.build), written in MDX, set in
Instrument Serif / Inter / JetBrains Mono.

## Develop

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # type-check + static build → dist/
npm run preview   # serve dist/ locally
```

## Structure

```
src/
  config/         status.ts (the pulse), site.ts
  content/work/   MDX per project — headliner bodies + frontmatter-only indexed entries
  components/     shared chrome (Header, Footer, StatusIndicator, CursorTrace, etc.)
  layouts/        Base.astro
  pages/          /, /work, /work/[slug], /colophon, /thanks, /404
  styles/         global.css — tokens, fonts, view transitions
public/           resume.pdf, favicon.svg
docs/             design spec
```

## Design

Full spec at [`docs/superpowers/specs/2026-04-10-portfolio-redesign-design.md`](docs/superpowers/specs/2026-04-10-portfolio-redesign-design.md).

## Toggle availability

Flip `open` in `src/config/status.ts` and commit. The home header
dot changes state on the next build.
