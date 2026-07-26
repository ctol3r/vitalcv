// @ts-nocheck
/**
 * liveMatchaService.ts — Wave 235
 *
 * Bridges live DB Opportunity records → MATCHA scoring engine.
 * Replaces mock data with real data while keeping the engine pure.
 *
 * Pipeline:
 *   NPI → NPPES profile → ClinicianProfile
 *   DB Opportunities (ACTIVE) → MATCHA Opportunity[]
 *   matchOpportunities() → scored, ranked results
 */

import { PrismaClient } from '@prisma/client';

import { matchOpportunities, scoreOpportunity } from './matchaEngine';
import { simulateCredentialImpact } from './matchaSimulator';
import type {
  CandidateIntent,
  ClinicianProfile,
  HeldCredential,
  HiringType,
  Opportunity as MatchaOpportunity,
  RequirementSpec,
  SpecialtySource,
} from './matchaModels';
import {
  seededOrgExclusionFilter,
} from '../opportunities/launchOpportunitySeed';

const prisma = new PrismaClient();

// seededOrgExclusionFilter (shared): when SEED_DEMO_OPPORTUNITIES is off (the
// prod default) it excludes opportunities belonging to the demo/launch seed
// organizations so live matching sees only real postings; on (dev/demo) it's a
// no-op. The same helper gates the public opportunity list/detail.

// ── NPPES taxonomy → specialty string ─────────────────────────────────────────

const TAXONOMY_MAP: Record<string, string> = {
  '207Q00000X': 'Family Medicine',
  '207R00000X': 'Internal Medicine',
  '208000000X': 'Pediatrics',
  '207X00000X': 'Orthopedic Surgery',
  '207T00000X': 'Neurological Surgery',
  '207Y00000X': 'Otolaryngology',
  '208600000X': 'Surgery',
  '207RC0000X': 'Cardiovascular Disease',
  '207RI0011X': 'Interventional Cardiology',
  '2084N0400X': 'Neurology',
  '207RH0003X': 'Hematology',
  '207RE0101X': 'Endocrinology',
  '2083P0500X': 'Preventive Medicine',
  '207RN0300X': 'Nephrology',
  '207RP1001X': 'Pulmonary Disease',
  '207RG0100X': 'Gastroenterology',
  '207RR0500X': 'Rheumatology',
  '207RO0200X': 'Oncology',
  '207RU0200X': 'Infectious Disease',
  '208D00000X': 'General Practice',
  '163W00000X': 'Registered Nurse',
  '363L00000X': 'Nurse Practitioner',
  '363A00000X': 'Physician Assistant',
  '367500000X': 'Nurse Anesthesiologist (CRNA)',
  '261QP0905X': 'Community Health',
};

function mapTaxonomy(code: string): string {
  return TAXONOMY_MAP[code] ?? 'Medicine';
}

// ── Build ClinicianProfile from NPPES data ───────────────────────────────────

