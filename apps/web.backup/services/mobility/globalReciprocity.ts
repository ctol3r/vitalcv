import type { ForeignCredential, GlobalLicense } from '@prisma/client';

export type ReciprocityStatus = 'ready' | 'partial' | 'research';

export interface ReciprocityPathway {
  id: string;
  origin: string;
  destination: string;
  label: string;
  status: ReciprocityStatus;
  summary: string;
  requiredSteps: string[];
  processingTimeDays: number;
  evidence: string[];
  metadata: {
    specialtyFocus: string;
    preferredCompacts: string[];
    matchedCredentialCount: number;
    matchedLicenseCount: number;
  };
}

const HIGH_MOBILITY_PATHWAYS: Array<{
  id: string;
  origin: string;
  destination: string;
  label: string;
  summary: string;
  requiredSteps: string[];
  processingTimeDays: number;
  specialtyFocus: string;
  preferredCompacts: string[];
}> = [
  {
    id: 'uk-us',
    origin: 'UNITED KINGDOM',
    destination: 'UNITED STATES',
    label: 'GMC / NMC fast-track',
    summary:
      'Applicants with UK General Medical Council (GMC) or Nursing and Midwifery Council (NMC) standing can leverage Vital CV crosswalks for expedited U.S. credentialing.',
    requiredSteps: ['Upload GMC/NMC certificate', 'Submit USMLE Step 2 or NCLEX verification', 'Attest residency portfolio'],
    processingTimeDays: 21,
    specialtyFocus: 'Hospital medicine & advanced nursing',
    preferredCompacts: ['IMLC', 'NLC'],
  },
  {
    id: 'au-us',
    origin: 'AUSTRALIA',
    destination: 'UNITED STATES',
    label: 'AHPRA to U.S. portability',
    summary:
      'Australian Health Practitioner Regulation Agency (AHPRA) registrants receive partial reciprocity with supplemental U.S. payer onboarding support.',
    requiredSteps: [
      'Provide AHPRA certificate of good standing',
      'Upload AMC exam results or equivalency letter',
      'Complete payer enrollment intent form',
    ],
    processingTimeDays: 28,
    specialtyFocus: 'Perioperative & allied health',
    preferredCompacts: ['PTC', 'AOTA'],
  },
  {
    id: 'sg-us',
    origin: 'SINGAPORE',
    destination: 'UNITED STATES',
    label: 'Singapore Medical Council bridge',
    summary:
      'Singapore-trained clinicians with digital credentials can pre-fill U.S. licensure packets and trigger disaster waiver readiness.',
    requiredSteps: [
      'Share SMC/SNB verifiable credentials',
      'Submit digital transcripts via MOHH',
      'Enable disaster waiver alerting',
    ],
    processingTimeDays: 24,
    specialtyFocus: 'Emergency & telehealth',
    preferredCompacts: ['IMLC', 'PSYPACT'],
  },
];

export interface ReciprocityInput {
  foreignCredentials: ForeignCredential[];
  globalLicenses: GlobalLicense[];
}

export function buildGlobalReciprocityMap(input: ReciprocityInput): ReciprocityPathway[] {
  const credentials = input.foreignCredentials ?? [];
  const licenses = input.globalLicenses ?? [];

  return HIGH_MOBILITY_PATHWAYS.map((pathway) => {
    const matchingCredentials = credentials.filter(
      (credential) => normalizeCountry(credential.country) === pathway.origin,
    );
    const matchingLicenses = licenses.filter(
      (license) => normalizeCountry(license.country) === pathway.origin,
    );

    const hasActiveLicense = matchingLicenses.some(
      (license) => (license.status ?? '').toLowerCase() === 'active',
    );
    const hasCredential = matchingCredentials.length > 0;

    let status: ReciprocityStatus = 'research';
    if (hasActiveLicense) {
      status = 'ready';
    } else if (hasCredential) {
      status = 'partial';
    }

    const evidence: string[] = [
      ...matchingCredentials.map((credential) => `credential:${credential.id}`),
      ...matchingLicenses.map((license) => `license:${license.licenseNumber}`),
    ];

    const summary =
      status === 'ready'
        ? `${pathway.summary} — all reciprocity prerequisites satisfied.`
        : status === 'partial'
          ? `${pathway.summary} — credential captured, awaiting U.S. verification artifacts.`
          : `${pathway.summary} — capture foreign credential evidence to enable routing.`;

    return {
      id: pathway.id,
      origin: pathway.origin,
      destination: pathway.destination,
      label: pathway.label,
      status,
      summary,
      requiredSteps: pathway.requiredSteps,
      processingTimeDays: pathway.processingTimeDays,
      evidence,
      metadata: {
        specialtyFocus: pathway.specialtyFocus,
        preferredCompacts: pathway.preferredCompacts,
        matchedCredentialCount: matchingCredentials.length,
        matchedLicenseCount: matchingLicenses.length,
      },
    };
  });
}

function normalizeCountry(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}









