/**
 * privilege-fixtures.ts — Preview fixtures for the Procedure & Privilege
 * Activation mega wave.
 *
 * These fixtures are explicitly labeled as *design fixtures* and only render
 * until the backend produces real procedure / payer / supervisor data. The
 * VitalCV Truth Doctrine forbids surfacing fabricated evidence as verified,
 * so every fixture row is accompanied by a preview marker on the hosting
 * surface.
 *
 * Derivation Rules
 * ----------------
 *   - Privileges are selected from a narrow, specialty-keyed lookup
 *   - Payer lanes are stable for all specialties (they model payer-side
 *     process, not clinician content)
 *   - Supervising physician is rendered only for mid-level provider
 *     specialties (PA / NP), which are the roles where the panel is
 *     operationally meaningful
 *
 * When real backend data arrives, callers should stop calling
 * `buildPreviewClinicalWave()` and pass their server-produced payloads to
 * the host components directly.
 */

import type { PassportData } from '@/lib/trust/passport-contract';
import type {
  ClinicalPrivilegeRequest,
  PayerEnrollmentLane,
  SupervisingPhysicianLink,
  VelocityCountdown,
} from './privilege-types';

export interface PreviewClinicalWave {
  privileges: ClinicalPrivilegeRequest[];
  payers: PayerEnrollmentLane[];
  supervisor: SupervisingPhysicianLink | null;
  velocity: VelocityCountdown;
  /** Always true; signals hosting surfaces to render a preview-marker. */
  isPreview: true;
}

const MIDLEVEL_SPECIALTY_HINT = /(physician assistant|nurse practitioner|\bNP\b|\bPA\b|APRN|CRNA|certified registered)/i;

const SPECIALTY_PRIVILEGE_LOOKUP: Array<{
  match: RegExp;
  privileges: ClinicalPrivilegeRequest[];
}> = [
  {
    match: /(surgery|surgical|orthopaed|orthoped|cardiothoracic)/i,
    privileges: [
      {
        id: 'first_assist_surgery',
        label: 'First Assist in Surgery',
        context: 'Operating suite · adult',
        requiredProof: 'Case logs: 25 in last 24 months, attested by surgeon of record',
        matchedEvidence: '28 cases · logs attached · attestations ×3',
        status: 'met',
        caseCount: 28,
        caseCountRequired: 25,
        window: '24 mo',
        note: 'Self-reported logs cross-checked against hospital OR schedule feed.',
      },
      {
        id: 'central_line_placement',
        label: 'Central Venous Catheter Insertion',
        context: 'Inpatient · ICU',
        requiredProof: 'Case logs: 10 in last 24 months',
        matchedEvidence: '6 cases on file',
        status: 'partial',
        caseCount: 6,
        caseCountRequired: 10,
        window: '24 mo',
        note: 'Below institution threshold — peer reference will bridge.',
      },
      {
        id: 'moderate_sedation',
        label: 'Moderate Sedation',
        context: 'Procedural',
        requiredProof: 'Certification + 15 supervised cases',
        matchedEvidence: 'Not on file',
        status: 'missing',
        caseCount: 0,
        caseCountRequired: 15,
        window: '12 mo',
      },
    ],
  },
  {
    match: /(anesth)/i,
    privileges: [
      {
        id: 'moderate_sedation',
        label: 'Moderate Sedation',
        context: 'Procedural · adult',
        requiredProof: 'Certification current + 50 cases in last 12 months',
        matchedEvidence: '67 cases · certification current',
        status: 'met',
        caseCount: 67,
        caseCountRequired: 50,
        window: '12 mo',
      },
      {
        id: 'regional_anesthesia',
        label: 'Regional Anesthesia · Peripheral Nerve Block',
        context: 'Orthopaedic adjunct',
        requiredProof: 'Case logs: 20 in last 24 months',
        matchedEvidence: '14 cases · peer attestation pending',
        status: 'peer_requested',
        caseCount: 14,
        caseCountRequired: 20,
        window: '24 mo',
      },
      {
        id: 'neuraxial_obstetric',
        label: 'Neuraxial Anesthesia · Obstetric',
        context: 'Obstetric anesthesia',
        requiredProof: 'Case logs: 30 in last 24 months',
        matchedEvidence: 'Not on file',
        status: 'missing',
        caseCount: 0,
        caseCountRequired: 30,
        window: '24 mo',
      },
    ],
  },
  {
    match: /(emergency|urgent|acute care)/i,
    privileges: [
      {
        id: 'moderate_sedation',
        label: 'Moderate Sedation',
        context: 'ED · adult & pediatric',
        requiredProof: 'Certification current + 25 cases in last 12 months',
        matchedEvidence: '31 cases · certification current',
        status: 'met',
        caseCount: 31,
        caseCountRequired: 25,
        window: '12 mo',
      },
      {
        id: 'central_line_placement',
        label: 'Central Venous Catheter Insertion',
        context: 'ED resuscitation',
        requiredProof: 'Case logs: 10 in last 24 months',
        matchedEvidence: '9 cases on file',
        status: 'partial',
        caseCount: 9,
        caseCountRequired: 10,
        window: '24 mo',
      },
      {
        id: 'rsi_intubation',
        label: 'Rapid Sequence Intubation',
        context: 'ED · adult',
        requiredProof: 'Case logs: 12 in last 12 months',
        matchedEvidence: '15 cases · logs attached',
        status: 'met',
        caseCount: 15,
        caseCountRequired: 12,
        window: '12 mo',
      },
    ],
  },
];

