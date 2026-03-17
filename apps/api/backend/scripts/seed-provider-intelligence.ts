#!/usr/bin/env ts-node
/**
 * seed-provider-intelligence.ts
 *
 * Seeds the minimum dataset for all 10 investigators to scan and emit findings:
 *   User → PersonProfile → TrustScoreHistory → ClaimRecord → GraphNode → GraphEdge
 *
 * Idempotent: checks for existing User by clerkUserId before creating.
 *
 * Usage:
 *   cd apps/api/backend
 *   DATABASE_URL="..." pnpm exec ts-node scripts/seed-provider-intelligence.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function uuid(): string {
  return crypto.randomUUID();
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Mirror of createGraphNodeId from graph-engine/ids.ts */
function graphNodeId(type: string, sourceKind: string, sourceId: string): string {
  const canonical = JSON.stringify({ type, sourceKind, sourceId });
  return `gn_${sha256(canonical).slice(0, 24)}`;
}

function graphEdgeId(sourceNodeId: string, targetNodeId: string, edgeType: string): string {
  const canonical = JSON.stringify({ sourceNodeId, targetNodeId, edgeType });
  return `ge_${sha256(canonical).slice(0, 24)}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

/* ── Provider Profiles ──────────────────────────────────────────────────────── */

interface SeedProvider {
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  stateOfPractice: string;
  clerkUserId: string; // deterministic fake Clerk ID for seeding
  email: string;
  /** Conditions this provider should trigger */
  conditions: string[];
}

const PROVIDERS: SeedProvider[] = [
  {
    npi: '1003000126',
    firstName: 'Sarah',
    lastName: 'Chen',
    specialty: 'Internal Medicine',
    stateOfPractice: 'CA',
    clerkUserId: 'seed_user_chen',
    email: 'seed.chen@vitalcv.local',
    conditions: ['trust_decline', 'divergence'],
  },
  {
    npi: '1003000134',
    firstName: 'Michael',
    lastName: 'Rivera',
    specialty: 'Cardiovascular Disease',
    stateOfPractice: 'TX',
    clerkUserId: 'seed_user_rivera',
    email: 'seed.rivera@vitalcv.local',
    conditions: ['research_momentum', 'clinical_trial'],
  },
  {
    npi: '1003000142',
    firstName: 'Emily',
    lastName: 'Nakamura',
    specialty: 'Neurology',
    stateOfPractice: 'NY',
    clerkUserId: 'seed_user_nakamura',
    email: 'seed.nakamura@vitalcv.local',
    conditions: ['network_emergence', 'research_momentum'],
  },
  {
    npi: '1003000159',
    firstName: 'James',
    lastName: 'Okonkwo',
    specialty: 'Family Medicine',
    stateOfPractice: 'IL',
    clerkUserId: 'seed_user_okonkwo',
    email: 'seed.okonkwo@vitalcv.local',
    conditions: ['workforce_shift', 'trust_decline'],
  },
  {
    npi: '1003000167',
    firstName: 'Priya',
    lastName: 'Sharma',
    specialty: 'Psychiatry',
    stateOfPractice: 'MA',
    clerkUserId: 'seed_user_sharma',
    email: 'seed.sharma@vitalcv.local',
    conditions: ['industry_influence', 'divergence'],
  },
  {
    npi: '1003000175',
    firstName: 'David',
    lastName: 'Kim',
    specialty: 'Orthopedic Surgery',
    stateOfPractice: 'FL',
    clerkUserId: 'seed_user_kim',
    email: 'seed.kim@vitalcv.local',
    conditions: ['sanctions', 'workforce_pressure'],
  },
  {
    npi: '1003000183',
    firstName: 'Alexandra',
    lastName: 'Petrov',
    specialty: 'Pediatrics',
    stateOfPractice: 'WA',
    clerkUserId: 'seed_user_petrov',
    email: 'seed.petrov@vitalcv.local',
    conditions: ['institution_expansion', 'network_emergence'],
  },
  {
    npi: '1003000191',
    firstName: 'Robert',
    lastName: 'Washington',
    specialty: 'Emergency Medicine',
    stateOfPractice: 'GA',
    clerkUserId: 'seed_user_washington',
    email: 'seed.washington@vitalcv.local',
    conditions: ['workforce_shift', 'sanctions'],
  },
  {
    npi: '1003000209',
    firstName: 'Maria',
    lastName: 'Gonzalez',
    specialty: 'Obstetrics & Gynecology',
    stateOfPractice: 'AZ',
    clerkUserId: 'seed_user_gonzalez',
    email: 'seed.gonzalez@vitalcv.local',
    conditions: ['clinical_trial', 'trust_decline'],
  },
  {
    npi: '1003000217',
    firstName: 'Thomas',
    lastName: 'Anderson',
    specialty: 'Anesthesiology',
    stateOfPractice: 'CO',
    clerkUserId: 'seed_user_anderson',
    email: 'seed.anderson@vitalcv.local',
    conditions: ['industry_influence', 'institution_expansion'],
  },
];

/* ── Seed Functions ─────────────────────────────────────────────────────────── */

async function seedUserAndProfile(p: SeedProvider): Promise<{ userId: string; profileId: string }> {
  const existing = await prisma.user.findUnique({ where: { clerkUserId: p.clerkUserId } });
  if (existing) {
    const profile = await prisma.personProfile.findUnique({ where: { userId: existing.id } });
    console.log(`  [skip] ${p.firstName} ${p.lastName} — already exists`);
    return { userId: existing.id, profileId: profile?.id ?? '' };
  }

  const userId = uuid();
  const profileId = uuid();

  await prisma.user.create({
    data: {
      id: userId,
      clerkUserId: p.clerkUserId,
      email: p.email,
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
  });

  await prisma.personProfile.create({
    data: {
      id: profileId,
      userId,
      npi: p.npi,
      npiType: 'TYPE_1',
      firstName: p.firstName,
      lastName: p.lastName,
      specialty: p.specialty,
      stateOfPractice: p.stateOfPractice,
    },
  });

  return { userId, profileId };
}

async function seedTrustScoreHistory(npi: string, conditions: string[]): Promise<number> {
  let count = 0;

  // Every provider gets a baseline trust score
  await prisma.trustScoreHistory.create({
    data: {
      subjectType: 'NPI',
      subjectId: npi,
      previousScore: null,
      newScore: 82,
      scoreDelta: 0,
      triggerEvent: 'initial_assessment',
      confidence: 0.85,
      band: 'L3',
      methodologyVersion: '243.1',
      recordedAt: daysAgo(30),
    },
  });
  count++;

  if (conditions.includes('trust_decline')) {
    // Create a significant score drop (triggers trust_decline investigator)
    await prisma.trustScoreHistory.create({
      data: {
        subjectType: 'NPI',
        subjectId: npi,
        previousScore: 82,
        newScore: 68,
        scoreDelta: -14,
        triggerEvent: 'credential_expiry_detected',
        confidence: 0.9,
        band: 'L2',
        methodologyVersion: '243.1',
        recordedAt: daysAgo(3),
      },
    });
    count++;
  } else {
    // Stable score for non-decline providers
    await prisma.trustScoreHistory.create({
      data: {
        subjectType: 'NPI',
        subjectId: npi,
        previousScore: 82,
        newScore: 85,
        scoreDelta: 3,
        triggerEvent: 'verification_refresh',
        confidence: 0.88,
        band: 'L3',
        methodologyVersion: '243.1',
        recordedAt: daysAgo(5),
      },
    });
    count++;
  }

  return count;
}

async function seedClaims(npi: string, provider: SeedProvider): Promise<number> {
  const claims: Array<{
    claimType: string;
    value: Record<string, unknown>;
    sourceId: string;
    trustTier: string;
    confidenceScore: number;
  }> = [];

  // Every provider: specialty claim
  claims.push({
    claimType: 'SPECIALTY',
    value: { specialty: provider.specialty, boardCertified: true },
    sourceId: 'NPPES',
    trustTier: 'TIER_1',
    confidenceScore: 0.95,
  });

  // Every provider: practice location
  claims.push({
    claimType: 'PRACTICE_LOCATION',
    value: { state: provider.stateOfPractice, type: 'primary' },
    sourceId: 'NPPES',
    trustTier: 'TIER_1',
    confidenceScore: 0.92,
  });

  // Affiliation claim
  const institutions: Record<string, string> = {
    CA: 'Stanford Health Care',
    TX: 'Texas Medical Center',
    NY: 'Mount Sinai Health System',
    IL: 'Northwestern Medicine',
    MA: 'Massachusetts General Hospital',
    FL: 'Mayo Clinic Jacksonville',
    WA: 'UW Medicine',
    GA: 'Emory Healthcare',
    AZ: 'Mayo Clinic Arizona',
    CO: 'UCHealth',
  };

  claims.push({
    claimType: 'INSTITUTION_AFFILIATION',
    value: {
      institution: institutions[provider.stateOfPractice] ?? 'Regional Medical Center',
      role: 'attending',
    },
    sourceId: 'STATE_BOARD',
    trustTier: 'TIER_2',
    confidenceScore: 0.88,
  });

  // Research claims for research-condition providers
  if (provider.conditions.includes('research_momentum')) {
    claims.push({
      claimType: 'PUBLICATION',
      value: { title: 'Novel biomarker validation in clinical settings', year: 2025 },
      sourceId: 'PUBMED',
      trustTier: 'TIER_2',
      confidenceScore: 0.91,
    });
    claims.push({
      claimType: 'PUBLICATION',
      value: { title: 'Multi-center randomized trial outcomes', year: 2026 },
      sourceId: 'CLINICAL_TRIALS',
      trustTier: 'TIER_2',
      confidenceScore: 0.87,
    });
    claims.push({
      claimType: 'GRANT',
      value: { agency: 'NIH', type: 'R01', status: 'active' },
      sourceId: 'NIH_REPORTER',
      trustTier: 'TIER_1',
      confidenceScore: 0.95,
    });
  }

  // Clinical trial claims
  if (provider.conditions.includes('clinical_trial')) {
    claims.push({
      claimType: 'CLINICAL_TRIAL',
      value: {
        nctId: `NCT${Math.floor(10000000 + parseInt(npi.slice(-4)) * 1000)}`,
        role: 'Principal Investigator',
        phase: 'Phase III',
        status: 'Recruiting',
      },
      sourceId: 'CLINICAL_TRIALS',
      trustTier: 'TIER_2',
      confidenceScore: 0.93,
    });
  }

  // Industry claims
  if (provider.conditions.includes('industry_influence')) {
    claims.push({
      claimType: 'INDUSTRY_PAYMENT',
      value: {
        manufacturer: 'Medtronic',
        paymentType: 'consulting',
        amount: 45000,
        year: 2025,
      },
      sourceId: 'OPEN_PAYMENTS',
      trustTier: 'TIER_1',
      confidenceScore: 0.98,
    });
  }

  // Divergence: multi-state practice
  if (provider.conditions.includes('divergence')) {
    const otherStates = ['NY', 'CA', 'TX', 'FL'].filter((s) => s !== provider.stateOfPractice);
    claims.push({
      claimType: 'PRACTICE_LOCATION',
      value: { state: otherStates[0], type: 'secondary' },
      sourceId: 'STATE_BOARD',
      trustTier: 'TIER_2',
      confidenceScore: 0.78,
    });
  }

  for (const claim of claims) {
    await prisma.claimRecord.create({
      data: {
        claimId: `claim_${sha256(`${npi}_${claim.claimType}_${JSON.stringify(claim.value)}`).slice(0, 16)}`,
        subjectNpi: npi,
        claimType: claim.claimType,
        value: JSON.parse(JSON.stringify(claim.value)),
        sourceId: claim.sourceId,
        trustTier: claim.trustTier,
        confidenceLabel: claim.confidenceScore >= 0.9 ? 'HIGH' : 'MODERATE',
        confidenceScore: claim.confidenceScore,
        parserVersion: 'v2.1.0',
        createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
      },
    });
  }

  return claims.length;
}

async function seedGraphNodes(providers: SeedProvider[]): Promise<{ nodes: number; edges: number }> {
  let nodeCount = 0;
  let edgeCount = 0;

  // Create a clinician node for each provider
  for (const p of providers) {
    const nodeId = graphNodeId('clinician', 'npi', p.npi);
    const existing = await prisma.graphNode.findUnique({ where: { id: nodeId } });
    if (existing) continue;

    await prisma.graphNode.create({
      data: {
        id: nodeId,
        canonicalKey: JSON.stringify({ type: 'clinician', sourceKind: 'npi', sourceId: p.npi }),
        type: 'clinician',
        label: `Dr. ${p.firstName} ${p.lastName}`,
        title: `${p.specialty} — ${p.stateOfPractice}`,
        colorGroup: 'clinician',
        groupKey: p.stateOfPractice,
        tags: [p.specialty.toLowerCase().replace(/\s+/g, '_'), p.stateOfPractice.toLowerCase()],
        metadata: JSON.parse(JSON.stringify({ npi: p.npi, specialty: p.specialty })),
        degree: 0,
        inDegree: 0,
        outDegree: 0,
      },
    });
    nodeCount++;
  }

  // Create institution nodes
  const institutionPairs: Array<[string, string]> = [
    ['Stanford Health Care', 'CA'],
    ['Texas Medical Center', 'TX'],
    ['Mount Sinai Health System', 'NY'],
    ['Northwestern Medicine', 'IL'],
    ['Massachusetts General Hospital', 'MA'],
  ];

  for (const [name, state] of institutionPairs) {
    const instNodeId = graphNodeId('institution', 'name', name);
    const existing = await prisma.graphNode.findUnique({ where: { id: instNodeId } });
    if (existing) continue;

    await prisma.graphNode.create({
      data: {
        id: instNodeId,
        canonicalKey: JSON.stringify({ type: 'institution', sourceKind: 'name', sourceId: name }),
        type: 'institution',
        label: name,
        title: `Healthcare System — ${state}`,
        colorGroup: 'institution',
        groupKey: state,
        tags: ['hospital', state.toLowerCase()],
        metadata: JSON.parse(JSON.stringify({ state })),
        degree: 0,
      },
    });
    nodeCount++;
  }

  // Create edges: clinician → institution affiliation
  for (const p of providers) {
    const clinicianNodeId = graphNodeId('clinician', 'npi', p.npi);
    const inst = institutionPairs.find(([, state]) => state === p.stateOfPractice);
    if (!inst) continue;

    const instNodeId = graphNodeId('institution', 'name', inst[0]);
    const edgeId = graphEdgeId(clinicianNodeId, instNodeId, 'affiliated_with');
    const pairKey = JSON.stringify({
      sourceNodeId: clinicianNodeId,
      targetNodeId: instNodeId,
      edgeType: 'affiliated_with',
    });

    const existing = await prisma.graphEdge.findUnique({ where: { id: edgeId } });
    if (existing) continue;

    await prisma.graphEdge.create({
      data: {
        id: edgeId,
        canonicalKey: `${clinicianNodeId}:${instNodeId}:affiliated_with`,
        pairKey,
        sourceNodeId: clinicianNodeId,
        targetNodeId: instNodeId,
        edgeType: 'affiliated_with',
        directed: true,
        confidence: 0.9,
        status: 'ACTIVE',
        createdBy: 'seed_script',
      },
    });
    edgeCount++;
  }

  // Create collaboration edges for network_emergence providers
  const networkProviders = providers.filter((p) => p.conditions.includes('network_emergence'));
  for (let i = 0; i < networkProviders.length; i++) {
    // Connect to other providers in the list
    for (let j = i + 1; j < Math.min(i + 3, providers.length); j++) {
      const sourceId = graphNodeId('clinician', 'npi', networkProviders[i]!.npi);
      const targetId = graphNodeId('clinician', 'npi', providers[j]!.npi);
      const edgeId = graphEdgeId(sourceId, targetId, 'co_author');
      const pairKey = JSON.stringify({
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        edgeType: 'co_author',
      });

      const existing = await prisma.graphEdge.findUnique({ where: { id: edgeId } });
      if (existing) continue;

      await prisma.graphEdge.create({
        data: {
          id: edgeId,
          canonicalKey: `${sourceId}:${targetId}:co_author`,
          pairKey,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          edgeType: 'co_author',
          directed: false,
          confidence: 0.85,
          status: 'ACTIVE',
          createdBy: 'seed_script',
        },
      });
      edgeCount++;
    }
  }

  // Update degree counts
  for (const p of providers) {
    const nodeId = graphNodeId('clinician', 'npi', p.npi);
    const [outEdges, inEdges] = await Promise.all([
      prisma.graphEdge.count({ where: { sourceNodeId: nodeId } }),
      prisma.graphEdge.count({ where: { targetNodeId: nodeId } }),
    ]);
    await prisma.graphNode.update({
      where: { id: nodeId },
      data: { degree: outEdges + inEdges, outDegree: outEdges, inDegree: inEdges },
    }).catch(() => { /* node might not exist */ });
  }

  return { nodes: nodeCount, edges: edgeCount };
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  VitalCV Intelligence Seed — Provider + Signals     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();

  let usersCreated = 0;
  let trustRecords = 0;
  let claimRecords = 0;

  // Phase 1: Users + PersonProfiles
  console.log('▸ Phase 1: Users + PersonProfiles');
  for (const p of PROVIDERS) {
    const { userId } = await seedUserAndProfile(p);
    if (userId) usersCreated++;
  }
  console.log(`  → ${usersCreated} users/profiles\n`);

  // Phase 2: TrustScoreHistory
  console.log('▸ Phase 2: Trust Score History');
  for (const p of PROVIDERS) {
    const count = await seedTrustScoreHistory(p.npi, p.conditions);
    trustRecords += count;
  }
  console.log(`  → ${trustRecords} trust score records\n`);

  // Phase 3: ClaimRecords
  console.log('▸ Phase 3: Claim Records');
  for (const p of PROVIDERS) {
    const count = await seedClaims(p.npi, p);
    claimRecords += count;
  }
  console.log(`  → ${claimRecords} claim records\n`);

  // Phase 4: Graph Nodes + Edges
  console.log('▸ Phase 4: Knowledge Graph');
  const { nodes, edges } = await seedGraphNodes(PROVIDERS);
  console.log(`  → ${nodes} nodes, ${edges} edges\n`);

  // Phase 5: Also create Provider records (used by some APIs)
  console.log('▸ Phase 5: Provider records');
  let providerRecords = 0;
  for (const p of PROVIDERS) {
    const existing = await prisma.provider.findUnique({ where: { npi: p.npi } });
    if (existing) continue;
    await prisma.provider.create({
      data: {
        npi: p.npi,
        fullName: `Dr. ${p.firstName} ${p.lastName}`,
        providerType: 'Individual',
        taxonomyCode: '207R00000X',
        stateOfPractice: p.stateOfPractice,
      },
    });
    providerRecords++;
  }
  console.log(`  → ${providerRecords} provider records\n`);

  // Summary
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Seed Complete                                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Providers:        ${PROVIDERS.length.toString().padStart(3)}                              ║`);
  console.log(`║  Trust scores:     ${trustRecords.toString().padStart(3)}                              ║`);
  console.log(`║  Claims:           ${claimRecords.toString().padStart(3)}                              ║`);
  console.log(`║  Graph nodes:      ${nodes.toString().padStart(3)}                              ║`);
  console.log(`║  Graph edges:      ${edges.toString().padStart(3)}                              ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Canonical test NPI: 1003000126  (Dr. Sarah Chen)   ║');
  console.log('║                                                      ║');
  console.log('║  Open:                                                ║');
  console.log('║    /findings                                          ║');
  console.log('║    /providers                                         ║');
  console.log('║    /investigations?npi=1003000126                     ║');
  console.log('║    /storylines                                        ║');
  console.log('║    /intelligence                                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Trigger scan:                                        ║');
  console.log('║    POST /api/investigators/scan                       ║');
  console.log('║    or wait for 30-min auto-scan cycle                 ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

main()
  .catch((err) => {
    console.error('[Seed] Fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
