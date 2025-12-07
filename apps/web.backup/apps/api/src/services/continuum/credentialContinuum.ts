import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface CredentialContinuumData {
  stages: Array<{
    stage: 'training' | 'resident' | 'attending' | 'specialist' | 'senior';
    credentials: string[];
    regulators: string[];
    evidence: string[];
  }>;
  mappings: Record<string, {
    chains: string[];
    regulators: string[];
    jurisdictions: string[];
  }>;
  drift: number;
  forecast: Array<{
    credential: string;
    probability: number;
    timeframe: string;
  }>;
}

/**
 * Task 360.2 — Life-stage credential classifier
 * Classify credentials by role stage: training → attending → specialist
 */
export async function classifyCredentialsByStage(
  clinicianId: string,
): Promise<CredentialContinuumData['stages']> {
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId, revokedAt: null },
  });

  const stages: CredentialContinuumData['stages'] = [
    { stage: 'training', credentials: [], regulators: [], evidence: [] },
    { stage: 'resident', credentials: [], regulators: [], evidence: [] },
    { stage: 'attending', credentials: [], regulators: [], evidence: [] },
    { stage: 'specialist', credentials: [], regulators: [], evidence: [] },
    { stage: 'senior', credentials: [], regulators: [], evidence: [] },
  ];

  // Classify licenses by typical stage
  licenses.forEach(license => {
    const credId = `${license.authority}-${license.licenseNumber}`;

    // Simple classification based on specialty/country
    if (license.country === 'US' && license.authority.includes('Board')) {
      stages[3].credentials.push(credId); // specialist
      stages[3].regulators.push(license.authority);
    } else if (license.authority.includes('Medical Board')) {
      stages[2].credentials.push(credId); // attending
      stages[2].regulators.push(license.authority);
    } else {
      stages[1].credentials.push(credId); // resident/training
      stages[1].regulators.push(license.authority);
    }
  });

  // Add VCs
  credentials.forEach(cred => {
    const type = cred.type.toLowerCase();
    if (type.includes('specialty') || type.includes('board')) {
      stages[3].credentials.push(cred.credentialId);
    } else if (type.includes('license') || type.includes('attending')) {
      stages[2].credentials.push(cred.credentialId);
    }
  });

  return stages;
}

/**
 * Task 360.3 — Continuum mapping engine v4
 * Map credentials across chains and regulators
 */
export async function mapCredentialContinuum(
  clinicianId: string,
): Promise<Record<string, any>> {
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId },
  });

  const mappings: Record<string, any> = {};

  licenses.forEach(license => {
    const key = `${license.authority}-${license.licenseNumber}`;
    mappings[key] = {
      chains: license.anchorNetwork ? [license.anchorNetwork] : [],
      regulators: [license.authority],
      jurisdictions: [license.country],
      anchorTx: license.anchorTxHash,
    };
  });

  credentials.forEach(cred => {
    mappings[cred.credentialId] = {
      chains: [],
      regulators: [],
      jurisdictions: [],
      type: cred.type,
    };
  });

  return mappings;
}

/**
 * Task 360.5 — Evidence-continuum fusion layer
 * Link evidence over entire continuum
 */
export async function fuseEvidenceContinuum(
  clinicianId: string,
): Promise<string[]> {
  const evidencePacks = await prisma.evidencePack.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });

  const evidenceIds: string[] = [];
  evidencePacks.forEach(pack => {
    const items = pack.items as { id?: string }[];
    items.forEach(item => {
      if (item.id) evidenceIds.push(item.id);
    });
  });

  return evidenceIds;
}

/**
 * Task 360.6 — Cross-border credential alignment
 * Normalize continuum for global mobility
 */
export async function alignCrossBorderCredentials(
  clinicianId: string,
): Promise<Record<string, any>> {
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  const alignment: Record<string, any> = {};

  licenses.forEach(license => {
    if (!alignment[license.country]) {
      alignment[license.country] = [];
    }
    alignment[license.country].push({
      authority: license.authority,
      licenseNumber: license.licenseNumber,
      equivalency: license.equivalencyTarget,
      level: license.equivalencyLevel,
    });
  });

  return alignment;
}

