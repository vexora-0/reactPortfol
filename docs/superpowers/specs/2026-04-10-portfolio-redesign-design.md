# Portfolio 2026 — Design Spec

**Subject:** Bhargav Munigonda
**Date:** 2026-04-10
**Edition:** 02 — replaces the React + Vite + Lottie portfolio currently in this repo
**Status:** Design locked, awaiting implementation plan

---

## 1. Concept

> **Systems that don't need watching.**

A portfolio about distributed systems, autonomous machines, and the discipline of building things that run on their own. The site itself is composed the same way — quiet, deliberate, and alive only where it matters.

The concept is not a tagline. It is a constraint on every decision in this document. When in doubt during implementation, the question is: *does this element earn its presence, or is it watching itself?*

### Voice principles

These are non-negotiable. They override aesthetic preferences when in conflict.

- **No credential flexing.** Never write phrases like "one of two engineers," "uniquely positioned," "the only person who…". The work demonstrates rigor; copy doesn't sell it.
- **Quiet confidence.** Prefer technical precision over dramatic framing. "Coordinates multiple kiosks sharing a physical machine with lease-based distributed locking" beats "solved an incredibly hard race condition."
- **Show, don't tell.** Three short paragraphs of accurate technical decisions beat one paragraph of self-description.
- **Restraint as luxury.** Every element earns its place. Whitespace is content.

## 2. Audience

In priority order:

1. **Statement piece (E-dominant)** — this site needs to feel like *him*. The right viewers will get it. Closer to an artist's site than a recruiter's PDF.
2. **Founders / freelance prospects (C-secondary)** — credible enough that a non-engineer founder browsing for a builder doesn't bounce. The "indexed work" section serves this audience.

Explicitly **not optimizing** for FAANG recruiter screens or design-studio hiring; those are happy side-effects, not targets.

**AI/ML work must stand shoulder-to-shoulder with distributed systems work** — both are foregrounded equally. Headliners are 100% AI-flavored projects (PromptGuard, AudioBookAI, ForkFinder); distributed systems shows up via Epicure in the indexed work and via the technical depth of the case studies.

## 3. Aesthetic system

### Palette ("Midnight Edition")

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0A0C` | Page background |
| `--bg-2` | `#111114` | Surfaces, callout blocks |
| `--ink` | `#E8E2D6` | Primary text (warm bone, not white) |
| `--ink-mid` | `rgba(232,226,214,0.65)` | Secondary text, lede |
| `--ink-low` | `rgba(232,226,214,0.4)` | Captions, mono labels |
| `--rule` | `rgba(232,226,214,0.14)` | Hairline rules, borders |
| `--accent` | `#FF4A1F` | Single accent — used sparingly: pulse dot, italic emphasis word, link hover, callout corners |

The accent color is **rare on purpose**. If a page has more than ~5 instances of `--accent`, something is wrong.

### Typography

| Role | Family | Source | Notes |
|---|---|---|---|
| Display headlines | **Instrument Serif** (italic and roman) | Google Fonts | The voice. Used at 80–140px on hero; 56–84px on case study titles. Italic reserved for emphasis — usually a single word in accent color. |
| Body / UI | **Inter** (300, 400, 500) | Google Fonts | Lede paragraphs, navigation, body copy. Set tight (`letter-spacing: -0.011em`). |
| Mono / labels | **JetBrains Mono** (400, 500) | Google Fonts | Mono labels, code, metric values, timestamps, status indicators. Always uppercase with `letter-spacing: 0.12–0.16em` when used as a label. |

All three fonts are free via Google Fonts. No paid licensing required for v1.

### Motion budget — "quiet with pulse"

A blend of "ambient everywhere" + "signature moments where they prove something." The site is quietly alive across the board, plus 2–3 high-leverage moments that justify themselves.