async function buildClinicianProfile(npi: string): Promise<ClinicianProfile> {
  // Fetch from NPPES
  const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  let name = `Provider ${npi}`;
  let specialty = 'Medicine';
  // Only an NPPES taxonomy we actually resolve counts as a source check; the
  // generic 'Medicine' default and the NPPES-unavailable path stay 'unknown'
  // so the engine never presents an unverified specialty as checked.
  let specialtySource: SpecialtySource = 'unknown';
  let state = 'CA';

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as any;
      const result = data?.results?.[0];
      if (result) {
        const basic = result.basic ?? {};
        const givenName = basic.first_name || basic.authorized_official_first_name || '';
        const lastName = basic.last_name || basic.authorized_official_last_name || '';
        name = [givenName, lastName].filter(Boolean).join(' ') || name;

        // Primary taxonomy
        const taxonomies: any[] = result.taxonomies ?? [];
        const primary = taxonomies.find((t: any) => t.primary) ?? taxonomies[0];
        if (primary?.code) {
          specialty = mapTaxonomy(primary.code);
          // A code we recognize is a genuine NPPES source check for specialty;
          // an unmapped code falls back to 'Medicine' and stays unverified.
          if (TAXONOMY_MAP[primary.code]) specialtySource = 'nppes_taxonomy';
        }
        if (primary?.state) state = primary.state;

        // Address-based state fallback
        const addresses: any[] = result.addresses ?? [];
        const practice = addresses.find((a: any) => a.address_purpose === 'LOCATION') ?? addresses[0];
        if (practice?.state) state = practice.state;
      }
    }
  } catch {
    // NPPES unavailable — use NPI defaults
  }

  // Build credential set from what we know
  // NPI verified = npi:active:L3
  // NPPES has active provider → assume state_license at L2 (unverified but claimed)
  // Everything else = L1 (unknown — signals gaps to employer)
  const credentials: HeldCredential[] = [
    {
      key: 'npi',
      status: 'active',
      claimLevel: 'L3',
      issuer: 'CMS NPPES',
    },
    {
      key: 'state_license',
      status: 'active',
      claimLevel: 'L2',       // claimed, not PSV-confirmed without full verification
      issuer: `${state} Medical Board`,
      state,
    },
    {
      key: 'sanctions_clear',
      status: 'active',
      claimLevel: 'L2',       // NPPES active = not excluded from most registries
      issuer: 'NPI Registry',
    },
    // DEA and board cert unknown without PSV → L1 (pending)
    {
      key: 'dea',
      status: 'pending',
      claimLevel: 'L1',
      issuer: 'DEA',
    },
    {
      key: 'board_cert',
      status: 'pending',
      claimLevel: 'L1',
      issuer: 'Board Certification',
      specialty,
    },
  ];

  // ── Enrich from CandidateCredential records (Wave 238) ──────────
  // If the clinician uploaded + confirmed credentials via Document Intelligence,
  // upgrade the claim level. This is the key loop: upload → parse → verify → better matches.
  try {
    const candidateCreds = await prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      orderBy: { createdAt: 'desc' },
    });

    for (const cc of candidateCreds) {
      const data = cc.data as Record<string, unknown> | null;
      if (!data) continue;
      const docType = (data.documentType as string) ?? '';
      const confidence = (data.overallConfidence as number) ?? 0;
      const ccStatus = cc.status; // UNVERIFIED, PENDING_VERIFICATION, VERIFIED

      // Map document type to credential key
      const typeToKey: Record<string, string> = {
        MEDICAL_LICENSE: 'state_license',
        DEA_CERTIFICATE: 'dea',
        BOARD_CERTIFICATION: 'board_cert',
      };

      const credKey = typeToKey[docType];
      if (!credKey) continue;

      // Determine claim level based on verification status + confidence
      let upgradedLevel: string;
      if (ccStatus === 'VERIFIED' || (ccStatus === 'PENDING_VERIFICATION' && confidence > 0.9)) {
        upgradedLevel = 'L3'; // Document verified or high-confidence confirmed
      } else if (ccStatus === 'PENDING_VERIFICATION') {
        upgradedLevel = 'L2'; // Confirmed by clinician, pending PSV
      } else {
        upgradedLevel = 'L2'; // Uploaded but unconfirmed — still better than L1
      }

      // Find and upgrade the credential entry
      const idx = credentials.findIndex(c => c.key === credKey);
      if (idx >= 0) {
        const existing = credentials[idx];
        // Only upgrade, never downgrade
        const levelOrder = ['L1', 'L2', 'L3'];
        if (levelOrder.indexOf(upgradedLevel) > levelOrder.indexOf(existing.claimLevel)) {
          credentials[idx] = {
            ...existing,
            status: 'active',
            claimLevel: upgradedLevel as 'L1' | 'L2' | 'L3',
          };
        }
      }
    }
  } catch (err) {
    // CandidateCredential enrichment is best-effort — don't fail the whole profile
  }

  return { npi, name, specialty, specialtySource, states: [state], credentials };
}

// ── Map DB Opportunity → MATCHA Opportunity ───────────────────────────────────

function requirementsFromLevel(
  level: string,
  specialty: string,
  state: string,
): RequirementSpec[] {
  const base: RequirementSpec[] = [
    { key: 'npi', label: 'NPI Verified', level: 'L1', priority: 'required' },
    { key: 'sanctions_clear', label: 'Sanctions Clear', level: 'L2', priority: 'required' },
    { key: 'state_license', label: `${state} Medical License`, level: 'L2', priority: 'required', state },
  ];

  if (level === 'L2' || level === 'L3') {
    base.push({ key: 'dea', label: 'DEA Registration', level: 'L2', priority: 'required' });
    base.push({ key: 'malpractice', label: 'Malpractice Insurance', level: 'L2', priority: 'preferred' });
  }

  if (level === 'L3') {
    base.push({
      key: 'board_cert',
      label: `${specialty} Board Certification`,
      level: 'L3',
      priority: 'required',
      specialty,
    });
  }

  return base;
}

// Employer-posted enums → engine enums, with a safe fallback for older postings
// (or free-text) that predate the structured columns.
const EMPLOYER_TYPES = new Set(['hospital', 'practice', 'telehealth', 'agency', 'health_system']);
function normalizeEmployerType(v: string | null | undefined): MatchaOpportunity['employerType'] {
  return v && EMPLOYER_TYPES.has(v) ? (v as MatchaOpportunity['employerType']) : 'hospital';
}
const START_URGENCIES = new Set(['immediate', 'within_2_weeks', 'within_month', 'flexible']);
function normalizeStartUrgency(v: string | null | undefined): MatchaOpportunity['startUrgency'] {
  return v && START_URGENCIES.has(v) ? (v as MatchaOpportunity['startUrgency']) : 'flexible';
}

