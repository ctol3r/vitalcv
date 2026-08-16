/**
 * Truth contract: the self-attested candidate-credential lane is never
 * promoted to a source-verified claim — against a REAL database.
 *
 * A CandidateCredential is a clinician's own document upload. The OCR/regex
 * pipeline (services/ai/documentPipeline.ts) parses it and the clinician
 * confirms the extracted fields; the only statuses any producer writes are
 * UNVERIFIED (fresh upload) and PENDING_VERIFICATION (after confirmation).
 * Nothing in this lane is checked against a primary source. Two sites read it
 * and each used to over-claim:
 *
 *   1. opportunityTruth.ts — buildClinicianOpportunityProfile()
 *      promoted a PENDING_VERIFICATION row to requirement level L3 when
 *      `data.overallConfidence >= 0.9`. That confidence is the mean of
 *      hardcoded per-pattern regex constants (0.82-0.90 in documentPipeline)
 *      — a measure of how confidently a regex matched text, not of source
 *      corroboration. L3 is the primary-source-verified tier ("Primary Source
 *      Verification Packet", "NPI Verified"), so a self-asserted upload reached
 *      the highest tier with no source ever consulted.
 *
 *   2. trustStateEngine.ts — computeClinicianTrustState() (legacy branch)
 *      minted a fact from the same row with `verifiedAt: cred.createdAt`. The
 *      row's creation time is when it was written, not when anything was
 *      verified; the wallet renders `verifiedAt` as "Observed {date}", so an
 *      upload time was presented as an observation/verification time.
 *
 * INJECTION PROOF. Restoring either original line turns the matching case red:
 *   opportunityTruth.ts:
 *     const level = status === 'VERIFIED'
 *       || (status === 'PENDING_VERIFICATION' && confidence >= 0.9)
 *       ? 'L3' : 'L2';        // → the L2 assertions below fail (level is L3)
 *   trustStateEngine.ts:
 *     verifiedAt: cred.createdAt.toISOString(),
 *                             // → the "verifiedAt is not a creation time"
 *                             //   assertion fails (verifiedAt equals createdAt)
 * Both were re-injected and the corresponding cases observed failing before the
 * fixes were restored.
 *
 * Nothing external is contacted: global.fetch is stubbed so the NPPES lookups
 * both code paths make degrade to "unavailable" without a network call.
 */

import { PrismaClient } from '@prisma/client';

import { buildClinicianOpportunityProfile, __resetNppesIdentityCache } from '../opportunityTruth';
import { computeClinicianTrustState } from '../../trust/trustStateEngine';

const prisma = new PrismaClient();

// Distinct 10-digit NPIs per run so leftover rows from a crashed run cannot
// shadow these cases. buildClinicianOpportunityProfile only requires /^\d{10}$/.
const RUN = String(Date.now()).slice(-7);
const NPI_PENDING = `901${RUN}`;
const NPI_VERIFIED = `902${RUN}`;
const NPI_TRUST = `903${RUN}`;
const ALL_NPIS = [NPI_PENDING, NPI_VERIFIED, NPI_TRUST];

// A creation time deliberately far in the past so "verifiedAt is not this"
// is an unambiguous assertion rather than a near-now coincidence.
const CREATED_AT = new Date('2021-03-04T05:06:07.000Z');

const originalFetch = global.fetch;
const originalIngestionFlag = process.env.FEATURE_CREDENTIAL_INGESTION;

async function cleanup(): Promise<void> {
  await prisma.candidateCredential.deleteMany({ where: { clinicianId: { in: ALL_NPIS } } });
}

beforeAll(async () => {
  // Force the legacy branch of computeClinicianTrustState (the one that reads
  // CandidateCredentials directly). getFeatureFlag reads process.env live.
  process.env.FEATURE_CREDENTIAL_INGESTION = 'false';

  // Neutralise the external NPPES lookups both paths perform. `{ ok: false }`
  // makes fetchNppes / fetchNppesIdentity return their "unavailable" shape.
  global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof global.fetch;

  await cleanup();

  await prisma.candidateCredential.createMany({
    data: [
      {
        candidateCredentialId: `cred-${NPI_PENDING}`,
        clinicianId: NPI_PENDING,
        status: 'PENDING_VERIFICATION',
        // 0.95 clears the old >= 0.9 gate — the exact input that previously
        // reached L3.
        data: { documentType: 'DEA_CERTIFICATE', overallConfidence: 0.95 },
      },
      {
        candidateCredentialId: `cred-${NPI_VERIFIED}`,
        clinicianId: NPI_VERIFIED,
        // No producer sets VERIFIED today, but the removed branch would have
        // granted L3 to it unconditionally. Pin that the cap is unconditional.
        status: 'VERIFIED',
        data: { documentType: 'DEA_CERTIFICATE', overallConfidence: 0.95 },
      },
      {
        candidateCredentialId: `cred-${NPI_TRUST}`,
        clinicianId: NPI_TRUST,
        status: 'PENDING_VERIFICATION',
        createdAt: CREATED_AT,
        data: { documentType: 'DEA_CERTIFICATE', overallConfidence: 0.95 },
      },
    ],
  });

  __resetNppesIdentityCache();
});

afterAll(async () => {
  global.fetch = originalFetch;
  if (originalIngestionFlag === undefined) {
    delete process.env.FEATURE_CREDENTIAL_INGESTION;
  } else {
    process.env.FEATURE_CREDENTIAL_INGESTION = originalIngestionFlag;
  }
  await cleanup();
  await prisma.$disconnect();
});

describe('opportunityTruth: candidate-credential lane is capped at L2', () => {
  it('a PENDING_VERIFICATION upload with confidence >= 0.9 no longer reaches L3', async () => {
    const profile = await buildClinicianOpportunityProfile({ npi: NPI_PENDING });
    expect(profile).not.toBeNull();

    const dea = profile!.credentials.find((c) => c.key === 'dea');
    expect(dea).toBeDefined();
    // The load-bearing assertion: high regex confidence must NOT confer L3.
    expect(dea!.level).toBe('L2');
    expect(dea!.level).not.toBe('L3');
    // Held status stays pending — the clinician attested, no source verified.
    expect(dea!.status).toBe('pending');
  });

  it('even a VERIFIED-status row is capped at L2 (the cap is unconditional)', async () => {
    const profile = await buildClinicianOpportunityProfile({ npi: NPI_VERIFIED });
    expect(profile).not.toBeNull();

    const dea = profile!.credentials.find((c) => c.key === 'dea');
    expect(dea).toBeDefined();
    expect(dea!.level).toBe('L2');
    expect(dea!.level).not.toBe('L3');
  });
});

describe('trustStateEngine: candidate-credential fact carries no verifiedAt', () => {
  it('verifiedAt is undefined, not the row creation time', async () => {
    const state = await computeClinicianTrustState(NPI_TRUST);

    const fact = state.facts.find((f) => f.source === 'DocumentIntelligence');
    expect(fact).toBeDefined();
    expect(fact!.status).toBe('PENDING_VERIFICATION');

    // The load-bearing assertion: a self-attested upload has no verification
    // event, so verifiedAt must be absent — and in particular must not be the
    // row's creation timestamp.
    expect(fact!.verifiedAt).toBeUndefined();
    expect(fact!.verifiedAt).not.toBe(CREATED_AT.toISOString());
  });
});
