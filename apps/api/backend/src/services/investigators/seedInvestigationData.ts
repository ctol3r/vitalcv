import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  createGraphEdgeCanonicalKey,
  createGraphEdgeId,
  createGraphEdgePairKey,
  createGraphNodeCanonicalKey,
  createGraphNodeId,
} from '../graph-engine/ids';
import { listStorylines } from '../storylines/storylineService';
import { listInvestigatorFindings, runTargetedInvestigators } from './investigatorEngineService';
import { IGNITION_INVESTIGATOR_IDS } from './ignitionInvestigators';

const SEED_MARKER = 'seed_investigation_data_v1';
const SEED_PARSER_VERSION = 'seed-investigation-data/v1';
const SEED_CREATED_BY = SEED_MARKER;

type SeedLogger = (level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>) => void;

type SeedProviderScenario = {
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  taxonomyCode: string;
  stateOfPractice: string;
  currentInstitution: string;
  priorState?: string;
  priorInstitution?: string;
  currentLocation: { city: string; state: string };
  priorLocation?: { city: string; state: string };
  researchProfile?: {
    publicationWindow: Array<{
      claimId: string;
      sourceId: 'OPENALEX' | 'PUBMED' | 'NIH_REPORTER' | 'CLINICAL_TRIALS';
      claimType: string;
      daysAgo: number;
      value: Record<string, unknown>;
    }>;
  };
  trialSignals?: Array<{
    claimId: string;
    daysAgo: number;
    status: string;
    role: string;
    title: string;
    nctId: string;
    institution: string;
  }>;
  paymentArtifact?: {
    verifiedDaysAgo: number;
    rows: Array<{
      payer: string;
      amount: number;
      year: string;
      nature: string;
    }>;
  };
  sanctionsArtifact?: {
    source: 'OIG_LEIE' | 'NPDB' | 'STATE_LICENSE_BOARD' | 'SAM_GOV';
    verifiedDaysAgo: number;
    payload: Record<string, unknown>;
  };
  institutionExpansion: {
    edgeType: 'affiliated_with' | 'employed_by' | 'member_of' | 'practices_at' | 'works_at' | 'credentialed_at';
    institutions: string[];
  };
  trustHistory: Array<{
    triggerEvent: string;
    recordedDaysAgo: number;
    previousScore: number;
    newScore: number;
    scoreDelta: number;
    band: string;
    metadata: Prisma.InputJsonValue;
  }>;
};

export type InvestigationSeedSummary = {
  seeded: boolean;
  marker: string;
  providers: number;
  findingsByProvider: Record<string, number>;
  storylinesByProvider: Record<string, number>;
  investigatorRuns: Array<{
    investigatorId: string;
    findingsGenerated: number;
    findingsCreated: number;
    findingsUpdated: number;
  }>;
};

