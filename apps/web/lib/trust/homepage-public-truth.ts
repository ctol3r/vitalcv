import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';
import {
  type TrustEvidenceKind,
} from '@/lib/trust/status-language';
import {
  getPublicWedgeSurfaceBadgeMeta,
  resolvePublicWedgeSurfaceStateFromCoverage,
  type PublicWedgeSurfaceState,
} from '@/lib/trust/public-wedge-parity';

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
  tooltip: string;
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
    tooltip:
      'The National Plan and Provider Enumeration System assigns NPIs to covered healthcare providers and organizations. NPPES confirms registry identity only; licensure still needs its own source.',
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
    tooltip:
      'The OIG List of Excluded Individuals/Entities is a federal database of providers barred from Medicare/Medicaid participation. Any hit here is an immediate disqualifier for most hospital employment.',
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
    tooltip:
      'The Provider Enrollment, Chain and Ownership System tracks CMS enrollment status. Quarterly updates mean there may be a lag between your enrollment action and what PECOS reflects.',
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
    tooltip:
      'State medical board data confirms licensure status and any disciplinary actions. Coverage varies by state; VitalCV currently supports CA via FSMB and is expanding.',
    sourceState: 'accessRequired',
    evidenceKind: 'generic',
    satisfied: false,
    detailLabel: 'Institutional access',
  },
] as const satisfies readonly HomepagePublicTruthSource[];

export const HOMEPAGE_PREVIEW_COPY = {
  badge: 'Preview',
  footerLead: 'Preview layout',
  footerNote: 'not a live source run',
  panelNote: 'Preview · source-backed shares depend on a real review flow',
} as const;

export type HomepagePublicTruthSourceView = HomepagePublicTruthSource & {
  surfaceState: PublicWedgeSurfaceState;
  trustStatus: ReturnType<typeof getPublicWedgeSurfaceBadgeMeta>['status'];
  trustStatusLabel: string;
};

export function resolveHomepagePublicTruthSource(
  source: HomepagePublicTruthSource,
): HomepagePublicTruthSourceView {
  const surfaceState = resolvePublicWedgeSurfaceStateFromCoverage(source.sourceState);
  const badgeMeta = getPublicWedgeSurfaceBadgeMeta(surfaceState);

  return {
    ...source,
    surfaceState,
    trustStatus: badgeMeta.status,
    trustStatusLabel: badgeMeta.label,
  };
}
