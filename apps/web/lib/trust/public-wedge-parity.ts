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
} from '../../../../packages/trust-state';

export const PUBLIC_WEDGE_ROUTE_TARGETS = Object.freeze({
  homepageLookup: '/',
  passportEntry: '/passport',
  reviewEntry: '/review',
});

export function buildPassportLookupHref(
  npi?: string | null,
): string {
  return typeof npi === 'string' && /^\d{10}$/.test(npi.trim())
    ? `${PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}?npi=${encodeURIComponent(npi.trim())}`
    : PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry;
}

export function buildPassportEntityHref(
  entityId: string,
): string {
  return `${PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}/${encodeURIComponent(entityId)}`;
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
  'review_required',
  'preview_only',
] as const;

export type PublicWedgeSurfaceState =
  (typeof PUBLIC_WEDGE_SURFACE_STATES)[number];

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
    status: 'access required',
    label: getTrustStatusLabel('access_required'),
  }),
  unavailable: Object.freeze({
    status: 'unavailable',
    label: getTrustStatusLabel('unavailable'),
  }),
  review_required: Object.freeze({
    status: 'review required',
    label: getTrustStatusLabel('review_required'),
  }),
  preview_only: Object.freeze({
    status: 'demo',
    label: getStatusDisplayLabel('demo', 'Preview only'),
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
    case 'ACCESS REQUIRED':
    case 'REVIEW REQUIRED':
    case 'NOT DECISION-GRADE':
    default:
      return resolvePublicWedgeSurfaceStateFromCoverage(truth.coverage.state);
  }
}

export function isPublicWedgeStrongOutcome(
  state: PublicWedgeSurfaceState,
): boolean {
  return state === 'checked';
}
