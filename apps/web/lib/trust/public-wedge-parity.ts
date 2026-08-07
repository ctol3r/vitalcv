import type { AccordionStatus } from '@/components/ui/accordion';
import {
  getStatusDisplayLabel,
  getTrustStatusLabel,
  type TrustUiStatus,
  type VdsTrustStatus,
} from '@/lib/trust/status-language';
import type {
  CanonicalSourceCoverageState,
  CanonicalTruth,
} from '@vitalcv/trust-state';

export const PUBLIC_WEDGE_ROUTE_TARGETS = Object.freeze({
  homepageLookup: '/',
  reviewEntry: '/review',
  reviewRequestEntry: '/review/request',
  developersEntry: '/developers',
  docsEntry: '/docs',
});

export function resolvePublicWedgeDisplayName(
  displayName?: string | null,
  npi?: string | null,
): string {
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedNpi = typeof npi === 'string' ? npi.trim() : '';

  if (!normalizedDisplayName) {
    return 'Clinician Name Unavailable';
  }

  if (normalizedNpi && normalizedDisplayName.toLowerCase() === `npi ${normalizedNpi}`.toLowerCase()) {
    return 'Clinician Name Unavailable';
  }

  return normalizedDisplayName;
}

export function buildEmployerReviewHref(
  entityId: string,
  options: {
    contextId?: string | null;
    bundleId?: string | null;
    from?: string | null;
  } = {},
): string {
  const params = new URLSearchParams();

  if (typeof options.contextId === 'string' && options.contextId.trim().length > 0) {
    params.set('contextId', options.contextId.trim());
  }

  if (typeof options.bundleId === 'string' && options.bundleId.trim().length > 0) {
    params.set('bundleId', options.bundleId.trim());
  }

  if (typeof options.from === 'string' && options.from.trim().length > 0) {
    params.set('from', options.from.trim());
  }

  const query = params.toString();
  return `${PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry}/${encodeURIComponent(entityId)}${query ? `?${query}` : ''}`;
}

export const PUBLIC_WEDGE_SURFACE_STATES = [
  'checked',
  'pending',
  'stale',
  'access_required',
  'unavailable',
  'not_found',
  'review_required',
  'preview_only',
] as const;

export type PublicWedgeSurfaceState =
  (typeof PUBLIC_WEDGE_SURFACE_STATES)[number];

export type PublicWedgePreviewStageStatus =
  | 'waiting'
  | 'loading'
  | 'ok'
  | 'skipped'
  | 'failed';

type PublicWedgeBadgeMeta = Readonly<{
  status: TrustUiStatus | VdsTrustStatus;
  label: string;
}>;

const PUBLIC_WEDGE_BADGE_META: Readonly<
  Record<PublicWedgeSurfaceState, PublicWedgeBadgeMeta>
> = Object.freeze({
  checked: Object.freeze({
    status: 'checked',
    label: getTrustStatusLabel('checked'),
  }),
  pending: Object.freeze({
    status: 'pending',
    label: getTrustStatusLabel('pending'),
  }),
  stale: Object.freeze({
    status: 'stale',
    label: getTrustStatusLabel('stale'),
  }),
  access_required: Object.freeze({
    status: 'access_required',
    label: getTrustStatusLabel('access_required'),
  }),
  unavailable: Object.freeze({
    status: 'unavailable',
    label: getTrustStatusLabel('unavailable'),
  }),
  review_required: Object.freeze({
    status: 'review_required',
    label: getTrustStatusLabel('review_required'),
  }),
  not_found: Object.freeze({
    status: 'not_found',
    label: getTrustStatusLabel('not_found'),
  }),
  preview_only: Object.freeze({
    status: 'preview_only',
    label: getStatusDisplayLabel('preview_only', 'Preview'),
  }),
});

export function getPublicWedgeSurfaceBadgeMeta(
  state: PublicWedgeSurfaceState,
): PublicWedgeBadgeMeta {
  return PUBLIC_WEDGE_BADGE_META[state];
}

export function getPublicWedgeSurfaceStateLabel(
  state: PublicWedgeSurfaceState,
): string {
  return PUBLIC_WEDGE_BADGE_META[state].label;
}

export function resolvePublicWedgeSurfaceStateFromCoverage(
  state: CanonicalSourceCoverageState,
): PublicWedgeSurfaceState {
  switch (state) {
    case 'checked':
      return 'checked';
    case 'stale':
      return 'stale';
    case 'pending':
      return 'pending';
    case 'gated':
    case 'accessRequired':
      return 'access_required';
    case 'unavailable':
      return 'unavailable';
    case 'reviewRequired':
      return 'review_required';
    case 'notFound':
      return 'not_found';
    case 'notDecisionGrade':
    case 'previewOnly':
      return 'preview_only';
  }
}

export function resolvePublicWedgeSurfaceStateFromAccordionStatus(
  status: AccordionStatus | null | undefined,
): PublicWedgeSurfaceState {
  switch (status) {
    case 'verified':
    case 'clear':
    case 'checked':
      return 'checked';
    case 'stale':
      return 'stale';
    case 'preview_only':
    case 'demo':
      return 'preview_only';
    case 'access_required':
      return 'access_required';
    case 'unavailable':
      return 'unavailable';
    case 'review_required':
      return 'review_required';
    case 'pending':
    default:
      return 'pending';
  }
}

export function resolvePublicWedgeSurfaceStateFromPreviewStageStatus(
  status: PublicWedgePreviewStageStatus,
): PublicWedgeSurfaceState {
  switch (status) {
    case 'ok':
      return 'checked';
    case 'loading':
    case 'waiting':
      return 'pending';
    case 'skipped':
    case 'failed':
      return 'unavailable';
  }
}

export function resolvePublicWedgeSurfaceStateFromDisplayLabel(
  label: string | null | undefined,
): PublicWedgeSurfaceState {
  const normalized = label?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';

  switch (normalized) {
    case 'checked':
    case 'done':
    case 'source-backed':
    case 'source_backed':
    case 'verified':
    case 'clear':
    case 'enrolled':
      return 'checked';
    case 'pending':
    case 'checking':
      return 'pending';
    case 'stale':
      return 'stale';
    case 'access_required':
    case 'access':
    case 'gated':
      return 'access_required';
    case 'unavailable':
    case 'no_profile_yet':
      return 'unavailable';
    case 'review_required':
    case 'flag_found':
    case 'possible_match':
    case 'not_found':
    case 'opted_out':
    case 'excluded':
      return 'review_required';
    case 'preview':
    case 'preview_only':
      return 'preview_only';
    default:
      return 'pending';
  }
}

export function resolvePublicWedgeSurfaceStateFromTruth(
  truth: Pick<CanonicalTruth, 'status' | 'coverage'>,
): PublicWedgeSurfaceState {
  switch (truth.status) {
    case 'VERIFIED':
    case 'CLEAR':
    case 'ENROLLED':
      return 'checked';
    case 'PENDING':
    case 'UNAVAILABLE':
    case 'ACCESS_REQUIRED':
    case 'REVIEW_REQUIRED':
    case 'NOT_DECISION_GRADE':
    default:
      return resolvePublicWedgeSurfaceStateFromCoverage(truth.coverage.state);
  }
}

export function isPublicWedgeStrongOutcome(
  state: PublicWedgeSurfaceState,
): boolean {
  return state === 'checked';
}