const SEEDED_PROVIDERS: SeedProviderScenario[] = [
  {
    npi: '1902301456',
    firstName: 'Amelia',
    lastName: 'Hart',
    specialty: 'Medical Oncology',
    taxonomyCode: '207RX0202X',
    stateOfPractice: 'FL',
    currentInstitution: 'Mayo Clinic Jacksonville',
    priorState: 'TX',
    priorInstitution: 'Baptist MD Anderson Cancer Center',
    currentLocation: { city: 'Jacksonville', state: 'FL' },
    priorLocation: { city: 'Houston', state: 'TX' },
    sanctionsArtifact: {
      source: 'NPDB',
      verifiedDaysAgo: 4,
      payload: {
        exclusionStatus: 'EXCLUDED',
        exclusionType: 'Adverse clinical privileges action',
        effectiveDate: '2026-02-12',
        actionSummary: 'Temporary restriction after chemotherapy protocol variance review',
      },
    },
    institutionExpansion: {
      edgeType: 'credentialed_at',
      institutions: [
        'Mayo Clinic Jacksonville',
        'Brooks Rehabilitation Hospital',
        'Cleveland Clinic Florida',
      ],
    },
    trustHistory: [
      {
        triggerEvent: 'SEED_BASELINE',
        recordedDaysAgo: 28,
        previousScore: 84,
        newScore: 84,
        scoreDelta: 0,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 23, max: 25, status: 'ACTIVE', pct: 92 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
          },
        },
      },
      {
        triggerEvent: 'SEED_REFRESH',
        recordedDaysAgo: 2,
        previousScore: 84,
        newScore: 61,
        scoreDelta: -23,
        band: 'L1',
        metadata: {
          dimensionScores: {
            licensure: { score: 21, max: 25, status: 'ACTIVE', pct: 84 },
            exclusion: { score: 4, max: 20, status: 'EXCLUDED', pct: 20 },
            freshness: { score: 6, max: 7, status: 'FRESH', pct: 86 },
          },
        },
      },
    ],
  },
  {
    npi: '1174893021',
    firstName: 'Noah',
    lastName: 'Chen',
    specialty: 'Interventional Cardiology',
    taxonomyCode: '207RC0000X',
    stateOfPractice: 'CA',
    currentInstitution: 'UCSF Health',
    currentLocation: { city: 'San Francisco', state: 'CA' },
    researchProfile: {
      publicationWindow: [
        {
          claimId: 'seed-noah-openalex-1',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 36,
          value: {
            title: 'Remote stent surveillance with multimodal troponin signatures',
            citationCount: 142,
            institution: 'UCSF Health',
          },
        },
        {
          claimId: 'seed-noah-openalex-2',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 28,
          value: {
            title: 'Adaptive PCI recovery pathways using wearable telemetry',
            citationCount: 118,
            institution: 'UCSF Health',
          },
        },
        {
          claimId: 'seed-noah-pubmed-1',
          sourceId: 'PUBMED',
          claimType: 'CITATION_METRIC',
          daysAgo: 21,
          value: {
            title: 'Rapid ambulatory ischemia review',
            citationCount: 154,
          },
        },
        {
          claimId: 'seed-noah-nih-1',
          sourceId: 'NIH_REPORTER',
          claimType: 'RESEARCH_GRANT',
          daysAgo: 18,
          value: {
            grantId: 'R01HL155210',
            title: 'Adaptive ECG biomarkers after PCI',
            institution: 'UCSF Health',
          },
        },
        {
          claimId: 'seed-noah-openalex-previous',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 245,
          value: {
            title: 'Legacy cath lab throughput optimization',
            citationCount: 48,
            institution: 'UCSF Health',
          },
        },
      ],
    },
    trialSignals: [
      {
        claimId: 'seed-noah-trial-terminated',
        daysAgo: 11,
        status: 'TERMINATED',
        role: 'PRINCIPAL_INVESTIGATOR',
        title: 'REMOTE-PCI post discharge optimization study',
        nctId: 'NCT05432011',
        institution: 'UCSF Health',
      },
      {
        claimId: 'seed-noah-trial-active',
        daysAgo: 23,
        status: 'RECRUITING',
        role: 'PRINCIPAL_INVESTIGATOR',
        title: 'Telemetry-first coronary recovery registry',
        nctId: 'NCT05544102',
        institution: 'Zuckerberg San Francisco General',
      },
    ],
    institutionExpansion: {
      edgeType: 'practices_at',
      institutions: [
        'UCSF Health',
        'Zuckerberg San Francisco General',
        'John Muir Health Walnut Creek',
      ],
    },
    trustHistory: [
      {
        triggerEvent: 'SEED_BASELINE',
        recordedDaysAgo: 30,
        previousScore: 88,
        newScore: 88,
        scoreDelta: 0,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 24, max: 25, status: 'ACTIVE', pct: 96 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
          },
        },
      },
      {
        triggerEvent: 'SEED_REFRESH',
        recordedDaysAgo: 1,
        previousScore: 88,
        newScore: 85,
        scoreDelta: -3,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 24, max: 25, status: 'ACTIVE', pct: 96 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 6, max: 7, status: 'AGING', pct: 86 },
          },
        },
      },
    ],
  },
  {
    npi: '1649823507',
    firstName: 'Sofia',
    lastName: 'Alvarez',
    specialty: 'Neurology',
    taxonomyCode: '2084N0400X',
    stateOfPractice: 'TX',
    currentInstitution: 'Houston Methodist Hospital',
    currentLocation: { city: 'Houston', state: 'TX' },
    researchProfile: {
      publicationWindow: [
        {
          claimId: 'seed-sofia-openalex-1',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 44,
          value: {
            title: 'Neuroinflammation response after biologic initiation',
            citationCount: 96,
            institution: 'Houston Methodist Hospital',
          },
        },
        {
          claimId: 'seed-sofia-nih-1',
          sourceId: 'NIH_REPORTER',
          claimType: 'RESEARCH_GRANT',
          daysAgo: 31,
          value: {
            grantId: 'R21NS119420',
            title: 'Adaptive stroke triage biomarkers in high-risk populations',
            institution: 'Houston Methodist Hospital',
          },
        },
        {
          claimId: 'seed-sofia-trial-research-1',
          sourceId: 'CLINICAL_TRIALS',
          claimType: 'CLINICAL_TRIAL',
          daysAgo: 27,
          value: {
            nctId: 'NCT05620413',
            title: 'Rapid post-stroke recovery biologics registry',
            status: 'RECRUITING',
            role: 'SUB_INVESTIGATOR',
            institution: 'Houston Methodist Hospital',
          },
        },
        {
          claimId: 'seed-sofia-openalex-previous',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 260,
          value: {
            title: 'Historical post-stroke follow-up adherence analysis',
            citationCount: 24,
            institution: 'Houston Methodist Hospital',
          },
        },
      ],
    },
    trialSignals: [
      {
        claimId: 'seed-sofia-trial-terminated',
        daysAgo: 8,
        status: 'SUSPENDED',
        role: 'SUB_INVESTIGATOR',
        title: 'Biologic bridge stroke prevention registry',
        nctId: 'NCT05311804',
        institution: 'Houston Methodist Hospital',
      },
    ],
    paymentArtifact: {
      verifiedDaysAgo: 6,
      rows: [
        {
          payer: 'NeuroNova Therapeutics',
          amount: 68000,
          year: '2025',
          nature: 'Consulting Fee',
        },
        {
          payer: 'NeuroNova Therapeutics',
          amount: 24000,
          year: '2025',
          nature: 'Travel and Lodging',
        },
        {
          payer: 'Synapse BioDevices',
          amount: 9500,
          year: '2025',
          nature: 'Food and Beverage',
        },
      ],
    },
    institutionExpansion: {
      edgeType: 'works_at',
      institutions: [
        'Houston Methodist Hospital',
        'Texas Medical Center Innovation Hub',
      ],
    },
    trustHistory: [
      {
        triggerEvent: 'SEED_BASELINE',
        recordedDaysAgo: 25,
        previousScore: 81,
        newScore: 81,
        scoreDelta: 0,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 23, max: 25, status: 'ACTIVE', pct: 92 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
          },
        },
      },
      {
        triggerEvent: 'SEED_REFRESH',
        recordedDaysAgo: 1,
        previousScore: 81,
        newScore: 77,
        scoreDelta: -4,
        band: 'L2',
        metadata: {
          dimensionScores: {
            licensure: { score: 22, max: 25, status: 'ACTIVE', pct: 88 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 5, max: 7, status: 'AGING', pct: 71 },
          },
        },
      },
    ],
  },
  {
    npi: '1326504789',
    firstName: 'Marcus',
    lastName: 'Bennett',
    specialty: 'Orthopedic Surgery',
    taxonomyCode: '207X00000X',
    stateOfPractice: 'NJ',
    currentInstitution: 'Hackensack University Medical Center',
    priorState: 'NY',
    priorInstitution: 'NYU Langone Orthopedic Hospital',
    currentLocation: { city: 'Hackensack', state: 'NJ' },
    priorLocation: { city: 'New York', state: 'NY' },
    paymentArtifact: {
      verifiedDaysAgo: 5,
      rows: [
        {
          payer: 'OrthoSphere Devices',
          amount: 54000,
          year: '2025',
          nature: 'Royalty or License',
        },
        {
          payer: 'OrthoSphere Devices',
          amount: 21000,
          year: '2025',
          nature: 'Consulting Fee',
        },
        {
          payer: 'JointPath Surgical',
          amount: 7000,
          year: '2025',
          nature: 'Education',
        },
      ],
    },
    institutionExpansion: {
      edgeType: 'employed_by',
      institutions: [
        'Hackensack University Medical Center',
        'Hospital for Special Surgery',
        'JFK Johnson Rehabilitation Institute',
      ],
    },
    trustHistory: [
      {
        triggerEvent: 'SEED_BASELINE',
        recordedDaysAgo: 35,
        previousScore: 83,
        newScore: 83,
        scoreDelta: 0,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 23, max: 25, status: 'ACTIVE', pct: 92 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
          },
        },
      },
      {
        triggerEvent: 'SEED_REFRESH',
        recordedDaysAgo: 2,
        previousScore: 83,
        newScore: 79,
        scoreDelta: -4,
        band: 'L2',
        metadata: {
          dimensionScores: {
            licensure: { score: 22, max: 25, status: 'ACTIVE', pct: 88 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 5, max: 7, status: 'AGING', pct: 71 },
          },
        },
      },
    ],
  },
  {
    npi: '1760432985',
    firstName: 'Priya',
    lastName: 'Raman',
    specialty: 'Endocrinology',
    taxonomyCode: '207RE0101X',
    stateOfPractice: 'MA',
    currentInstitution: 'Massachusetts General Hospital',
    currentLocation: { city: 'Boston', state: 'MA' },
    researchProfile: {
      publicationWindow: [
        {
          claimId: 'seed-priya-openalex-1',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 33,
          value: {
            title: 'Continuous glucose biomarker drift in complex endocrine cases',
            citationCount: 127,
            institution: 'Massachusetts General Hospital',
          },
        },
        {
          claimId: 'seed-priya-openalex-2',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 26,
          value: {
            title: 'Equity-aware diabetes prevention in longitudinal clinics',
            citationCount: 94,
            institution: 'Massachusetts General Hospital',
          },
        },
        {
          claimId: 'seed-priya-nih-1',
          sourceId: 'NIH_REPORTER',
          claimType: 'RESEARCH_GRANT',
          daysAgo: 19,
          value: {
            grantId: 'R01DK148331',
            title: 'Adaptive endocrine monitoring in ambulatory populations',
            institution: 'Massachusetts General Hospital',
          },
        },
        {
          claimId: 'seed-priya-openalex-previous',
          sourceId: 'OPENALEX',
          claimType: 'PUBLICATION',
          daysAgo: 233,
          value: {
            title: 'Historical HbA1c pathway review',
            citationCount: 28,
            institution: 'Massachusetts General Hospital',
          },
        },
      ],
    },
    trialSignals: [
      {
        claimId: 'seed-priya-trial-terminated',
        daysAgo: 9,
        status: 'WITHDRAWN',
        role: 'PRINCIPAL_INVESTIGATOR',
        title: 'Adaptive endocrine relapse prevention registry',
        nctId: 'NCT05573044',
        institution: 'Massachusetts General Hospital',
      },
    ],
    paymentArtifact: {
      verifiedDaysAgo: 7,
      rows: [
        {
          payer: 'MetaboCare Therapeutics',
          amount: 49000,
          year: '2025',
          nature: 'Consulting Fee',
        },
        {
          payer: 'MetaboCare Therapeutics',
          amount: 22000,
          year: '2025',
          nature: 'Research Payment',
        },
        {
          payer: 'Glycemic Systems',
          amount: 8000,
          year: '2025',
          nature: 'Travel and Lodging',
        },
      ],
    },
    institutionExpansion: {
      edgeType: 'member_of',
      institutions: [
        'Massachusetts General Hospital',
        'Brigham and Women’s Innovation Center',
      ],
    },
    trustHistory: [
      {
        triggerEvent: 'SEED_BASELINE',
        recordedDaysAgo: 29,
        previousScore: 86,
        newScore: 86,
        scoreDelta: 0,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 24, max: 25, status: 'ACTIVE', pct: 96 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
          },
        },
      },
      {
        triggerEvent: 'SEED_REFRESH',
        recordedDaysAgo: 1,
        previousScore: 86,
        newScore: 84,
        scoreDelta: -2,
        band: 'L3',
        metadata: {
          dimensionScores: {
            licensure: { score: 24, max: 25, status: 'ACTIVE', pct: 96 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
            freshness: { score: 6, max: 7, status: 'AGING', pct: 86 },
          },
        },
      },
    ],
  },
];

