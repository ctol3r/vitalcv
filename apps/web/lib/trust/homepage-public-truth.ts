import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';
import {
  getTrustStatusBadgeClassName,
  getTrustStatusLabel,
  resolveTrustUiStatus,
  type TrustEvidenceKind,
  type TrustUiStatus,
} from '@/lib/trust/status-language';

export type HomepagePublicTruthSourceId =
  | 'identity'
  | 'sanctions'
  | 'enrollment'
  | 'licensure';

export type HomepagePublicTruthSource = {
  id: HomepagePublicTruthSourceId;
  proofLabel: string;
  name: string;
  sublabel: string;
  sourceState: PassportSourceCoverageState;
  evidenceKind: TrustEvidenceKind;
  satisfied: boolean;
  detailLabel: string;
};

export const HOMEPAGE_PUBLIC_TRUTH_SOURCES = [
  {
    id: 'identity',
    proofLabel: 'Identity',
    name: 'NPPES',
    sublabel: 'NPI identity',
    sourceState: 'checked',
    evidenceKind: 'generic',
    satisfied: false,
    detailLabel: 'Registry record only',
  },
  {
    id: 'sanctions',
    proofLabel: 'Sanctions',
    name: 'OIG / LEIE',
    sublabel: 'Exclusion check',
    sourceState: 'checked',
    evidenceKind: 'generic',
    satisfied: false,
    detailLabel: 'OIG run only',
  },
  {
    id: 'enrollment',
    proofLabel: 'Enrollment',
    name: 'CMS PECOS',
    sublabel: 'Quarterly enrollment data',
    sourceState: 'notDecisionGrade',
    evidenceKind: 'generic',
    satisfied: false,
    detailLabel: 'Quarterly dataset',
  },
  {
    id: 'licensure',
    proofLabel: 'Licensure',
    name: 'CA State Board / FSMB',
    sublabel: 'CA physician lane only',
    sourceState: 'accessRequired',
    evidenceKind: 'generic',
    satisfied: false,
    detailLabel: 'Institutional access',
  },
] as const satisfies readonly HomepagePublicTruthSource[];

export const HOMEPAGE_SYNTHETIC_PREVIEW_COPY = {
  badge: 'Synthetic preview',
  footerLead: 'Synthetic layout',
  footerNote: 'not live data',
  panelNote: 'Preview only · source-backed shares depend on a real review flow',
} as const;

export type HomepagePublicTruthSourceView = HomepagePublicTruthSource & {
  trustStatus: TrustUiStatus;
  trustStatusLabel: string;
  trustStatusBadgeClassName: string;
};

export function resolveHomepagePublicTruthSource(
  source: HomepagePublicTruthSource,
): HomepagePublicTruthSourceView {
  const trustStatus = resolveTrustUiStatus({
    state: source.sourceState,
    kind: source.evidenceKind,
    satisfied: source.satisfied,
  });

  return {
    ...source,
    trustStatus,
    trustStatusLabel: getTrustStatusLabel(trustStatus),
    trustStatusBadgeClassName: getTrustStatusBadgeClassName(trustStatus),
  };
}
