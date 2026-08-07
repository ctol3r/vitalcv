/**
 * journeyStages — the single source of truth for the header's journey rail.
 *
 * Four stages, fixed by the 2026-08-06 founder shared-header wave:
 * Your Number → Sources → Permission → Review. The rail narrates the product
 * story in the shared chrome; it never claims progress the server has not
 * confirmed, and its copy must not imply that an NPI proves identity
 * ownership or that review means credential verification.
 *
 * The film variant's ChapterRail derives its first four chapters (ids AND
 * labels) from this module, plus a film-only `closing` epilogue — the
 * gap-analysis §8.1 follow-up, unified 2026-08-07 by founder direction.
 * `film-journey-unification.test.tsx` pins that derivation.
 */

export type JourneyStageId = 'your-number' | 'sources' | 'permission' | 'review';

export type HeaderTheme = 'light' | 'dark';

export interface JourneyStage {
  id: JourneyStageId;
  /** Rail label — exact wording is founder-fixed; tests pin it. */
  label: string;
  /** Screen-reader narration for the stage. Truth-bounded copy. */
  srDescription: string;
  /**
   * Homepage anchor. Root-relative (`/#…`) so `holder-route-contract`
   * resolves the path half; the fragment targets a section id declared by
   * CareerLoopHome. The rail is interactive only where these anchors are
   * honest — on `/` itself.
   */
  homeAnchor: `/#${string}`;
}

export const JOURNEY_STAGES: readonly JourneyStage[] = [
  {
    id: 'your-number',
    label: 'Your Number',
    srDescription: 'Begin with your NPI. It starts a profile; it does not by itself prove who holds it.',
    homeAnchor: '/#your-number',
  },
  {
    id: 'sources',
    label: 'Sources',
    srDescription: 'Where each professional fact came from, shown beside the fact.',
    homeAnchor: '/#sources',
  },
  {
    id: 'permission',
    label: 'Permission',
    srDescription: 'You choose what is shared, and with whom.',
    homeAnchor: '/#permission',
  },
  {
    id: 'review',
    label: 'Review',
    srDescription: 'Review, correct, and reuse what you hold. Employers make their own decisions.',
    homeAnchor: '/#review',
  },
] as const;

export const DEFAULT_JOURNEY_STAGE: JourneyStageId = 'your-number';

const STAGE_IDS = new Set<string>(JOURNEY_STAGES.map((s) => s.id));

export function isJourneyStageId(value: string | null | undefined): value is JourneyStageId {
  return typeof value === 'string' && STAGE_IDS.has(value);
}

export function isHeaderTheme(value: string | null | undefined): value is HeaderTheme {
  return value === 'light' || value === 'dark';
}

export function journeyStageIndex(id: JourneyStageId): number {
  return JOURNEY_STAGES.findIndex((s) => s.id === id);
}