export const INVESTIGATION_SEED_MARKER = SEED_MARKER;
export const INVESTIGATION_SEED_PROVIDER_NPIS = SEEDED_PROVIDERS.map((provider) => provider.npi);

function checksumFor(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
}

function clinicianNodeId(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function clinicianNodeCanonicalKey(npi: string): string {
  return createGraphNodeCanonicalKey({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function institutionNodeId(name: string): string {
  return createGraphNodeId({
    type: 'institution',
    sourceKind: 'name',
    sourceId: slugify(name),
  });
}

function institutionNodeCanonicalKey(name: string): string {
  return createGraphNodeCanonicalKey({
    type: 'institution',
    sourceKind: 'name',
    sourceId: slugify(name),
  });
}

function buildIdentityArtifactInput(provider: SeedProviderScenario, now: Date) {
  const payload = {
    npi: provider.npi,
    fullName: `${provider.firstName} ${provider.lastName}`,
    specialty: provider.specialty,
    state: provider.stateOfPractice,
    institution: provider.currentInstitution,
  };
  return {
    npi: provider.npi,
    source: 'NPPES_API',
    status: 'VERIFIED',
    artifactType: 'IDENTITY',
    parserVersion: SEED_PARSER_VERSION,
    trustTier: 'GOLD',
    confidenceScore: 0.99,
    rawPayload: payload as Prisma.InputJsonValue,
    checksum: checksumFor(['identity', provider.npi, payload]),
    verifiedAt: daysAgo(now, 1),
    sourceUrl: `https://nppes.cms.hhs.gov/provider/${provider.npi}`,
    monitoring: true,
    trustState: 'verified',
  } satisfies Prisma.VerificationArtifactUncheckedCreateInput;
}

function buildLicensureArtifactInput(provider: SeedProviderScenario, now: Date) {
  const payload = {
    licenseStatus: 'ACTIVE',
    practiceState: provider.stateOfPractice,
    institution: provider.currentInstitution,
    specialty: provider.specialty,
  };
  return {
    npi: provider.npi,
    source: 'PECOS_PUBLIC',
    status: 'ACTIVE',
    artifactType: 'LICENSURE',
    parserVersion: SEED_PARSER_VERSION,
    trustTier: 'GOLD',
    confidenceScore: 0.96,
    rawPayload: payload as Prisma.InputJsonValue,
    checksum: checksumFor(['licensure', provider.npi, payload]),
    verifiedAt: daysAgo(now, 2),
    sourceUrl: `https://pecos.cms.hhs.gov/provider/${provider.npi}`,
    monitoring: true,
    trustState: 'verified',
  } satisfies Prisma.VerificationArtifactUncheckedCreateInput;
}

async function ensureVerificationArtifact(
  prismaClient: PrismaClient,
  data: Prisma.VerificationArtifactUncheckedCreateInput,
) {
  const existing = await prismaClient.verificationArtifact.findFirst({
    where: {
      npi: data.npi,
      source: data.source,
      checksum: data.checksum,
    },
    select: { id: true },
  });

  if (existing) {
    return prismaClient.verificationArtifact.update({
      where: { id: existing.id },
      data,
    });
  }

  return prismaClient.verificationArtifact.create({ data });
}

async function ensureClaimRecord(
  prismaClient: PrismaClient,
  data: Prisma.ClaimRecordUncheckedCreateInput,
) {
  const existing = await prismaClient.claimRecord.findFirst({
    where: { claimId: data.claimId },
    select: { id: true },
  });

  if (existing) {
    return prismaClient.claimRecord.update({
      where: { id: existing.id },
      data,
    });
  }

  return prismaClient.claimRecord.create({ data });
}

function buildClaimRecordInput(input: {
  provider: SeedProviderScenario;
  claimId: string;
  sourceId: string;
  claimType: string;
  value: Record<string, unknown>;
  observedAt: Date;
  derivedAt?: Date;
  status?: string;
}): Prisma.ClaimRecordUncheckedCreateInput {
  return {
    claimId: input.claimId,
    subjectNpi: input.provider.npi,
    claimType: input.claimType,
    value: input.value as Prisma.InputJsonValue,
    trustTier: 'GOLD',
    confidenceLabel: 'HIGH',
    confidenceScore: 0.92,
    sourceId: input.sourceId,
    parserVersion: SEED_PARSER_VERSION,
    status: input.status ?? 'ACTIVE',
    observedAt: input.observedAt,
    derivedAt: input.derivedAt ?? input.observedAt,
    createdAt: input.observedAt,
  };
}

async function upsertGraphNode(
  prismaClient: PrismaClient,
  data: Prisma.GraphNodeUncheckedCreateInput,
) {
  return prismaClient.graphNode.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });
}

async function upsertGraphEdge(
  prismaClient: PrismaClient,
  data: Prisma.GraphEdgeUncheckedCreateInput,
) {
  return prismaClient.graphEdge.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });
}

