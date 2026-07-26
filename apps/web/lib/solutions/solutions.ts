/**
 * Solutions Platform (Wave 700) — multiple customer segments from ONE platform.
 *
 * Each solution is an entry point for a role that routes into the EXISTING
 * surfaces and reuses the same shared infrastructure (Evidence/Trust/Timeline/
 * Mobility/Organization/Career Intelligence). Pure definitions — no duplicated
 * functionality, no new subsystems. `reuses` is the explicit, testable contract
 * that every solution sits on the shared projection layer (C6).
 */

export type SolutionRole = 'clinician' | 'recruiter' | 'organization' | 'enterprise';

export type SharedLayer =
  | 'Evidence' | 'Trust' | 'Timeline' | 'Mobility' | 'Organization' | 'Career Intelligence';

export interface Solution {
  role: SolutionRole;
  title: string;
  headline: string;
  valueProps: string[];
  /** Primary destination for an entity (the demo clinician, or a real one). */
  primaryPath: (entityId: string) => string;
  /** The shared layers this solution reuses (every solution must reuse ≥1). */
  reuses: SharedLayer[];
}

export const SOLUTIONS: readonly Solution[] = [
  {
    role: 'clinician',
    title: 'For Clinicians',
    headline: 'Your career evidence, source-backed and portable.',
    valueProps: [
      'Carry a decision-grade readiness packet across opportunities',
      'See what is checked, gated, or missing — honestly',
      'Track your career arc from training onward',
    ],
    primaryPath: (id) => `/ecosystem/${encodeURIComponent(id)}`,
    reuses: ['Evidence', 'Trust', 'Timeline', 'Mobility', 'Career Intelligence'],
  },
  {
    role: 'recruiter',
    title: 'For Recruiters',
    headline: 'Decide who is ready in under a minute — source-backed.',
    valueProps: [
      'A placement verdict with per-state readiness',
      'Evidence and trust at a glance',
      'Move forward, request evidence, or pass — honestly',
    ],
    primaryPath: (id) => `/recruiter/candidate/${encodeURIComponent(id)}`,
    reuses: ['Evidence', 'Trust', 'Mobility'],
  },
  {
    role: 'organization',
    title: 'For Organizations',
    headline: 'Your provider roster, aggregated into executive metrics.',
    valueProps: [
      'Readiness and hiring pipeline across the roster',
      'Decision-grade coverage and state reach',
      'The organizations behind every provider',
    ],
    primaryPath: (id) => `/network/${encodeURIComponent(id)}`,
    reuses: ['Organization', 'Trust', 'Evidence'],
  },
  {
    role: 'enterprise',
    title: 'For Enterprise',
    headline: 'One source-backed evidence layer across your workforce.',
    valueProps: [
      'A versioned, documented platform API + SDK',
      'Source honesty preserved end to end',
      'Pilot-ready with a live demo',
    ],
    primaryPath: () => '/demo',
    reuses: ['Evidence', 'Trust', 'Timeline', 'Mobility', 'Organization', 'Career Intelligence'],
  },
] as const;

export function solutionFor(role: SolutionRole): Solution {
  const s = SOLUTIONS.find((x) => x.role === role);
  if (!s) throw new Error(`Unknown solution role: ${role}`);
  return s;
}