**Ambient (everywhere):**
- Hairline scroll reveals on type and section blocks (≤ 600ms, easeOutExpo)
- Hover breath on interactive elements (subtle scale + opacity)
- Custom cursor with a quiet trace (a small dot that follows + a label that names what's under it: `→ read`, `↗ external`, etc.)
- View Transitions API for cross-page navigation (the magazine "page turn" feeling)
- No JS animation libraries; CSS + minimal JS only

**Signature moments (named, intentional):**
1. **The hero pulse** — a single live status indicator on the home header that uses the accent color. It IS the open-to-work signal (see §3.5). The dot pulses gently (~2.4s loop) when "open"; it dims to ink and stops pulsing when "closed."
2. **Index transition** — clicking a headliner from `/work` triggers a typographic transition (project name slides + scales into the case study title position via View Transitions API). One signature moment that announces a route change as a meaningful event.
3. **Inline schematic on case studies (optional)** — each case study may have one small SVG diagram that earns its place. Static or hover-revealing only. Not animated for animation's sake.

**Banned for v1:** WebGL, audio (any kind), parallax, generative backgrounds, hero video, scroll-jacking, any third-party motion library beyond what View Transitions and CSS provide.

### 3.5 Live status indicator (the pulse)

The corner dot in the home header is not decoration. It is the **single source of truth** for Bhargav's availability:

| State | Visual | Label |
|---|---|---|
| Open | Accent (#FF4A1F) dot, pulsing 2.4s | `open · IST` |
| Closed | Ink-low dot, static | `closed · IST` |

State is hard-coded as a single boolean in a config file (e.g., `src/config/status.ts`) so toggling it is one commit. The label includes the timezone abbreviation so visitors know when "open" actually means open. The same indicator (smaller) appears in `/colophon` inside the About section, alongside the timezone label.

This is the only "real-time" element on the site, and it tells the visitor something useful. It earns its presence.

### Photography

**No photo of Bhargav anywhere on v1.** No portrait, no avatar, no headshot. The aesthetic, the concept, and the no-flexing principle all align: a face would dilute the cold-precision tone and read closer to "personal blog." If a future v2 wants a quiet author photo, the natural home is a small treatment in `/colophon`, not on the home page.

## 4. Information architecture

```
/                       — home: manifesto + 3 featured works
/work                   — index: every project (3 headliners + 7 indexed)
/work/promptguard       — case study (~700 words)
/work/audiobookai       — case study (~700 words)
/work/forkfinder        — case study (~700 words)
/colophon               — about · contact form · résumé · email · github
/notes                  — DEFERRED to v2
```

**Five rooms, four real, one deferred.** No `/blog`, no `/about` (folded into /colophon), no `/projects` (it's `/work`).

URLs use kebab-case slugs for case studies. Case study slugs match the project name lowercased: `/work/promptguard`, `/work/audiobookai`, `/work/forkfinder`.

Header navigation is always: `Bhargav.M` (logo, links to `/`) · `Work` · `Colophon`. Three items. Mono, small, ink-low color. Plus the live status indicator on the right.

## 5. Page anatomies

### 5.1 `/` — Home

Linear top-to-bottom scroll. No grids, no carousels. Each section is a deliberate composition.

1. **Header** *(sticky thin, ~56px tall)* — Bhargav.M wordmark left, `Work · Colophon` nav right, live status indicator far right.
2. **Hero** — Three-line Instrument Serif italic at clamp(60px, 9vw, 132px): *"Systems / that don't / need watching."* The word `watching.` is the only accent-colored element.
3. **Lede** — One paragraph in Inter, max-width 540px, `--ink-mid` color, ≤45 words. Says what he does without saying who he is.
4. **Featured works × 3** — Each is a full-bleed scroll section, not a card grid. Each entry contains:
   - Folio number in mono: `F/01`, `F/02`, `F/03`
   - Project name in Instrument Serif italic at ~64px
   - One-line synopsis in Inter
   - Year + role in mono
   - Quiet `→ read` affordance in mono accent
5. **Interlude** — A single italic serif sentence (~20–30 words) of philosophy. Heavy whitespace. Example placeholder: *"the work I'm proud of is the work that didn't need me last week"* (real copy TBD with Bhargav).
6. **Index excerpt** — One mono line: `→ 7 more in /work`, linking to the index.
7. **Footer** — `vexora.m04@gmail.com` rendered as the largest element on the footer in Instrument Serif italic. Below it: github link + colophon link in mono. No social grid.

### 5.2 `/work` — Index

A single dense list, table-like, in mono and serif. Each project is a row:

```
INDEX  ·  NAME            YEAR    ROLE          STATUS    [★ if headliner]
F/01      PromptGuard     2026    personal      shipped   ★
F/02      AudioBookAI     2025    personal      shipped   ★
F/03      ForkFinder      2025    personal      shipped   ★
07        Epicure         2024–   work          ongoing
08        Hive            ...     personal      —
09        Escrow          ...     personal      —
10        Froth Filter    2025    freelance     —
11        Butter Money    2025    freelance     —
12        Ziva            2024    personal      paused
13        ChallengeMOB    2024    personal      paused
```

Hover on any row reveals a one-line synopsis underneath in `--ink-mid`. Headliner rows (★) are clickable and navigate to the case study. Indexed-work rows expand inline on click to reveal a 2–3 sentence description; they do not link out (per the no-third-party-links rule).

The `★` symbol is rendered in `--accent`.

### 5.3 `/work/[slug]` — Case study (~700 words, "B-light")

Same header. Then:

1. **Title block** — Folio in mono (`F/01`), year, project name in Instrument Serif italic at clamp(48px, 7vw, 84px), a one-line tagline below in `--ink-mid`.
2. **Meta strip** — Mono row: `role · stack · status · repo →`. The repo link is the only outbound link from the page body.
3. **Synopsis** — 2 short paragraphs, ~120 words total.
4. **Context** — 1 paragraph (`why this exists`), ~80 words.
5. **3–4 decision callouts** — Each is an `<aside>` styled block with a mono label like `decision · embeddings`, a single-sentence claim, and 2–3 sentences of rationale. The spine of the case study. Total ~300 words across all callouts.
6. **Inline schematic** *(optional, one per case study)* — A single static SVG. PromptGuard: attack-category cube. AudioBookAI: 7-stage pipeline diagram. ForkFinder: re-ranker formula. If a project doesn't earn a diagram, it doesn't get one.
7. **Outcomes grid** — Small grid of metrics. Mono labels, Instrument Serif italic numbers in `--accent`. ~60 words of context.
8. **Footer** — `← all work` and `↗ repo`. No "next project" autoplay (it's editorial, not Netflix).

Total target: ~700 words across all sections. All three headliners stay at this depth — no upgrades, no deeper PromptGuard. Empty templates rot; consistency is more confident than depth competition.

Case studies are authored in **MDX** so prose and components co-exist naturally.

### 5.4 `/colophon`

Single long page in three vertical sections, separated by hairline rules.

1. **About** — 2–3 paragraphs of first-person prose. No flexing, no photo. A quiet declaration of what he builds and why he builds it that way. Includes a small live status indicator (smaller version of the hero pulse) and the timezone label `IST · UTC+5:30`.
2. **Contact** —
   - Left: minimal Netlify form (name / email / message / submit). Three fields, mono labels, ink-on-bg.
   - Right: `vexora.m04@gmail.com` rendered in Instrument Serif italic at ~48px with a small `copy` button in mono. Below: github link in mono.
3. **Colophon proper** — The actual colophon, in serif: typefaces credited, framework credited, year, edition. *"Set in Instrument Serif and JetBrains Mono. Built with Astro. Hosted on [Netlify or Vercel — TBD]. Edition 02 — 2026."*

The résumé download lives at the bottom of the About section, surfaced as a single quiet line: `→ résumé.pdf · 2026`.

## 6. Content map

### Headliners (case studies + repo links)

| Project | Year | Source | Notes |
|---|---|---|---|
| PromptGuard | 2026 | Meta PyTorch Hackathon 2026 | OpenEnv-compatible RL env for prompt-injection defense. 60 categorized attacks across 6 categories. Composite scoring (60% defense + 40% utility). Source: `C:\Users\bharg\Projects\hf-promptguard` (also `meta_round_1` is the same project). |
| AudioBookAI | 2025 | Personal | Two-phase fiction-to-cinematic-audiobook pipeline. Multi-voice via ElevenLabs Text-to-Dialogue API, 7-stage async processing, 768-dim embeddings. Source: `C:\Users\bharg\Projects\audiobookai`. |
| ForkFinder | 2025 | Personal | Semantic GitHub repo recommender. BAAI/bge-base-en-v1.5 embeddings in Pinecone, multi-signal re-ranking. Source: `C:\Users\bharg\Projects\forkfinder`. Repo: github.com/vexora-0/forkfinder |

### Indexed work (described, no outbound links)

| Project | Year | Bucket |
|---|---|---|
| Epicure Robotics | 2024–present | Work — production autonomous beverage robotics platform (Zoe, SmoothieBar, LQI). Distributed locking, MQTT/EMQX, multi-tenant API, edge kiosk apps in Kotlin + Flutter Linux, supply chain. |
| Hive | — | Personal — to be described from `C:\Users\bharg\Projects\hive` |
| Escrow | — | Personal — to be described from `C:\Users\bharg\Projects\escrow` |
| Froth Filter | 2025 | Freelance — coffee equipment e-commerce + IoT for 75+ smart dispensers. TS, Next.js, Razorpay, AWS Lambda. |
| Butter Money | 2025 | Freelance — landing page + WhatsApp chatbot. |
| Ziva | 2024 | Personal — AI-native email app for founders. Paused. |
| ChallengeMOB | 2024 | Personal — creator challenge platform. Tested with 1k users. Paused. |

**Strict rule:** indexed work entries get descriptions, role, year, and tech stack. They never get a clickable demo or repo link, because some are scraped, paused, or not Bhargav's to publicly link. Headliners are the only entries with case studies and external links.

### Résumé

Single PDF, the current one: `resume5.pdf` (will be renamed to `resume.pdf` and copied to `public/resume.pdf` during implementation). The older `Resume_Bhargav (3).pdf` is not surfaced — its content (freelance work and the older Ziva/ChallengeMOB projects) is captured in the indexed work above.

## 7. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Astro** | Zero-JS by default. Ships only what specific elements need. The framework itself agrees with the concept. |
| Content | **MDX** via `@astrojs/mdx` and Astro content collections | First-class long-form authoring with embedded components. Case studies and indexed work both live as content collections. |
| Interactive islands | **Vanilla JS first**, with `@astrojs/react` available if a component grows non-trivial | Most "interactive" pieces are simpler than they sound: the pulse is a pure CSS animation, the contact form is a static Netlify HTML form, scroll reveals can be CSS scroll-driven animations or a tiny IntersectionObserver. The only things that genuinely need JS are the cursor trace and the email copy-to-clipboard button — both small enough for vanilla JS in a single Astro `<script>` tag. React is added only if a future component (e.g., an inline schematic with state) needs it. |
| Language | **TypeScript** | Strict mode, end-to-end typed including content collections via Astro's `defineCollection`. |
| Styling | **Tailwind CSS** via `@astrojs/tailwind` with a custom theme that maps to the design tokens in §3 | Tokens centralized in `tailwind.config.mjs`; component-scoped styles where Tailwind would be noisy. |
| Fonts | **Google Fonts** with `astro-font` or local self-hosted via `@fontsource` | Self-host preferred for performance and no third-party request. |
| Forms | **Netlify Forms** *(or Web3Forms as a fallback if hosting on Vercel)* | Zero-backend contact form. The existing repo has a Netlify form scaffold to migrate. |
| Page transitions | **Astro View Transitions API** | Native, no library. |
| Hosting | **TBD — Netlify or Vercel** *(see §10)* | Both are fine; decision deferred to implementation plan. |
| Image optimization | Astro's built-in `<Image />` | For any inline schematics or future imagery. |

**Explicit non-dependencies:**
- No Framer Motion, GSAP, Three.js, R3F, Lottie, or any motion/3D library.
- No analytics in v1 (can add Plausible later if desired — privacy-respecting, no cookies).
- No CMS. Content lives in MDX in the repo.
- No state management library; no `zustand`, `jotai`, etc. There is no global state.

## 8. The teardown

The current portfolio in `src/` (React + Vite + react-spring parallax + Lottie + FontAwesome) is **fully replaced**. None of its components, CSS, or assets carry over. The current homepage references projects that are no longer representative (Basic Calculator, Movie Review Site, etc.) and a tech stack identity (HTML/CSS/JS animations) that no longer reflects who Bhargav is.

The current `package.json` is rewritten for Astro. The current asset images in `src/assets/` are deleted (none are used by the new design). The two PDFs at the repo root are moved into `public/`: `resume5.pdf` → `public/resume.pdf`; the older PDF is removed (its content is preserved in the work index).

The existing `index.html`'s netlify form scaffold pattern is preserved as a reference for the new Netlify form on `/colophon`.

The existing Git history is preserved — this is a major rewrite, not a fresh repo.

## 9. Constraints & non-goals

**Hard constraints:**
- No links to third-party / employer / freelance work.
- No credential flexing in copy.
- No photo of Bhargav v1.
- No `/notes` v1.
- No paid fonts; Google Fonts only for v1.
- No analytics, no tracking, no cookies, no consent banners (because there's nothing to consent to).
- No JS shipped to pages that don't need it.

**Non-goals:**
- A blog/CMS workflow.
- A theme switcher (it's dark editorial — that's the point).
- A "currently listening to" / Spotify integration.
- A Twitter/X feed embed.
- A localized/multi-language version.
- Showcasing every project ever shipped — restraint matters; ~10 total projects is the cap.

## 10. Open questions & deferred decisions

These do not block the implementation plan; they are noted for later resolution.

1. **Hosting** — Netlify or Vercel? Forms work easiest on Netlify; everything else is a wash. **Recommendation:** Netlify for v1, mostly because the existing repo already references Netlify Forms.
2. **Domain name** — Not chosen yet. Candidates: `bhargav.dev`, `bhargavm.com`, `vexora.dev`, `bhargavm.in`. To be picked before deployment.
3. **Real copy for the philosophy interlude on home (§5.1 step 5)** — Currently a placeholder. Bhargav writes one line he stands behind.
4. **Real synopses for the seven indexed-work entries** — Currently sketched from resume content. Bhargav reviews/rewrites each one in his voice.
5. **Hive and Escrow project descriptions** — To be drafted from the source folders during content authoring.
6. **Should `/colophon` include an "open to work" toggle in the same one-liner as the home pulse, or a fuller "what I'm looking for" paragraph?** Defer to content phase.
7. **Inline schematics for case studies** — All three may have one. Final call per project once the case study draft is in MDX.

---

## Definition of done

The redesign is "done" when:

- All four real pages render in production with locked palette, type, and motion budget.
- Three case studies are written, reviewed, and published in MDX at ~700 words each.
- Seven indexed-work entries are described and rendered with no outbound links.
- The live status indicator can be toggled `open ↔ closed` via a single config edit.
- The contact form delivers email to `vexora.m04@gmail.com`.
- The résumé PDF downloads from `/colophon`.
- The site loads in under 1 second on a fast 3G connection on `/`, ships less than 30KB of JS on `/`, and passes accessibility (WCAG AA) for color contrast and keyboard navigation.
- The old React + Vite portfolio is fully removed from the repo.
- The git history is preserved.