async function ensureProviderProfile(prismaClient: PrismaClient, provider: SeedProviderScenario) {
  const clerkUserId = `seed-clerk-${provider.npi}`;
  const email = `${provider.firstName.toLowerCase()}.${provider.lastName.toLowerCase()}+${provider.npi}@seed.vitalcv.local`;
  const user = await prismaClient.user.upsert({
    where: { clerkUserId },
    update: {
      email,
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
    create: {
      clerkUserId,
      email,
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
  });

  await prismaClient.personProfile.upsert({
    where: { userId: user.id },
    update: {
      npi: provider.npi,
      firstName: provider.firstName,
      lastName: provider.lastName,
      specialty: provider.specialty,
      stateOfPractice: provider.stateOfPractice,
      completeness: 100,
    },
    create: {
      userId: user.id,
      npi: provider.npi,
      firstName: provider.firstName,
      lastName: provider.lastName,
      specialty: provider.specialty,
      stateOfPractice: provider.stateOfPractice,
      completeness: 100,
    },
  });

  await prismaClient.provider.upsert({
    where: { npi: provider.npi },
    update: {
      fullName: `${provider.firstName} ${provider.lastName}`,
      providerType: 'Physician',
      taxonomyCode: provider.taxonomyCode,
      stateOfPractice: provider.stateOfPractice,
    },
    create: {
      npi: provider.npi,
      fullName: `${provider.firstName} ${provider.lastName}`,
      providerType: 'Physician',
      taxonomyCode: provider.taxonomyCode,
      stateOfPractice: provider.stateOfPractice,
    },
  });
}

async function ensureProviderEvidence(prismaClient: PrismaClient, provider: SeedProviderScenario, now: Date) {
  await ensureVerificationArtifact(prismaClient, buildIdentityArtifactInput(provider, now));
  await ensureVerificationArtifact(prismaClient, buildLicensureArtifactInput(provider, now));

  await ensureClaimRecord(prismaClient, buildClaimRecordInput({
    provider,
    claimId: `seed-${provider.npi}-specialty`,
    sourceId: 'NPPES_API',
    claimType: 'SPECIALTY',
    value: {
      specialty: provider.specialty,
      taxonomy: provider.taxonomyCode,
      institution: provider.currentInstitution,
    },
    observedAt: daysAgo(now, 40),
  }));

  await ensureClaimRecord(prismaClient, buildClaimRecordInput({
    provider,
    claimId: `seed-${provider.npi}-location-current`,
    sourceId: 'NPPES_API',
    claimType: 'PRACTICE_LOCATION',
    value: {
      city: provider.currentLocation.city,
      state: provider.currentLocation.state,
      institution: provider.currentInstitution,
    },
    observedAt: daysAgo(now, 12),
  }));

  await ensureClaimRecord(prismaClient, buildClaimRecordInput({
    provider,
    claimId: `seed-${provider.npi}-institution-current`,
    sourceId: 'PECOS_PUBLIC',
    claimType: 'INSTITUTION_AFFILIATION',
    value: {
      institution: provider.currentInstitution,
      state: provider.stateOfPractice,
      organization: provider.currentInstitution,
    },
    observedAt: daysAgo(now, 10),
  }));

  if (provider.priorLocation) {
    await ensureClaimRecord(prismaClient, buildClaimRecordInput({
      provider,
      claimId: `seed-${provider.npi}-location-prior`,
      sourceId: 'NPPES_API',
      claimType: 'PRACTICE_LOCATION',
      value: {
        city: provider.priorLocation.city,
        state: provider.priorLocation.state,
        institution: provider.priorInstitution ?? provider.currentInstitution,
      },
      observedAt: daysAgo(now, 126),
    }));
  }

  if (provider.priorInstitution) {
    await ensureClaimRecord(prismaClient, buildClaimRecordInput({
      provider,
      claimId: `seed-${provider.npi}-institution-prior`,
      sourceId: 'PECOS_PUBLIC',
      claimType: 'INSTITUTION_AFFILIATION',
      value: {
        institution: provider.priorInstitution,
        state: provider.priorState ?? provider.stateOfPractice,
        organization: provider.priorInstitution,
      },
      observedAt: daysAgo(now, 132),
    }));
  }

  for (const claim of provider.researchProfile?.publicationWindow ?? []) {
    const observedAt = daysAgo(now, claim.daysAgo);
    await ensureClaimRecord(prismaClient, buildClaimRecordInput({
      provider,
      claimId: claim.claimId,
      sourceId: claim.sourceId,
      claimType: claim.claimType,
      value: claim.value,
      observedAt,
    }));
  }

  for (const trial of provider.trialSignals ?? []) {
    const observedAt = daysAgo(now, trial.daysAgo);
    await ensureClaimRecord(prismaClient, buildClaimRecordInput({
      provider,
      claimId: trial.claimId,
      sourceId: 'CLINICAL_TRIALS',
      claimType: 'CLINICAL_TRIAL',
      value: {
        nctId: trial.nctId,
        title: trial.title,
        status: trial.status,
        role: trial.role,
        institution: trial.institution,
      },
      observedAt,
    }));
  }

  if (provider.paymentArtifact) {
    const paymentPayload = {
      results: provider.paymentArtifact.rows.map((row) => ({
        applicable_manufacturer_or_applicable_gpo_making_payment_name: row.payer,
        total_amount_of_payment_usdollars: row.amount,
        program_year: row.year,
        nature_of_payment_or_transfer_of_value: row.nature,
      })),
    };

    await ensureVerificationArtifact(prismaClient, {
      npi: provider.npi,
      source: 'OPEN_PAYMENTS',
      status: 'VERIFIED',
      artifactType: 'FINANCIAL_RELATIONSHIP',
      parserVersion: SEED_PARSER_VERSION,
      trustTier: 'SILVER',
      confidenceScore: 0.93,
      rawPayload: paymentPayload as Prisma.InputJsonValue,
      checksum: checksumFor(['open-payments', provider.npi, paymentPayload]),
      verifiedAt: daysAgo(now, provider.paymentArtifact.verifiedDaysAgo),
      sourceUrl: `https://openpaymentsdata.cms.gov/provider/${provider.npi}`,
      monitoring: true,
      trustState: 'needs_review',
    });
  }

  if (provider.sanctionsArtifact) {
    await ensureVerificationArtifact(prismaClient, {
      npi: provider.npi,
      source: provider.sanctionsArtifact.source,
      status: 'EXCLUDED',
      artifactType: 'SANCTIONS',
      parserVersion: SEED_PARSER_VERSION,
      trustTier: 'GOLD',
      confidenceScore: 0.97,
      rawPayload: provider.sanctionsArtifact.payload as Prisma.InputJsonValue,
      checksum: checksumFor(['sanctions', provider.npi, provider.sanctionsArtifact]),
      verifiedAt: daysAgo(now, provider.sanctionsArtifact.verifiedDaysAgo),
      sourceUrl: `https://integrity.vitalcv.local/sanctions/${provider.npi}`,
      monitoring: true,
      trustState: 'needs_review',
    });
  }

  await prismaClient.trustScoreHistory.createMany({
    data: provider.trustHistory.map((entry) => ({
      subjectType: 'NPI',
      subjectId: provider.npi,
      previousScore: entry.previousScore,
      newScore: entry.newScore,
      scoreDelta: entry.scoreDelta,
      triggerEvent: entry.triggerEvent,
      confidence: 0.9,
      band: entry.band,
      methodologyVersion: 'trust-score/v1.0',
      metadata: entry.metadata,
      recordedAt: daysAgo(now, entry.recordedDaysAgo),
    })),
  });
}

function buildEdgeInput(
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: string,
  directed: boolean,
  createdAt: Date,
  provenance: Record<string, unknown>,
): Prisma.GraphEdgeUncheckedCreateInput {
  const materialHash = checksumFor([sourceNodeId, targetNodeId, edgeType, provenance]);
  return {
    id: createGraphEdgeId({
      sourceNodeId,
      targetNodeId,
      edgeType,
      directed,
      createdBy: SEED_CREATED_BY,
      materialHash,
    }),
    canonicalKey: createGraphEdgeCanonicalKey({
      sourceNodeId,
      targetNodeId,
      edgeType,
      directed,
      createdBy: SEED_CREATED_BY,
      materialHash,
    }),
    pairKey: createGraphEdgePairKey({
      sourceNodeId,
      targetNodeId,
      edgeType,
      directed,
    }),
    sourceNodeId,
    targetNodeId,
    edgeType,
    directed,
    confidence: 0.92,
    status: 'ACTIVE',
    createdBy: SEED_CREATED_BY,
    provenance: provenance as Prisma.InputJsonValue,
    materialHash,
    createdAt,
  };
}

async function ensureGraph(prismaClient: PrismaClient, now: Date) {
  const institutionNames = new Set<string>();
  for (const provider of SEEDED_PROVIDERS) {
    institutionNames.add(provider.currentInstitution);
    for (const institution of provider.institutionExpansion.institutions) {
      institutionNames.add(institution);
    }
    if (provider.priorInstitution) {
      institutionNames.add(provider.priorInstitution);
    }
  }

  const edges: Prisma.GraphEdgeUncheckedCreateInput[] = [];

  for (const provider of SEEDED_PROVIDERS) {
    const sourceNodeId = clinicianNodeId(provider.npi);
    for (const [index, institution] of provider.institutionExpansion.institutions.entries()) {
      edges.push(buildEdgeInput(
        sourceNodeId,
        institutionNodeId(institution),
        provider.institutionExpansion.edgeType,
        true,
        daysAgo(now, Math.max(2, 14 - (index * 3))),
        {
          seedMarker: SEED_MARKER,
          npi: provider.npi,
          institution,
          source: 'GRAPH_IGNITION',
        },
      ));
    }
  }

  const providerConnections: Array<[string, string, string]> = [
    ['1174893021', '1649823507', 'co_investigator'],
    ['1174893021', '1760432985', 'co_author'],
    ['1649823507', '1760432985', 'co_author'],
    ['1902301456', '1326504789', 'related_to'],
  ];

  for (const [leftNpi, rightNpi, edgeType] of providerConnections) {
    edges.push(buildEdgeInput(
      clinicianNodeId(leftNpi),
      clinicianNodeId(rightNpi),
      edgeType,
      false,
      daysAgo(now, 9),
      {
        seedMarker: SEED_MARKER,
        source: 'GRAPH_IGNITION',
      },
    ));
  }

  const degreeByNodeId = new Map<string, { inDegree: number; outDegree: number }>();
  for (const edge of edges) {
    const source = degreeByNodeId.get(edge.sourceNodeId) ?? { inDegree: 0, outDegree: 0 };
    const target = degreeByNodeId.get(edge.targetNodeId) ?? { inDegree: 0, outDegree: 0 };
    source.outDegree += 1;
    target.inDegree += 1;
    if (!edge.directed) {
      source.inDegree += 1;
      target.outDegree += 1;
    }
    degreeByNodeId.set(edge.sourceNodeId, source);
    degreeByNodeId.set(edge.targetNodeId, target);
  }

  for (const provider of SEEDED_PROVIDERS) {
    const nodeId = clinicianNodeId(provider.npi);
    const degrees = degreeByNodeId.get(nodeId) ?? { inDegree: 0, outDegree: 0 };
    await upsertGraphNode(prismaClient, {
      id: nodeId,
      canonicalKey: clinicianNodeCanonicalKey(provider.npi),
      type: 'clinician',
      label: `${provider.firstName} ${provider.lastName}`,
      title: provider.specialty,
      colorGroup: 'provider',
      groupKey: provider.specialty,
      tags: [provider.specialty, provider.stateOfPractice, provider.currentInstitution],
      metadata: {
        npi: provider.npi,
        fullName: `${provider.firstName} ${provider.lastName}`,
        specialty: provider.specialty,
        state: provider.stateOfPractice,
        institution: provider.currentInstitution,
        seedMarker: SEED_MARKER,
      } as Prisma.InputJsonValue,
      degree: degrees.inDegree + degrees.outDegree,
      inDegree: degrees.inDegree,
      outDegree: degrees.outDegree,
      sourceRefs: ['seed:investigation'],
      sourceChecksum: checksumFor([provider.npi, provider.specialty, provider.currentInstitution]),
      sourceUpdatedAt: now,
      active: true,
    });
  }

  for (const institution of institutionNames) {
    const nodeId = institutionNodeId(institution);
    const degrees = degreeByNodeId.get(nodeId) ?? { inDegree: 0, outDegree: 0 };
    await upsertGraphNode(prismaClient, {
      id: nodeId,
      canonicalKey: institutionNodeCanonicalKey(institution),
      type: 'institution',
      label: institution,
      title: 'Institution',
      colorGroup: 'institution',
      groupKey: slugify(institution),
      tags: ['institution', 'provider-network'],
      metadata: {
        label: institution,
        seedMarker: SEED_MARKER,
      } as Prisma.InputJsonValue,
      degree: degrees.inDegree + degrees.outDegree,
      inDegree: degrees.inDegree,
      outDegree: degrees.outDegree,
      sourceRefs: ['seed:investigation'],
      sourceChecksum: checksumFor(institution),
      sourceUpdatedAt: now,
      active: true,
    });
  }

  for (const edge of edges) {
    await upsertGraphEdge(prismaClient, edge);
  }
}

async function hasSeedMarker(prismaClient: PrismaClient): Promise<boolean> {
  const marker = await prismaClient.sourceRun.findUnique({
    where: { idempotencyKey: SEED_MARKER },
    select: { id: true },
  });

  return Boolean(marker);
}

async function isInvestigationDbEmpty(prismaClient: PrismaClient): Promise<boolean> {
  const [providers, findings, storylines] = await Promise.all([
    prismaClient.provider.count(),
    prismaClient.investigatorFinding.count(),
    prismaClient.storyline.count(),
  ]);

  return providers === 0 && findings === 0 && storylines === 0;
}

async function createSeedMarker(prismaClient: PrismaClient) {
  await prismaClient.sourceRun.upsert({
    where: { idempotencyKey: SEED_MARKER },
    update: {
      status: 'VERIFIED',
      runSummary: {
        marker: SEED_MARKER,
        version: SEED_PARSER_VERSION,
      } as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
    create: {
      sourceId: 'SEED_IGNITION',
      subjectNpi: SEEDED_PROVIDERS[0]!.npi,
      idempotencyKey: SEED_MARKER,
      status: 'VERIFIED',
      runSummary: {
        marker: SEED_MARKER,
        version: SEED_PARSER_VERSION,
      } as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}

function assertIgnitionCoverage(results: Awaited<ReturnType<typeof runTargetedInvestigators>>) {
  const resultById = new Map(results.map((result) => [result.investigatorId, result]));
  for (const investigatorId of IGNITION_INVESTIGATOR_IDS) {
    const result = resultById.get(investigatorId);
    if (!result || result.persistedFindings.length < 1) {
      throw new Error(`Seed data did not trigger investigator ${investigatorId}.`);
    }
  }
}

async function summarizeSeed(runs: Awaited<ReturnType<typeof runTargetedInvestigators>>): Promise<InvestigationSeedSummary> {
  const findingsByProvider: Record<string, number> = {};
  const storylinesByProvider: Record<string, number> = {};

  for (const provider of SEEDED_PROVIDERS) {
    const [findings, storylines] = await Promise.all([
      listInvestigatorFindings({
        provider: provider.npi,
        limit: 25,
        offset: 0,
      }),
      listStorylines({
        provider: provider.npi,
        limit: 25,
        sync: false,
      }),
    ]);

    findingsByProvider[provider.npi] = findings.findings.length;
    storylinesByProvider[provider.npi] = storylines.storylines.length;
  }

  return {
    seeded: true,
    marker: SEED_MARKER,
    providers: SEEDED_PROVIDERS.length,
    findingsByProvider,
    storylinesByProvider,
    investigatorRuns: runs.map((result) => ({
      investigatorId: result.investigatorId,
      findingsGenerated: result.findingsGenerated,
      findingsCreated: result.findingsCreated,
      findingsUpdated: result.findingsUpdated,
    })),
  };
}

export async function seedInvestigationData(
  prismaClient: PrismaClient = prisma,
  logger?: SeedLogger,
): Promise<InvestigationSeedSummary> {
  if (await hasSeedMarker(prismaClient)) {
    return {
      seeded: false,
      marker: SEED_MARKER,
      providers: SEEDED_PROVIDERS.length,
      findingsByProvider: {},
      storylinesByProvider: {},
      investigatorRuns: [],
    };
  }

  const now = new Date();

  for (const provider of SEEDED_PROVIDERS) {
    await ensureProviderProfile(prismaClient, provider);
    await ensureProviderEvidence(prismaClient, provider, now);
  }

  await ensureGraph(prismaClient, now);

  const runs = await runTargetedInvestigators({
    entityType: 'provider',
    targetEntityIds: SEEDED_PROVIDERS.map((provider) => provider.npi),
    investigatorIds: [...IGNITION_INVESTIGATOR_IDS],
    trigger: 'manual',
    metadata: {
      source: SEED_MARKER,
      parserVersion: SEED_PARSER_VERSION,
    },
  });

  assertIgnitionCoverage(runs);
  await listStorylines({ limit: 200, sync: true });
  await createSeedMarker(prismaClient);

  const summary = await summarizeSeed(runs);
  logger?.('info', 'investigation_seed.completed', {
    marker: SEED_MARKER,
    providers: summary.providers,
    findingsByProvider: summary.findingsByProvider,
    storylinesByProvider: summary.storylinesByProvider,
  });
  return summary;
}

export async function ensureInvestigationSeedDataBootstrapped(options: {
  prismaClient?: PrismaClient;
  logger?: SeedLogger;
} = {}): Promise<InvestigationSeedSummary | null> {
  const prismaClient = options.prismaClient ?? prisma;
  const logger = options.logger;

  if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL) {
    return null;
  }

  if (await hasSeedMarker(prismaClient)) {
    return null;
  }

  if (!(await isInvestigationDbEmpty(prismaClient))) {
    logger?.('info', 'investigation_seed.skipped', {
      marker: SEED_MARKER,
      reason: 'database_not_empty',
    });
    return null;
  }

  logger?.('info', 'investigation_seed.starting', {
    marker: SEED_MARKER,
    providers: SEEDED_PROVIDERS.length,
  });
  return seedInvestigationData(prismaClient, logger);
}

export async function bootstrapInvestigationSeedIfNeeded(
  prismaClient: PrismaClient = prisma,
  logger?: SeedLogger,
): Promise<InvestigationSeedSummary | null> {
  return ensureInvestigationSeedDataBootstrapped({
    prismaClient,
    logger,
  });
}
