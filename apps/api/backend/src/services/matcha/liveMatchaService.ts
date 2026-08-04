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

import type { Prisma } from '@prisma/client';

// The SHARED client, not a private `new PrismaClient()`. The shared instance
// carries the `$use` middleware that invalidates graph snapshots, the
// geospatial cache and the trust-state cache on every write, and records query
// samples for the perf watchers. A private client speaks to the same database
// but skips all of that silently, so reads here would go on serving state the
// rest of the process has already invalidated.
import prisma from '../../graphql/prisma_client';
import { matchOpportunities, scoreOpportunity } from './matchaEngine';
import { simulateCredentialImpact } from './matchaSimulator';
import type {
  CandidateIntent,
  ClaimLevel,
  ClinicianProfile,
  CredentialKey,
  HeldCredential,
  HiringType,
  Opportunity as MatchaOpportunity,
  RequirementSpec,
  SpecialtySource,
} from './matchaModels';
import {
  seededOrgExclusionFilter,
} from '../opportunities/launchOpportunitySeed';

// seededOrgExclusionFilter (shared): when SEED_DEMO_OPPORTUNITIES is off (the
// prod default) it excludes opportunities belonging to the demo/launch seed
// organizations so live matching sees only real postings; on (dev/demo) it's a
// no-op. The same helper gates the public opportunity list/detail.

// ── Authoritative store for this path ─────────────────────────────────────────
//
// Every opportunity returned by this module is read from the Postgres
// `Opportunity` table via `prisma.opportunity`. That table is the ONLY
// authoritative store on this path.
//
// This module must never read `./opportunityRegistry`. That registry is a
// process-local in-memory array: it is not shared between instances, it resets
// on every deploy, and nothing in it can be applied to. It legitimately backs
// the registry route (`GET /api/matcha/opportunities`, no NPI) and must keep
// doing so — but the live match path behind
// `GET /api/matcha/opportunities/:npi` is the real career loop, and a role that
// vanishes on restart cannot be part of it. There is deliberately no import of
// it below, and no catch-block here substitutes registry data for a failed
// query: a DB failure propagates so the route answers 500 rather than quietly
// serving ephemeral rows as if they were real postings.
//
// The `durable` stamp on every returned opportunity (see ProvenancedOpportunity)
// is the runtime half of that guarantee.

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

// ── NPPES response shape ──────────────────────────────────────────────────────
//
// NPPES is an external API: its JSON is untrusted input, so every field is
// `unknown` and is narrowed before use. The previous `as any` on the parsed
// body meant this whole block typechecked vacuously — a renamed NPPES field
// would have produced `undefined` at runtime with no compile-time signal.

interface NppesBasic {
  first_name?: unknown;
  last_name?: unknown;
  authorized_official_first_name?: unknown;
  authorized_official_last_name?: unknown;
}

interface NppesTaxonomy {
  code?: unknown;
  primary?: unknown;
  state?: unknown;
}

interface NppesAddress {
  address_purpose?: unknown;
  state?: unknown;
}

interface NppesResult {
  basic?: NppesBasic;
  taxonomies?: NppesTaxonomy[];
  addresses?: NppesAddress[];
}

interface NppesResponse {
  results?: NppesResult[];
}

/** Non-empty string or ''. Keeps the original `a || b || ''` fallback chains. */
function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Narrows a Prisma `Json` column to a plain object. `JsonValue` is legally a
 * string, number, boolean, null or array too, so casting it straight to
 * `Record<string, unknown>` (as this file used to) makes `data.documentType`
 * a runtime crash away on any row whose `data` is not an object.
 */
function readJsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Ascending claim strength. Index order is the comparison. */
const CLAIM_LEVEL_ORDER: readonly ClaimLevel[] = ['L0', 'L1', 'L2', 'L3'];

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
      const data = await res.json() as NppesResponse;
      const result = readArray(data?.results)[0];
      if (result) {
        const basic: NppesBasic = result.basic ?? {};
        const givenName = readString(basic.first_name)
          || readString(basic.authorized_official_first_name);
        const lastName = readString(basic.last_name)
          || readString(basic.authorized_official_last_name);
        name = [givenName, lastName].filter(Boolean).join(' ') || name;

        // Primary taxonomy
        const taxonomies = readArray(result.taxonomies);
        const primary = taxonomies.find((t) => Boolean(t.primary)) ?? taxonomies[0];
        const primaryCode = readString(primary?.code);
        if (primaryCode) {
          specialty = mapTaxonomy(primaryCode);
          // A code we recognize is a genuine NPPES source check for specialty;
          // an unmapped code falls back to 'Medicine' and stays unverified.
          if (TAXONOMY_MAP[primaryCode]) specialtySource = 'nppes_taxonomy';
        }
        const primaryState = readString(primary?.state);
        if (primaryState) state = primaryState;

        // Address-based state fallback
        const addresses = readArray(result.addresses);
        const practice = addresses.find((a) => a.address_purpose === 'LOCATION') ?? addresses[0];
        const practiceState = readString(practice?.state);
        if (practiceState) state = practiceState;
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

    // Map document type to credential key
    const typeToKey: Record<string, CredentialKey> = {
      MEDICAL_LICENSE: 'state_license',
      DEA_CERTIFICATE: 'dea',
      BOARD_CERTIFICATION: 'board_cert',
    };

    for (const cc of candidateCreds) {
      const data = readJsonRecord(cc.data);
      if (!data) continue;
      const docType = readString(data.documentType);
      const confidence = readNumber(data.overallConfidence);
      const ccStatus = cc.status; // UNVERIFIED, PENDING_VERIFICATION, VERIFIED

      const credKey = typeToKey[docType];
      if (!credKey) continue;

      // Determine claim level based on verification status + confidence
      let upgradedLevel: ClaimLevel;
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
        if (
          CLAIM_LEVEL_ORDER.indexOf(upgradedLevel)
          > CLAIM_LEVEL_ORDER.indexOf(existing.claimLevel)
        ) {
          credentials[idx] = {
            ...existing,
            status: 'active',
            claimLevel: upgradedLevel,
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

/**
 * The exact row shape this module reads: an `Opportunity` row plus the minimal
 * organization projection requested by every query below.
 *
 * Derived from the generated Prisma types instead of hand-written, so a schema
 * change that renames, drops or retypes a column fails the build here rather
 * than silently yielding `undefined` at runtime. (The previous hand-written
 * structural type could drift from the schema indefinitely without complaint.)
 */
type DbOpportunityWithOrg = Prisma.OpportunityGetPayload<{
  include: { organization: { select: { id: true; name: true } } };
}>;

/**
 * A MATCHA opportunity that carries its own provenance.
 *
 * `durable`  — true iff this row was read from the Postgres `Opportunity`
 *              table on this request. A caller may only present a
 *              `durable: true` role as a real, applyable posting. Anything
 *              else is process-local and will not survive a restart, so it
 *              must not be shown as something a clinician can act on.
 * `status`   — the row's own lifecycle column, copied verbatim ('ACTIVE',
 *              'CLOSED', …). The pre-existing `active` boolean stays exactly
 *              as it was (`status === 'ACTIVE'`); `status` is additive and
 *              lets a caller distinguish *why* something is inactive.
 *
 * Both fields are additive — no existing field changes name, type or meaning.
 */
export type ProvenancedOpportunity = MatchaOpportunity & {
  durable: boolean;
  status: string;
};

/** A ProvenancedOpportunity known to be DB-backed. */
export type DurableOpportunity = ProvenancedOpportunity & { durable: true };

function dbOppToMatcha(opp: DbOpportunityWithOrg): DurableOpportunity {
  return {
    // Read from the `Opportunity` table in this request — durable by
    // construction. This is the only place the stamp is set to true.
    durable: true,
    status: opp.status,
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

  // Keyed by id so the DB-backed object (and its `durable: true` stamp) can be
  // recovered after the engine has filtered and re-sorted the list. The engine
  // passes objects through by reference, so this is a type-level recovery of a
  // fact that is already true at runtime — AND a tripwire: if an opportunity
  // ever reaches this point from anywhere other than the query above (an
  // in-memory registry fallback, a merged demo list), the lookup misses and it
  // is stamped `durable: false` instead of silently passing as a real posting.
  const durableById = new Map<string, DurableOpportunity>(
    matchaOpps.map((opp) => [opp.id, opp]),
  );

  const matches = matchOpportunities(profile, intent ?? null, matchaOpps);

  return {
    npi,
    clinicianName: profile.name,
    specialty: profile.specialty,
    state: profile.states[0],
    // Every opportunity in this list came from the Postgres `Opportunity`
    // table. Callers can assert on the per-item `durable` flag rather than
    // trusting this comment.
    opportunitySource: 'database' as const,
    matches: matches.map(m => {
      const opportunity: ProvenancedOpportunity = durableById.get(m.opportunity.id) ?? {
        ...m.opportunity,
        durable: false,
        status: 'UNKNOWN',
      };

      return {
        opportunityId: m.opportunity.id,
        band: m.explanation.matchBand,
        score: m.explanation.matchScore,
        blockers: m.explanation.blockers.map(b => ({ label: b.label, action: b.actionLabel })),
        fitReasons: m.explanation.fitReasons.map(f => f.label),
        // Additive provenance, also lifted to the match level so a consumer
        // that only reads the slim fields can still tell.
        durable: opportunity.durable,
        status: opportunity.status,
        // Full objects for the clinician surfaces (cards + detail view). The slim
        // fields above are kept for existing consumers — additive only.
        opportunity,
        explanation: m.explanation,
      };
    }),
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function scoreOpportunityForNpi(
  npi: string,
  opportunityId: string,
  intent?: CandidateIntent | null,
) {
  // `Opportunity.id` is `@db.Uuid`. Postgres rejects a malformed uuid at the
  // driver, so passing an arbitrary caller-supplied string into findUnique
  // throws rather than returning null — turning "no such opportunity" into a
  // 500. A value that cannot be a uuid cannot name a row, so answer the same
  // way a missing row does and let the route return 404.
  if (!UUID_RE.test(opportunityId)) return null;

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
    // Additive provenance — this scored a real DB row, not a registry entry.
    durable: matchaOpp.durable,
    status: matchaOpp.status,
  };
}
