# Portfolio + Résumé Refresh — Design

**Date:** 2026-06-14
**Goal:** Refresh the portfolio site and résumé to land a remote **AI/ML engineer** role (≥ ₹1L or US$1000/month, any country, remote). This is a content/positioning refresh — the site's architecture and design system stay as-is.

## Positioning

Lead identity: **AI/ML engineer** specializing in reinforcement-learning environments, LLM agents, and AI safety — backed by real production systems engineering (Epicure). The strongest, most differentiated, most remote-hireable angle is the OpenEnv/RL work (mcparena, PromptGuard), which is currently underrepresented.

## Decisions locked (2026-06-14)

- Résumé facts: **BITS Pilani grad July 2027**, **Scaler CGR 7.24**.
- Email everywhere: **vexora.m04@gmail.com**; GitHub `vexora-0`.
- Remove the **Hive** and **Escrow** placeholder entries from the site entirely.
- Add to the site (beyond mcparena): **ProjectDr (CareLine)** only.
- **Drop ProjectO (Tonic) from both résumé and site** — not actually built; the existing résumé bullets overstate it ("Phases 0–5 shipped… 6 finished spots"). Can be re-added later when demo-able.
- "One of two engineers" Epicure opener: **keep as-is** (user confirmed; keeping it simple).
- Résumé PDF: edit the LaTeX source; user compiles on Overleaf and re-exports.
- Epicure bullets stay as written (user-affirmed true). See `memory/project-resume-canonical-facts`.

## Open item (low-priority, non-blocking)

- **Canonical portfolio URL.** Repo is `vexora-0/reactPortfol` on Netlify with no custom domain (still `bhargav.dev` placeholder in `astro.config.mjs`). The old `.tex` cites `vexora-m04.vercel.app`. Leave that link in the `.tex` flagged with a comment; user swaps in the real live URL in one spot. Do not block content work on it.

---

## Deliverable A — Résumé (`C:\Users\bharg\Projects\ProjectO\resume.tex`)

This `.tex` is the single master source (the site PDF is a stale, divergent older build). Changes:

1. **Header / contact:** email → `vexora.m04@gmail.com`; keep `github.com/vexora-0`; portfolio link → confirmed canonical URL.
2. **Education:** BITS Pilani July 2023 – July 2027; Scaler CGR 7.24 (already correct in `.tex`).
3. **Projects — reorder to lead AI/ML, drop Project O.** New order:
   1. **mcparena** — OpenEnv RL env vs adversarial MCP tool catalogs; Qwen2.5-1.5B + REINFORCE → 34% task-success on held-out adversarial eval (vs 0% @3B, 18% frozen); 5-rubric reward; live HF Space + public dataset. *Won Meta PyTorch × Scaler OpenEnv Hackathon Round 2.*
   2. **PromptGuard** — OpenEnv RL env for prompt-injection defense; 60 attacks / 6 categories / 3 tiers; 60/40 defense-vs-utility reward. *Meta PyTorch Hackathon Round 1.*
   3. **AudioBookAI** — keep.
   4. **ForkFinder** — keep.
4. **Skills — retune for AI/ML.** Add: PyTorch, TRL/GRPO, REINFORCE, Unsloth (LoRA/4-bit), OpenEnv, sentence-transformers, RAG, vector DBs (Pinecone). Keep the systems/infra lines (they prove production depth).
5. **Experience:** Epicure bullets unchanged (including the "One of two engineers" opener).
6. **One-page constraint:** dropping Project O frees the space for mcparena + PromptGuard. Keep AudioBookAI/ForkFinder concise.
7. Copy the rebuilt PDF to `portfolio/public/resume.pdf` after the user re-exports from Overleaf.

### Note for the user's decision

The first Epicure bullet opens "One of two engineers…". Your earlier standing guidance to me (`memory/no-credential-flexing`) was to drop that style and let the work speak. It conflicts with keeping the bullets verbatim. **Default: keep it** (per this session). Flagging so you choose deliberately.

---

## Deliverable B — Portfolio site (`C:\Users\bharg\Projects\portfolio`)

Astro + MDX. Work entries live in `src/content/work/*.mdx`; headliners (`headliner: true`) render full case-study pages, others are indexed rows. Design system, components, and layout are untouched.

1. **Add mcparena as the lead case study** — new `src/content/work/mcparena.mdx`, `headliner: true`, promoted to F/01. Full writeup with the same CaseCallout structure as existing case studies. Links: HF Space (`huggingface.co/spaces/vex-0/mcparena`), live demo (`vex-0-mcparena.hf.space/demo/`), dataset (`huggingface.co/datasets/vex-0/mcparena-runs`). Source copy drawn from the project's `Blog.MD`/README at implementation time for accuracy.
2. **Reorder featured/headliner work** so AI/ML leads: mcparena → PromptGuard → AudioBookAI → ForkFinder.
3. **Remove placeholders:** delete `hive.mdx` and `escrow.mdx`; remove them from any index ordering.
4. **Add ProjectDr (CareLine)** — new indexed `mdx`; personal project → may link (verify a public repo exists first; otherwise describe without link). Frame: post-consultation medical-AI agent with answer/escalate/clarify safety gating — an AI-safety judgment piece.
5. **Resolve the three "pending Bhargav review" copy blocks** — home lede (`index.astro`), home interlude (`index.astro`), colophon bio (`colophon.astro`). Re-draft to foreground the AI/ML identity while keeping the existing quiet, operator voice. Present drafts for approval before applying.
6. **Linking rule** (`memory/no-third-party-links`): Epicure, Froth Filter, Butter Money, Vigneshwara = described, **never linked** (employer/freelance). Personal projects (mcparena, PromptGuard, AudioBookAI, ForkFinder, ProjectDr, Ziva, ChallengeMOB) may link.
7. **`astro.config.mjs`** site URL: leave for the user to set once the canonical domain is decided (non-blocking).

## Out of scope (this session)

- Redesign / new components / theme changes.
- Buying or wiring a custom domain (can be a follow-up).
- A job-application strategy/outreach plan (deferred — scope was Portfolio + Résumé).
- Completing kinchat or any new project code.

## Verification

- `npm run build` (runs `astro check && astro build`) passes after site edits.
- No remaining `placeholder: true` entries; no "pending Bhargav review" comments left.
- Résumé `.tex` compiles cleanly on Overleaf to a single page.
- Grep the site for the old email — zero hits.
