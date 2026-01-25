export type RoleId = 'clinician' | 'employer' | 'issuer';

export type RoleRouteToken = {
  role: string;
  headline: string;
  subhead: string;
  purpose: string;
  purposePlaceholder: string;
  coreSignalsIntro: string;
  coreSignals: string[];
  primaryAction: string;
  primaryActionPlaceholder: string;
  ctaLabel: string;
  ctaHref: string;
};

export const ROLE_TOKENS: Record<RoleId, RoleRouteToken> = {
  clinician: {
    role: 'Clinician',
    headline: 'Clinician Credential Profile',
    subhead: 'Institutional readiness begins with a verified clinician record.',
    purpose:
      'Establish a verified profile that assembles identity, licensure, and specialty inputs for credentialing.',
    purposePlaceholder: 'Stub - no live data. Purpose narrative placeholder.',
    coreSignalsIntro: 'Signals listed here will reference verified sources and audit trails.',
    coreSignals: [
      'Stub - no live data. Identity and NPI verification state.',
      'Stub - no live data. Active license coverage signals.',
      'Stub - no live data. Specialty and facility attestations.',
    ],
    primaryAction: 'Begin a guided intake to connect issuing sources and prepare verification.',
    primaryActionPlaceholder: 'Stub - no live data. Intake workflow placeholder.',
    ctaLabel: 'Start Clinician Intake',
    ctaHref: '/start',
  },
  employer: {
    role: 'Employer',
    headline: 'Employer Verification Workspace',
    subhead: 'Review credential readiness with calm, audit-grade visibility.',
    purpose:
      'Centralize credential review for hiring, privileging, and staffing decisions with a single source of truth.',
    purposePlaceholder: 'Stub - no live data. Purpose narrative placeholder.',
    coreSignalsIntro: 'Signals will summarize credential coverage, compliance posture, and readiness.',
    coreSignals: [
      'Stub - no live data. Credential coverage and completeness.',
      'Stub - no live data. Revocation and sanction checks.',
      'Stub - no live data. Readiness posture summaries.',
    ],
    primaryAction: 'Launch a verification request to collect clinician proof packages.',
    primaryActionPlaceholder: 'Stub - no live data. Verification request flow placeholder.',
    ctaLabel: 'Open Verification Suite',
    ctaHref: '/verify',
  },
  issuer: {
    role: 'Issuer',
    headline: 'Issuer Attestation Console',
    subhead: 'Governed issuance with policy-aligned oversight.',
    purpose:
      'Manage credential policies and attestations for institutions that must verify and maintain trust.',
    purposePlaceholder: 'Stub - no live data. Purpose narrative placeholder.',
    coreSignalsIntro: 'Signals will surface policy compliance and issuance status.',
    coreSignals: [
      'Stub - no live data. Policy requirement checkpoints.',
      'Stub - no live data. Issuance queue status.',
      'Stub - no live data. Revocation readiness tracking.',
    ],
    primaryAction: 'Request access to issuer operations and onboarding.',
    primaryActionPlaceholder: 'Stub - no live data. Issuer onboarding workflow placeholder.',
    ctaLabel: 'Request Issuer Access',
    ctaHref: '/signup',
  },
};