const DEFAULT_PRIVILEGES: ClinicalPrivilegeRequest[] = [
  {
    id: 'moderate_sedation',
    label: 'Moderate Sedation',
    context: 'Procedural',
    requiredProof: 'Certification current + 15 cases in last 12 months',
    matchedEvidence: '22 cases · certification current',
    status: 'met',
    caseCount: 22,
    caseCountRequired: 15,
    window: '12 mo',
  },
  {
    id: 'central_line_placement',
    label: 'Central Venous Catheter Insertion',
    context: 'Inpatient',
    requiredProof: 'Case logs: 10 in last 24 months',
    matchedEvidence: '7 cases on file',
    status: 'partial',
    caseCount: 7,
    caseCountRequired: 10,
    window: '24 mo',
  },
  {
    id: 'first_assist_surgery',
    label: 'First Assist in Surgery',
    context: 'Operating suite',
    requiredProof: 'Case logs: 25 in last 24 months',
    matchedEvidence: 'Not on file',
    status: 'missing',
    caseCount: 0,
    caseCountRequired: 25,
    window: '24 mo',
  },
];

function selectPrivileges(specialty?: string): ClinicalPrivilegeRequest[] {
  if (!specialty) return DEFAULT_PRIVILEGES;
  for (const entry of SPECIALTY_PRIVILEGE_LOOKUP) {
    if (entry.match.test(specialty)) return entry.privileges;
  }
  return DEFAULT_PRIVILEGES;
}

function buildPayerLanes(passport: PassportData): PayerEnrollmentLane[] {
  const pecosEnrolled = passport.standing.pecosEnrollmentStatus === 'ENROLLED';
  const pecosObserved = passport.standing.enrollmentObservedAt ?? null;

  return [
    {
      id: 'medicare_pecos',
      label: 'Medicare (PECOS)',
      category: 'government',
      status: pecosEnrolled ? 'verified' : 'unchecked',
      note: pecosEnrolled
        ? passport.standing.enrollmentFreshnessLabel ?? 'Quarterly · confirmed'
        : 'PECOS lookup pending',
      observedAt: pecosObserved,
    },
    {
      id: 'bcbs',
      label: 'Blue Cross Blue Shield',
      category: 'commercial',
      status: 'processing',
      note: 'Submitted · 11 days ago',
      observedAt: null,
    },
    {
      id: 'aetna',
      label: 'Aetna',
      category: 'commercial',
      status: 'awaiting_npi',
      note: 'Waiting on group NPI link',
      observedAt: null,
    },
    {
      id: 'united',
      label: 'UnitedHealthcare',
      category: 'commercial',
      status: 'awaiting_caqh',
      note: 'CAQH re-attestation required',
      observedAt: null,
    },
    {
      id: 'cigna',
      label: 'Cigna',
      category: 'commercial',
      status: 'processing',
      note: 'Submitted · 4 days ago',
      observedAt: null,
    },
    {
      id: 'humana',
      label: 'Humana',
      category: 'commercial',
      status: 'action_required',
      note: 'Payer returned a roster mismatch',
      observedAt: null,
    },
  ];
}

function buildSupervisor(passport: PassportData): SupervisingPhysicianLink | null {
  const specialty = passport.identity.specialty ?? '';
  if (!MIDLEVEL_SPECIALTY_HINT.test(specialty)) return null;

  return {
    displayName: 'DR. ROBERT CHEN',
    npi: '1987654321',
    relationship: /nurse|APRN|NP/i.test(specialty) ? 'collaborator' : 'supervisor',
    specialty: 'Internal Medicine · Hospitalist',
    state: 'CA',
    agreementStatus: 'active',
    loggedAt: passport.lastCheckedAt,
  };
}

function buildVelocity(passport: PassportData): VelocityCountdown {
  const blocked = passport.readiness.status === 'BLOCKED';
  return {
    credentialingClearance: blocked ? null : '3-5 Days',
    revenueActivation: blocked ? null : '18-24 Days',
    baseline: '90-120 Days',
    timeSaved: blocked ? null : '~75 Days',
    disclosure:
      'Credentialing clearance reflects VitalCV-accelerated privileging + PECOS. Revenue activation reflects commercial payer enrollment timelines, which remain the trailing constraint.',
  };
}

/**
 * Build the preview clinical wave bundle for a passport. This is a design
 * fixture — consumers MUST render a "Preview · design fixture" marker
 * alongside any surface that uses this output.
 */
export function buildPreviewClinicalWave(passport: PassportData): PreviewClinicalWave {
  return {
    privileges: selectPrivileges(passport.identity.specialty),
    payers: buildPayerLanes(passport),
    supervisor: buildSupervisor(passport),
    velocity: buildVelocity(passport),
    isPreview: true,
  };
}
