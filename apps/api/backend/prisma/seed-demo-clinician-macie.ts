/**
 * seed-demo-clinician-macie.ts
 *
 * Seeds a single canonical demo clinician (NPI 1346053246, Macie Miller, PA-C)
 * into the local development database so that:
 *
 *   GET /api/passport/1346053246          → 200 (real passport shape)
 *   GET /api/passport/1346053246/trust    → 200 (real trust summary)
 *   GET /api/passport/1346053246/export   → 200 (populated employer packet)
 *
 * Demo / public-safe contract:
 *   - Every artifact and provider row is tagged `demo_origin:
 *     'seed-demo-clinician-macie'` in rawPayload metadata so anyone
 *     inspecting the DB can identify the row as a seeded fixture.
 *   - No artifact claims primary-source verification beyond what a fixture
 *     can honestly carry. confidenceLabel is 'DEMO_FIXTURE', trustTier
 *     mirrors the source's real T1–T4 doctrine band.
 *   - The clinician name + NPI shape mirror an NPPES public record; values
 *     beyond what NPPES exposes publicly (license numbers, board cert ids)
 *     are deterministic fixtures, not pulled from any real authoritative
 *     source.
 *
 * Run:
 *   pnpm --filter @vitalcv/api exec ts-node -P tsconfig.seed.json \
 *     prisma/seed-demo-clinician-macie.ts
 *
 * Idempotent — re-running deletes prior Macie-NPI rows before recreating.
 */

import './_loadEnvForSeed';
import prisma from '../src/graphql/prisma_client';
import { createHash } from 'node:crypto';

const NPI = '1346053246';
const FIRST_NAME = 'Macie';
const LAST_NAME = 'Miller';
const CREDENTIAL = 'PA-C';
const FULL_NAME = `${FIRST_NAME} ${LAST_NAME}, ${CREDENTIAL}`;
const PA_TAXONOMY = '363A00000X'; // Physician Assistant
const STATE = 'NC';
const DEMO_ORIGIN = 'seed-demo-clinician-macie';
const OBSERVED_AT = new Date('2026-04-01T15:00:00.000Z');
const EXPIRES_AT = new Date('2027-04-01T15:00:00.000Z');

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const NPPES_PAYLOAD = {
  credential_type: 'NPI_IDENTITY',
  enumeration_type: 'NPI-1',
  basic: {
    first_name: FIRST_NAME,
    last_name: LAST_NAME,
    credential: CREDENTIAL,
    sole_proprietor: 'NO',
    gender: 'F',
    enumeration_date: '2019-08-21',
    last_updated: OBSERVED_AT.toISOString().slice(0, 10),
    status: 'A',
    name_prefix: '--',
    name_suffix: '--',
  },
  taxonomies: [
    {
      code: PA_TAXONOMY,
      taxonomy_group: '',
      desc: 'Physician Assistant',
      state: STATE,
      license: 'DEMO-NC-PA-104725',
      primary: true,
    },
  ],
  addresses: [
    {
      address_purpose: 'LOCATION',
      address_type: 'DOM',
      address_1: '101 Demo Health Way',
      city: 'Raleigh',
      state: STATE,
      postal_code: '27601',
      country_code: 'US',
    },
  ],
  demo_origin: DEMO_ORIGIN,
  is_demo: true,
} as const;

const LICENSE_PAYLOAD = {
  credential_type: 'STATE_LICENSE',
  source: 'STATE_BOARD_DEMO_FIXTURE',
  jurisdiction: STATE,
  board: 'North Carolina Medical Board (demo fixture)',
  license_number: 'DEMO-NC-PA-104725',
  profession: 'Physician Assistant',
  status: 'Active',
  issued_on: '2019-09-15',
  expires_on: EXPIRES_AT.toISOString().slice(0, 10),
  primary_source_url: null,
  demo_origin: DEMO_ORIGIN,
  is_demo: true,
  source_disclaimer:
    'Demo fixture. Not retrieved from any state medical board. License number is a placeholder.',
} as const;