/**
 * Task 360.7 — Drift-correction engine
 * Fix inconsistencies across continuum
 */
export async function detectContinuumDrift(
  clinicianId: string,
): Promise<number> {
  const driftEvents = await prisma.driftEvent.findMany({
    where: {
      clinicianId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  // Calculate drift score based on recent drift events
  const driftScore = Math.min(1, driftEvents.length * 0.1);
  return driftScore;
}

/**
 * Task 360.8 — Continuum forecast engine
 * Predict what credentials clinician will need next
 */
export async function forecastCredentialNeeds(
  clinicianId: string,
): Promise<CredentialContinuumData['forecast']> {
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  const forecast: CredentialContinuumData['forecast'] = [];

  // Predict renewals
  licenses.forEach(license => {
    if (license.expiresAt) {
      const daysUntilExpiry = Math.floor((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 365 && daysUntilExpiry > 0) {
        forecast.push({
          credential: `${license.authority} Renewal`,
          probability: 0.9,
          timeframe: `${Math.floor(daysUntilExpiry / 30)} months`,
        });
      }
    }
  });

  // Predict new credentials based on patterns
  if (licenses.length > 0) {
    forecast.push({
      credential: 'Specialty Certification',
      probability: 0.6,
      timeframe: '6-12 months',
    });
  }

  return forecast;
}

/**
 * Get complete credential continuum data
 */
export async function getCredentialContinuum(
  clinicianId: string,
): Promise<CredentialContinuumData> {
  const continuum = await prisma.credentialContinuum.findUnique({
    where: { clinicianId },
  });

  if (continuum) {
    return continuum.continuum as CredentialContinuumData;
  }

  // Create initial continuum
  const stages = await classifyCredentialsByStage(clinicianId);
  const mappings = await mapCredentialContinuum(clinicianId);
  const drift = await detectContinuumDrift(clinicianId);
  const forecast = await forecastCredentialNeeds(clinicianId);

  const data: CredentialContinuumData = {
    stages,
    mappings,
    drift,
    forecast,
  };

  await prisma.credentialContinuum.create({
    data: {
      clinicianId,
      continuum: data,
    },
  });

  return data;
}

/**
 * Task 360.9 — Continuum export pack
 * Unified, regulator-ready timeline
 */
export async function exportContinuumPack(
  clinicianId: string,
): Promise<{
  continuum: CredentialContinuumData;
  timeline: Array<{ date: string; event: string; credential: string }>;
  summary: string;
}> {
  const continuum = await getCredentialContinuum(clinicianId);

  // Build timeline from licenses and credentials
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });

  const timeline = licenses.map(license => ({
    date: license.createdAt.toISOString(),
    event: 'License Issued',
    credential: `${license.authority} - ${license.licenseNumber}`,
  }));

  const summary = `Continuum mapped across ${continuum.stages.length} life stages.
    ${licenses.length} credentials tracked.
    Drift score: ${(continuum.drift * 100).toFixed(1)}%.`;

  return {
    continuum,
    timeline,
    summary,
  };
}

/**
 * Task 360.10 — Anchor continuum snapshot
 */
export async function anchorContinuumSnapshot(
  clinicianId: string,
): Promise<string> {
  const continuum = await getCredentialContinuum(clinicianId);

  const receipt = await chainClient.submitAuditEvent({
    eventType: 'credentialContinuumAnchored',
    correlationId: clinicianId,
    tags: ['credential', 'continuum', 'snapshot'],
    payload: {
      clinicianId,
      stageCount: continuum.stages.length,
      credentialCount: continuum.stages.reduce((sum, s) => sum + s.credentials.length, 0),
      drift: continuum.drift,
      anchoredAt: new Date().toISOString(),
    },
  });

  return receipt.txHash || receipt.eventId;
}

