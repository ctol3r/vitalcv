/**
 * FOUNDATION-SWEEP-6 Lane B — docs / status foundation.
 *
 * Truth invariants:
 *   1. NO uptime guarantee is implied. The typed
 *      `uptimeGuaranteeImplied: false` invariant is renderable.
 *   2. The public status page surface is FOUNDATION ONLY — it
 *      previews planned categories; it does NOT pull live operational
 *      telemetry into a public uptime claim.
 *   3. Docs are a launch-readiness foundation, NOT complete API
 *      documentation. The typed `apiDocsComplete: false` invariant
 *      enforces this.
 *   4. Incident-notice and public-changelog surfaces are PLANNED
 *      categories — every spec carries `isLive: false`.
 */

export type StatusSurfaceKind =
  | 'source_health_status'
  | 'build_status'
  | 'docs_index'
  | 'public_changelog_planned'
  | 'incident_notice_planned'
  | 'api_docs_planned';

export type StatusSurfaceStatus =
  | 'foundation_planned'
  | 'foundation_preview'
  | 'foundation_baseline_met'
  | 'unavailable';

export interface StatusSurfaceSpec {
  kind: StatusSurfaceKind;
  label: string;
  description: string;
  /** Is this surface shipped + live (in the operations sense) today? Always false. */
  isLive: boolean;
  status: StatusSurfaceStatus;
}

export interface StatusFoundationPlan {
  /** Does this foundation imply an uptime guarantee? Always false. */
  uptimeGuaranteeImplied: false;
  /** Is the production status page live? Always false. */
  productionStatusPageLive: false;
  /** Are API docs complete? Always false. */
  apiDocsComplete: false;
  surfaces: StatusSurfaceSpec[];
  /** UI disclaimers rendered verbatim on the route. */
  disclaimers: string[];
}

const NO_UPTIME_DISCLAIMER =
  'Status surfaces are foundation previews. No uptime guarantee is implied.';
const DOCS_NOT_COMPLETE_DISCLAIMER =
  'Docs are a launch-readiness foundation, not complete API documentation.';
const INCIDENT_NOT_LIVE_DISCLAIMER =
  'Incident notices and public changelogs are planned surfaces. Neither is wired today.';

const SURFACE_DEFS: Array<Omit<StatusSurfaceSpec, 'isLive' | 'status'>> = [
  {
    kind: 'source_health_status',
    label: 'Source-health status preview',
    description:
      'Foundation preview of the four source-health lanes (NPPES / OIG / PECOS / state board). Reads from the snapshot store; never asserts an uptime SLA.',
  },
  {
    kind: 'build_status',
    label: 'Build status preview',
    description:
      'Foundation preview of the most recent CI build state. Does not imply an uptime guarantee for the deployed app.',
  },
  {
    kind: 'docs_index',
    label: 'Docs index',
    description:
      'A curated index of docs/ops surfaces (build chain, completion board, public claims matrix). NOT complete API documentation.',
  },
  {
    kind: 'public_changelog_planned',
    label: 'Public changelog (planned)',
    description:
      'A planned public changelog surface. No changelog is published today.',
  },
  {
    kind: 'incident_notice_planned',
    label: 'Incident notice (planned)',
    description:
      'A planned incident-notice surface. No incident-notification path is wired today.',
  },
  {
    kind: 'api_docs_planned',
    label: 'API documentation (planned)',
    description:
      'Planned external API documentation surface. No public API docs are published today.',
  },
];

export function buildStatusFoundationPlan(): StatusFoundationPlan {
  const surfaces: StatusSurfaceSpec[] = SURFACE_DEFS.map((d) => ({
    ...d,
    isLive: false,
    status: 'foundation_planned',
  }));
  return {
    uptimeGuaranteeImplied: false,
    productionStatusPageLive: false,
    apiDocsComplete: false,
    surfaces,
    disclaimers: [NO_UPTIME_DISCLAIMER, DOCS_NOT_COMPLETE_DISCLAIMER, INCIDENT_NOT_LIVE_DISCLAIMER],
  };
}

export function explainStatusSurfaceStatus(status: StatusSurfaceStatus): string {
  switch (status) {
    case 'foundation_planned':
      return 'Surface is documented; not yet rendered or wired.';
    case 'foundation_preview':
      return 'Foundation preview is rendered. Does not assert production operational claims.';
    case 'foundation_baseline_met':
      return 'Foundation baseline shipped. Production telemetry is a separate wave.';
    case 'unavailable':
      return 'Surface is unavailable in this environment.';
  }
}