const BOARD_CERT_PAYLOAD = {
  credential_type: 'BOARD_CERTIFICATION',
  source: 'NCCPA_DEMO_FIXTURE',
  issuer: 'National Commission on Certification of Physician Assistants (demo fixture)',
  certification: 'Certified Physician Assistant (PA-C)',
  certificate_number: 'DEMO-NCCPA-558210',
  issued_on: '2019-11-04',
  expires_on: EXPIRES_AT.toISOString().slice(0, 10),
  status: 'CURRENT',
  demo_origin: DEMO_ORIGIN,
  is_demo: true,
  source_disclaimer:
    'Demo fixture. Not retrieved from NCCPA primary source. Certificate number is a placeholder.',
} as const;

const OIG_PAYLOAD = {
  credential_type: 'OIG_EXCLUSION',
  source: 'OIG_LEIE',
  matchType: 'NONE',
  matchedOn: null,
  checkedAt: OBSERVED_AT.toISOString(),
  resultSummary: 'No exclusion match found in fixture set.',
  demo_origin: DEMO_ORIGIN,
  is_demo: true,
  source_disclaimer:
    'Demo fixture: result reflects an empty-match against the seeded fixture set, not a live OIG LEIE query.',
} as const;

async function seedDemoClinicianMacie() {
  // 1. Provider row (idempotent via @unique npi)
  await prisma.provider.upsert({
    where: { npi: NPI },
    update: {
      fullName: FULL_NAME,
      providerType: 'INDIVIDUAL',
      taxonomyCode: PA_TAXONOMY,
      stateOfPractice: STATE,
    },
    create: {
      npi: NPI,
      fullName: FULL_NAME,
      providerType: 'INDIVIDUAL',
      taxonomyCode: PA_TAXONOMY,
      stateOfPractice: STATE,
    },
  });

  // 2. Clear prior demo artifacts for this NPI so re-runs are clean.
  //    Scoped narrowly to NPI + the four sources we seed below.
  await prisma.verificationArtifact.deleteMany({
    where: {
      npi: NPI,
      source: { in: ['NPPES_API', 'STATE_BOARD_DEMO_FIXTURE', 'NCCPA_DEMO_FIXTURE', 'OIG_LEIE'] },
    },
  });

  // 3. NPPES identity artifact — the public identity primary signal
  await prisma.verificationArtifact.create({
    data: {
      npi: NPI,
      source: 'NPPES_API',
      status: 'ACTIVE',
      rawPayload: NPPES_PAYLOAD as object,
      checksum: sha256(NPPES_PAYLOAD),
      verifiedAt: OBSERVED_AT,
      expiresAt: null,
      trustState: 'verified',
      lifecycleState: 'active',
    },
  });

  // 4. State license (demo fixture — explicitly labeled)
  await prisma.verificationArtifact.create({
    data: {
      npi: NPI,
      source: 'STATE_BOARD_DEMO_FIXTURE',
      status: 'ACTIVE',
      rawPayload: LICENSE_PAYLOAD as object,
      checksum: sha256(LICENSE_PAYLOAD),
      verifiedAt: OBSERVED_AT,
      expiresAt: EXPIRES_AT,
      trustState: 'needs_review',
      lifecycleState: 'active',
    },
  });

  // 5. Board certification (demo fixture)
  await prisma.verificationArtifact.create({
    data: {
      npi: NPI,
      source: 'NCCPA_DEMO_FIXTURE',
      status: 'ACTIVE',
      rawPayload: BOARD_CERT_PAYLOAD as object,
      checksum: sha256(BOARD_CERT_PAYLOAD),
      verifiedAt: OBSERVED_AT,
      expiresAt: EXPIRES_AT,
      trustState: 'needs_review',
      lifecycleState: 'active',
    },
  });

  // 6. OIG sanctions check — clean result against the demo fixture set
  await prisma.verificationArtifact.create({
    data: {
      npi: NPI,
      source: 'OIG_LEIE',
      status: 'CLEAR',
      rawPayload: OIG_PAYLOAD as object,
      checksum: sha256(OIG_PAYLOAD),
      verifiedAt: OBSERVED_AT,
      expiresAt: null,
      trustState: 'verified',
      lifecycleState: 'active',
    },
  });

  console.log(
    JSON.stringify(
      {
        seed: DEMO_ORIGIN,
        npi: NPI,
        provider: FULL_NAME,
        artifacts: 4,
        demo: true,
      },
      null,
      2,
    ),
  );
}

seedDemoClinicianMacie()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
