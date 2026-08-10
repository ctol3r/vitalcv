/**
 * Gate predicate for the `/dev/*` harness subtree.
 *
 * Mirrors `lib/design/preview.ts`. One question, one place: may this runtime
 * serve developer harnesses at all?
 *
 * This is a SUBTREE default, not a replacement for the per-page flags. Pages
 * under `/dev` keep their own narrower checks (`COMPETE_FILM_PREVIEW`,
 * `STORY_RAIL_PREVIEW`, `GRAPH_EXPLORER_PREVIEW`, …); this answers the coarser
 * question first, so a page that forgets to add one is still denied.
 *
 * Why that matters: `/dev/graph/[entityId]` was reported as the one `/dev` page
 * with no gate. It does have one — but it is a bare
 * `GRAPH_EXPLORER_PREVIEW === '1'`, which means a single environment variable
 * could open a developer inspector in canonical production. With this layer in
 * front, that variable can no longer do so on its own: production must ALSO opt
 * in via `DEV_PREVIEW`, which canonical production never sets.
 *
 * Deliberately NOT an unconditional production deny: several harnesses document
 * a production-mode LOCAL build as their test path (`next build && next start`
 * with a flag). Those still work — set `DEV_PREVIEW=1` alongside the page flag.
 */
export function isDevPreviewAllowed(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV !== 'production') return true;
  return env.DEV_PREVIEW === '1';
}