function dbOppToMatcha(opp: {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  payMin?: number | null;
  payMax?: number | null;
  employerType?: string | null;
  startUrgency?: string | null;
  requirementLevel: string;
  remote: boolean;
  status: string;
  createdAt: Date;
  organization?: { id: string; name: string } | null;
}): MatchaOpportunity {
  return {
    id: opp.id,
    title: opp.title,
    organization: opp.organization?.name ?? 'Healthcare Organization',
    organizationId: opp.organization?.id,
    employerSlug: opp.organization?.id ?? 'unknown',
    facility: opp.organization?.name ?? 'Healthcare Organization',
    location: `${opp.state}`,
    state: opp.state,
    specialty: opp.specialty,
    hiringType: (opp.hiringType as HiringType) || 'perm',
    // Employer-posted structured fields drive real scoring (comp/urgency/
    // employer-fit); fall back to the old defaults when a posting omits them.
    employerType: normalizeEmployerType(opp.employerType),
    startUrgency: normalizeStartUrgency(opp.startUrgency),
    urgency: 'within_90_days',
    payRange: opp.payRange ?? undefined,
    payMin: opp.payMin ?? undefined,
    payMax: opp.payMax ?? undefined,
    remote: opp.remote ?? false,
    requirements: requirementsFromLevel(opp.requirementLevel, opp.specialty, opp.state),
    minimumTrustBand: opp.requirementLevel === 'L3'
      ? 'L3'
      : opp.requirementLevel === 'L2'
        ? 'L2'
        : 'L1',
    credentialRequirements: requirementsFromLevel(opp.requirementLevel, opp.specialty, opp.state)
      .map((requirement) => requirement.label),
    postedAt: opp.createdAt.toISOString(),
    active: opp.status === 'ACTIVE',
    tags: [opp.specialty.toLowerCase(), opp.state, opp.hiringType],
  };
}

// ── Main service functions ─────────────────────────────────────────────────────

export async function getLiveMatchesForNpi(
  npi: string,
  filters?: { specialty?: string; state?: string; hiringType?: string },
  // The clinician's stated preferences, mapped to the engine's CandidateIntent
  // by the web proxy (which holds the durable, Clerk-scoped preference store).
  // When present, ~50 of the 100 scoring points respond to what the clinician
  // WANTS (location, hiring type, pay, remote, timing) on top of what they're
  // credentialed FOR. When absent, ranking falls back to credentials only.
  intent?: CandidateIntent | null,
) {
  const [profile, dbOpportunities] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findMany({
      where: {
        status: 'ACTIVE',
        ...seededOrgExclusionFilter(),
        ...(filters?.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' } } : {}),
        ...(filters?.state ? { state: filters.state } : {}),
        ...(filters?.hiringType ? { hiringType: filters.hiringType } : {}),
      },
      include: { organization: { select: { id: true, name: true } } },
      take: 50,
    }),
  ]);

  const matchaOpps = dbOpportunities.map(dbOppToMatcha);
  const matches = matchOpportunities(profile, intent ?? null, matchaOpps);

  return {
    npi,
    clinicianName: profile.name,
    specialty: profile.specialty,
    state: profile.states[0],
    matches: matches.map(m => ({
      opportunityId: m.opportunity.id,
      band: m.explanation.matchBand,
      score: m.explanation.matchScore,
      blockers: m.explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
      fitReasons: m.explanation.fitReasons.map(f => f.label),
      // Full objects for the clinician surfaces (cards + detail view). The slim
      // fields above are kept for existing consumers — additive only.
      opportunity: m.opportunity,
      explanation: m.explanation,
    })),
    profileCompleteness: {
      level: profile.credentials.some(c => c.claimLevel === 'L1') ? 'partial' : 'full',
      missingForHigherMatches: profile.credentials
        .filter(c => c.status === 'pending' || c.claimLevel === 'L1')
        .map(c => c.key),
    },
  };
}

/**
 * Deterministic "what if" simulation for a clinician's real live roles.
 * Loads the same real ClinicianProfile + active Opportunity set as the live
 * match, then re-scores with each blocking credential hypothetically earned.
 * Never mutates evidence; every number is the engine's own recomputed output.
 */
export async function simulateForNpi(npi: string) {
  const [profile, dbOpportunities] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findMany({
      where: { status: 'ACTIVE', ...seededOrgExclusionFilter() },
      include: { organization: { select: { id: true, name: true } } },
      take: 50,
    }),
  ]);

  const matchaOpps = dbOpportunities.map(dbOppToMatcha);
  const result = simulateCredentialImpact(profile, matchaOpps, new Date().toISOString());

  return {
    npi,
    clinicianName: profile.name,
    specialty: profile.specialty,
    ...result,
  };
}

export async function scoreOpportunityForNpi(
  npi: string,
  opportunityId: string,
  intent?: CandidateIntent | null,
) {
  const [profile, dbOpp] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { organization: { select: { id: true, name: true } } },
    }),
  ]);

  if (!dbOpp) return null;
  const matchaOpp = dbOppToMatcha(dbOpp);
  const explanation = scoreOpportunity(profile, intent ?? null, matchaOpp);

  return {
    npi,
    opportunityId,
    band: explanation.matchBand,
    score: explanation.matchScore,
    blockers: explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
    fitReasons: explanation.fitReasons.map(f => f.label),
  };
}
