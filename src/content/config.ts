/**
 * Content collection — work
 *
 * Every project lives here. Headliners (headliner: true) have MDX bodies
 * and appear on the home page + get a /work/[slug] case study page.
 * Indexed entries (headliner: false) have frontmatter only and are
 * rendered inline in /work/index.astro — they never get a slug page
 * and never have a repo link.
 *
 * The `placeholder: true` flag marks entries whose real description
 * is deferred (Hive, Escrow) so the index can render "— pending
 * description" without the author having to remember which rows are
 * stubs.
 *
 * Spec: docs/superpowers/specs/2026-04-10-portfolio-redesign-design.md §6
 */
import { defineCollection, z } from 'astro:content';

const work = defineCollection({
  type: 'content',
  schema: z.object({
    folio: z.string(),
    name: z.string(),
    year: z.string(),
    role: z.enum(['personal', 'work', 'freelance']),
    status: z.enum(['shipped', 'ongoing', 'paused', '—']),
    headliner: z.boolean().default(false),
    tagline: z.string(),
    synopsis: z.string(),
    stack: z.array(z.string()).default([]),
    /**
     * Repo URL. Enforced by convention: only headliners should have this
     * set. Indexed entries never get links (per the no-third-party-links
     * memory rule). The templates gate link rendering on both headliner
     * status AND the presence of repo.
     */
    repo: z.string().url().optional(),
    order: z.number(),
    /**
     * Deferred entries — Hive / Escrow. The index will show
     * "— pending description" instead of trying to render synopsis.
     */
    placeholder: z.boolean().default(false),
    /**
     * Optional metric grid for case studies. Rendered via <OutcomesGrid>
     * inside the MDX body; frontmatter here is authoritative so the
     * same numbers can be referenced programmatically if needed later.
     */
    metrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
  }),
});

export const collections = { work };
