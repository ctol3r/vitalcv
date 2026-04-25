import type {
  PartnerAccessLevel,
  PartnerCategory,
  RouteKey,
  VerificationClaimType,
  VerificationRoute,
} from './types';

/**
 * Deterministic claim-type → route recommendation. Returns category
 * labels (e.g., "Student Clearinghouse / DegreeVerify category"), not
 * vendor integration claims. Recommendation is not verification.
 */

interface RouteEntry {
  route: RouteKey;
  partnerCategory: PartnerCategory;
  rationale: string;
  accessLevel: PartnerAccessLevel;
}

const ROUTE_TABLE: Record<VerificationClaimType, RouteEntry> = {
  education_degree: {
    route: 'clearinghouse_or_registrar',
    partnerCategory: 'student_clearinghouse_degreeverify_category',
    rationale:
      'Education degrees are typically routed through the Student Clearinghouse / DegreeVerify category or directly to the issuing registrar.',
    accessLevel: 'available',
  },
  medical_school: {
    route: 'clearinghouse_or_registrar',
    partnerCategory: 'student_clearinghouse_degreeverify_category',
    rationale:
      'Medical school degrees use the same Student Clearinghouse / DegreeVerify category route, with the registrar as fallback.',
    accessLevel: 'available',
  },
  residency: {
    route: 'direct_program_or_gme_office',
    partnerCategory: 'manual_review_category',
    rationale:
      'Residency completion is confirmed by the program or GME office of record. There is no broad partner index for residency.',
    accessLevel: 'available',
  },
  fellowship: {
    route: 'direct_program_or_gme_office',
    partnerCategory: 'manual_review_category',
    rationale:
      'Fellowship completion is confirmed directly by the fellowship program or GME office.',
    accessLevel: 'available',
  },
  background_check: {
    route: 'certified_background_check_partner',
    partnerCategory: 'healthcare_background_screening_category',
    rationale:
      'Healthcare background screening category (Certiphi-class partners) is the standard route. Recommendation only — not an active integration.',
    accessLevel: 'access_required',
  },
  professional_license: {
    route: 'source_adapter_or_background_partner',
    partnerCategory: 'background_license_screening_category',
    rationale:
      'State board source adapters (Nursys / FSMB-class) are access_required. A background and license screening partner (Checkr-class) is an alternate category.',
    accessLevel: 'access_required',
  },
  work_history: {
    route: 'employer_direct',
    partnerCategory: 'employer_direct_category',
    rationale:
      'Work history is confirmed by the prior employer of record. No automated partner index.',
    accessLevel: 'available',
  },
  board_certification: {
    route: 'board_source_or_manual',
    partnerCategory: 'specialty_board_source_category',
    rationale:
      'Specialty board source category (ABMS / NCCPA-class) is the canonical route; manual review is the fallback.',
    accessLevel: 'access_required',
  },
  publication_research: {
    route: 'publication_index_or_manual_review',
    partnerCategory: 'publication_index_category',
    rationale:
      'Publication indices (PubMed / CrossRef-class) provide candidate matches; manual review remains required to attribute authorship.',
    accessLevel: 'available',
  },
  unknown: {
    route: 'manual_review',
    partnerCategory: 'manual_review_category',
    rationale: 'No deterministic partner route for this claim type. Defer to manual review.',
    accessLevel: 'available',
  },
};

export function recommendPartnerRoute(claimType: VerificationClaimType): VerificationRoute {
  const entry = ROUTE_TABLE[claimType] ?? ROUTE_TABLE.unknown;
  return {
    route: entry.route,
    partnerCategory: entry.partnerCategory,
    rationale: entry.rationale,
    accessLevel: entry.accessLevel,
  };
}

export const PARTNER_CATEGORY_LABEL: Record<PartnerCategory, string> = {
  student_clearinghouse_degreeverify_category:
    'Student Clearinghouse / DegreeVerify category',
  healthcare_background_screening_category:
    'Healthcare background screening category',
  background_license_screening_category:
    'Background and license screening category',
  specialty_board_source_category: 'Specialty board source category',
  state_board_source_category: 'State board source category',
  employer_direct_category: 'Employer direct',
  publication_index_category: 'Publication index category',
  manual_review_category: 'Manual review',
};
