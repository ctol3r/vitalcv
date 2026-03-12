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
import fetch from 'node-fetch';
import { matchOpportunities, scoreOpportunity } from './matchaEngine';
import type {
  ClinicianProfile,
  HeldCredential,
  HiringType,
  Opportunity as MatchaOpportunity,
  RequirementSpec,
} from './matchaModels';

const prisma = new PrismaClient();

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
        if (primary?.code) specialty = mapTaxonomy(primary.code);
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

  return { npi, name, specialty, states: [state], credentials };
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

function dbOppToMatcha(opp: {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  remote: boolean;
  status: string;
  createdAt: Date;
  organization?: { id: string; name: string } | null;
}): MatchaOpportunity {
  return {
    id: opp.id,
    title: opp.title,
    employerSlug: opp.organization?.id ?? 'unknown',
    facility: opp.organization?.name ?? 'Healthcare Organization',
    location: `${opp.state}`,
    state: opp.state,
    specialty: opp.specialty,
    hiringType: (opp.hiringType as HiringType) || 'perm',
    employerType: 'hospital',
    startUrgency: 'flexible',
    payRange: opp.payRange ?? undefined,
    remote: opp.remote ?? false,
    requirements: requirementsFromLevel(opp.requirementLevel, opp.specialty, opp.state),
    postedAt: opp.createdAt.toISOString(),
    active: opp.status === 'ACTIVE',
    tags: [opp.specialty.toLowerCase(), opp.state, opp.hiringType],
  };
}

// ── Main service functions ─────────────────────────────────────────────────────

export async function getLiveMatchesForNpi(
  npi: string,
  filters?: { specialty?: string; state?: string; hiringType?: string },
) {
  const [profile, dbOpportunities] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findMany({
      where: {
        status: 'ACTIVE',
        ...(filters?.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' } } : {}),
        ...(filters?.state ? { state: filters.state } : {}),
        ...(filters?.hiringType ? { hiringType: filters.hiringType } : {}),
      },
      include: { organization: { select: { id: true, name: true } } },
      take: 50,
    }),
  ]);

  const matchaOpps = dbOpportunities.map(dbOppToMatcha);
  const matches = matchOpportunities(profile, null, matchaOpps);

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
      fitReasons: m.explanation.fitReasons.map(f => f.reason),
    })),
    profileCompleteness: {
      level: profile.credentials.some(c => c.claimLevel === 'L1') ? 'partial' : 'full',
      missingForHigherMatches: profile.credentials
        .filter(c => c.status === 'pending' || c.claimLevel === 'L1')
        .map(c => c.key),
    },
  };
}

export async function scoreOpportunityForNpi(npi: string, opportunityId: string) {
  const [profile, dbOpp] = await Promise.all([
    buildClinicianProfile(npi),
    prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { organization: { select: { id: true, name: true } } },
    }),
  ]);

  if (!dbOpp) return null;
  const matchaOpp = dbOppToMatcha(dbOpp);
  const explanation = scoreOpportunity(profile, null, matchaOpp);

  return {
    npi,
    opportunityId,
    band: explanation.matchBand,
    score: explanation.matchScore,
    blockers: explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
    fitReasons: explanation.fitReasons.map(f => f.reason),
  };
}
