/**
 * The four-chapter career journey (deep-audit W2.1) — ONE shared data model
 * for the homepage's product story, consumed by the horizontal rail's
 * JourneyCard leaves on desktop and by the identical vertical fallback.
 *
 * Copy descends from the approved StickyProductStory steps (truth-contract
 * reviewed): the five steps collapse to the audit's four public journey
 * chapters, with Recognize + Prepare merged into "See what is ready."
 *
 * Truth rails preserved verbatim: every row names its source and state;
 * licensure stays access-gated; Recognition is an employer decision with the
 * institution boundary explicit; nothing claims completed credentialing.
 */

import type { StoryIconName } from '@/components/home/StoryIcon';

export type JourneyRowState = 'source' | 'checked' | 'gated' | 'attention' | 'neutral';

export interface JourneyRow {
  label: string;
  detail: string;
  state: JourneyRowState;
}

export interface JourneyChapter {
  /** DOM section id — the deep-link anchor and chapter-driver id. */
  id: string;
  /** The journey step name (audit: the only public journey that matters). */
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  /** The chapter's direct action — a real route, never a dead end. */
  action: string;
  href: string;
  icon: StoryIconName;
  rows: readonly JourneyRow[];
}

export const JOURNEY_CHAPTERS: readonly JourneyChapter[] = [
  {
    id: 'readiness',
    label: 'See what is ready',
    eyebrow: '01 · Identity & readiness',
    title: 'Start with one NPI. See what is ready.',
    body: 'One NPI resolves your identity and starts the source checks. Every item names its source, its state, and the next action.',
    action: 'Check what’s ready',
    href: '#npi',
    icon: 'readiness',
    rows: [
      { label: 'Identity', detail: 'NPPES · Source-backed', state: 'source' },
      { label: 'Exclusions', detail: 'OIG / LEIE · Checked', state: 'checked' },
      { label: 'Licensure', detail: 'Access required', state: 'gated' },
      { label: 'Enrollment', detail: 'PECOS · Needs review', state: 'attention' },
    ],
  },
  {
    id: 'matcha',
    label: 'Find roles that fit',
    eyebrow: '02 · Matching',
    title: 'Match evidence to the right opportunity.',
    body: 'Matching connects evidence to role requirements — reasoning visible, gaps named.',
    action: 'See why it matched',
    href: '/onboarding',
    icon: 'match',
    rows: [
      { label: 'Specialty', detail: 'Meets requirement', state: 'source' },
      { label: 'State license', detail: 'Access required', state: 'gated' },
      { label: 'Location', detail: 'Within preference', state: 'neutral' },
    ],
  },
  {
    id: 'apply',
    label: 'Apply with proof',
    eyebrow: '03 · Proof packet',
    title: 'Apply without starting over.',
    body: 'Share one attributed packet. Keep the consent receipt.',
    action: 'Share proof packet',
    href: '/onboarding',
    icon: 'apply',
    rows: [
      { label: 'Identity', detail: 'Source-backed', state: 'source' },
      { label: 'Exclusions', detail: 'Checked', state: 'checked' },
      { label: 'Licensure', detail: 'Gated · shown as gated', state: 'gated' },
      { label: 'Consent', detail: 'Receipt recorded', state: 'neutral' },
    ],
  },
  {
    id: 'start',
    label: 'Start from evidence',
    eyebrow: '04 · Recognition',
    title: 'Carry the employer decision forward.',
    body: 'VitalCV Recognition records the acceptance. Institution review remains.',
    action: 'Start from accepted evidence',
    href: '#employers',
    icon: 'recognition',
    rows: [
      { label: 'Recognition', detail: 'Employer accepted', state: 'source' },
      { label: 'Decision capsule', detail: 'Audit event written', state: 'checked' },
      { label: 'Credentialing', detail: 'Institution review remains', state: 'neutral' },
    ],
  },
] as const;

export const JOURNEY_CHAPTER_IDS = JOURNEY_CHAPTERS.map((c) => c.id);
