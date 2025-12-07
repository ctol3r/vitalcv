import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface IdentityContinuityData {
  multiWallet: {
    wallets: Array<{ walletId: string; did: string; lastUsed: string; consistency: number }>;
    consistencyScore: number;
  };
  crossCountry: {
    countries: string[];
    identityGraph: Record<string, unknown>;
    continuityScore: number;
  };
  credentialLineage: {
    credentials: Array<{ credentialId: string; evolution: Array<{ date: string; status: string }> }>;
    continuityScore: number;
  };
  didRotation: {
    rotations: Array<{ oldDid: string; newDid: string; date: string; trustMaintained: boolean }>;
    continuityScore: number;
  };
}

/**
 * Track DID consistency across wallets/devices
 */
export async function trackMultiWalletContinuity(clinicianId: string): Promise<IdentityContinuityData['multiWallet']> {
  const wallets = await prisma.walletDevice.findMany({
    where: { clinicianId },
  });

  const walletData = wallets.map((w) => ({
    walletId: w.deviceId,
    did: (w.metadata as any)?.did ?? 'unknown',
    lastUsed: w.lastUsedAt?.toISOString() ?? w.createdAt.toISOString(),
    consistency: 1.0, // Mock - would check DID consistency
  }));

  // Check for DID consistency
  const dids = walletData.map((w) => w.did).filter((d) => d !== 'unknown');
  const uniqueDids = new Set(dids);
  const consistencyScore = dids.length > 0 ? (uniqueDids.size === 1 ? 1.0 : 0.7) : 0.5;

  return {
    wallets: walletData,
    consistencyScore,
  };
}

/**
 * Ensure identity graph spans US, UK, AU, EU
 */
export async function trackCrossCountryContinuity(clinicianId: string): Promise<IdentityContinuityData['crossCountry']> {
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId },
  });

  const countries = [...new Set(licenses.map((l) => l.country))];

  // Build identity graph
  const identityGraph: Record<string, unknown> = {
    clinicianId,
    countries,
    licenses: licenses.map((l) => ({
      country: l.country,
      authority: l.authority,
      licenseNumber: l.licenseNumber,
      status: l.status,
    })),
  };

  // Check continuity across countries
  const requiredRegions = ['US', 'UK', 'AU', 'EU'];
  const hasContinuity = requiredRegions.some((region) => {
    if (region === 'EU') {
      return countries.some((c) => ['DE', 'FR', 'IT', 'ES'].includes(c));
    }
    return countries.includes(region);
  });

  const continuityScore = hasContinuity ? 0.9 : countries.length > 0 ? 0.6 : 0.3;

  return {
    countries,
    identityGraph,
    continuityScore,
  };
}

/**
 * Track how each credential evolves across roles
 */
export async function trackCredentialLineageContinuity(clinicianId: string): Promise<IdentityContinuityData['credentialLineage']> {
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId },
    orderBy: { issuedAt: 'desc' },
  });

  const credentialLineage = credentials.map((cred) => {
    const evolution: Array<{ date: string; status: string }> = [
      {
        date: cred.issuedAt.toISOString(),
        status: 'issued',
      },
    ];

    if (cred.revokedAt) {
      evolution.push({
        date: cred.revokedAt.toISOString(),
        status: 'revoked',
      });
    } else {
      evolution.push({
        date: new Date().toISOString(),
        status: 'active',
      });
    }

    return {
      credentialId: cred.credentialId,
      evolution,
    };
  });

  // Calculate continuity score based on active credentials
  const activeCredentials = credentials.filter((c) => !c.revokedAt);
  const continuityScore = credentials.length > 0 ? activeCredentials.length / credentials.length : 0;

  return {
    credentials: credentialLineage,
    continuityScore,
  };
}

/**
 * Ensure DID rotations maintain identity trust
 */
export async function trackDIDRotationContinuity(clinicianId: string): Promise<IdentityContinuityData['didRotation']> {
  // Get DID recovery records (proxy for rotations)
  const recoveries = await prisma.dIDRecovery.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });

  const rotations = recoveries.map((r) => ({
    oldDid: 'unknown', // Would track previous DID
    newDid: r.recoveryDid,
    date: r.createdAt.toISOString(),
    trustMaintained: true, // Mock - would verify trust chain
  }));

  // Calculate continuity score
  const continuityScore = rotations.length > 0 ? 0.9 : 1.0; // No rotations = perfect continuity

  return {
    rotations,
    continuityScore,
  };
}

/**
 * Build complete identity continuity data
 */
export async function buildIdentityContinuity(clinicianId: string): Promise<IdentityContinuityData> {
  const [multiWallet, crossCountry, credentialLineage, didRotation] = await Promise.all([
    trackMultiWalletContinuity(clinicianId),
    trackCrossCountryContinuity(clinicianId),
    trackCredentialLineageContinuity(clinicianId),
    trackDIDRotationContinuity(clinicianId),
  ]);

  return {
    multiWallet,
    crossCountry,
    credentialLineage,
    didRotation,
  };
}

/**
 * Get or create identity continuity
 */
export async function getOrCreateIdentityContinuity(clinicianId: string): Promise<IdentityContinuityData> {
  let continuity = await prisma.identityContinuity.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!continuity || isContinuityStale(continuity.updatedAt)) {
    const continuityData = await buildIdentityContinuity(clinicianId);

    if (continuity) {
      await prisma.identityContinuity.update({
        where: { id: continuity.id },
        data: {
          continuity: continuityData as unknown as any,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.identityContinuity.create({
        data: {
          clinicianId,
          continuity: continuityData as unknown as any,
        },
      });
    }

    return continuityData;
  }

  return continuity.continuity as unknown as IdentityContinuityData;
}

function isContinuityStale(updatedAt: Date): boolean {
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24;
}

/**
 * Identify identity breaks/duplications
 */
export async function detectContinuityBreaches(clinicianId: string): Promise<Array<{
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
}>> {
  const continuity = await getOrCreateIdentityContinuity(clinicianId);
  const breaches: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: Record<string, unknown>;
  }> = [];

  // Check wallet DID consistency
  if (continuity.multiWallet.consistencyScore < 0.8) {
    breaches.push({
      type: 'wallet_did_mismatch',
      severity: 'high',
      message: 'Inconsistent DIDs across wallets',
      details: {
        consistencyScore: continuity.multiWallet.consistencyScore,
        walletCount: continuity.multiWallet.wallets.length,
      },
    });
  }

  // Check credential lineage breaks
  if (continuity.credentialLineage.continuityScore < 0.7) {
    breaches.push({
      type: 'credential_lineage_break',
      severity: 'medium',
      message: 'Credential lineage continuity issues detected',
      details: {
        continuityScore: continuity.credentialLineage.continuityScore,
      },
    });
  }

  // Check DID rotation trust
  const untrustedRotations = continuity.didRotation.rotations.filter((r) => !r.trustMaintained);
  if (untrustedRotations.length > 0) {
    breaches.push({
      type: 'did_rotation_trust_break',
      severity: 'critical',
      message: `${untrustedRotations.length} DID rotations with broken trust chain`,
      details: {
        untrustedCount: untrustedRotations.length,
      },
    });
  }

  return breaches;
}

/**
 * Predict future identity inconsistencies
 */
export async function predictContinuityIssues(clinicianId: string): Promise<Array<{
  type: string;
  probability: number;
  predictedDate: string;
  message: string;
}>> {
  const continuity = await getOrCreateIdentityContinuity(clinicianId);
  const predictions: Array<{
    type: string;
    probability: number;
    predictedDate: string;
    message: string;
  }> = [];

  // Predict wallet consistency issues
  if (continuity.multiWallet.consistencyScore < 0.9) {
    predictions.push({
      type: 'wallet_consistency_degradation',
      probability: 0.6,
      predictedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      message: 'Wallet DID consistency may degrade further',
    });
  }

  // Predict credential expiration issues
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId, revokedAt: null },
  });

  const expiringSoon = credentials.filter((c) => {
    // Mock - would check actual expiration
    return false;
  });

  if (expiringSoon.length > 0) {
    predictions.push({
      type: 'credential_expiration_break',
      probability: 0.8,
      predictedDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      message: `${expiringSoon.length} credentials expiring soon may break continuity`,
    });
  }

  return predictions;
}

/**
 * Export continuity pack (PDF-ready data)
 */
export async function exportContinuityPack(clinicianId: string): Promise<{
  clinicianId: string;
  generatedAt: string;
  continuity: IdentityContinuityData;
  breaches: Array<{ type: string; severity: string; message: string }>;
  predictions: Array<{ type: string; probability: number; message: string }>;
  summary: {
    overallContinuity: number;
    status: string;
    recommendations: string[];
  };
}> {
  const [continuity, breaches, predictions] = await Promise.all([
    getOrCreateIdentityContinuity(clinicianId),
    detectContinuityBreaches(clinicianId),
    predictContinuityIssues(clinicianId),
  ]);

  // Calculate overall continuity score
  const overallContinuity =
    (continuity.multiWallet.consistencyScore +
      continuity.crossCountry.continuityScore +
      continuity.credentialLineage.continuityScore +
      continuity.didRotation.continuityScore) /
    4;

  const status = overallContinuity >= 0.9 ? 'excellent' : overallContinuity >= 0.7 ? 'good' : overallContinuity >= 0.5 ? 'fair' : 'poor';

  const recommendations: string[] = [];
  if (breaches.length > 0) {
    recommendations.push('Address detected continuity breaches immediately');
  }
  if (continuity.multiWallet.consistencyScore < 0.8) {
    recommendations.push('Synchronize DIDs across all wallets');
  }
  if (predictions.length > 0) {
    recommendations.push('Monitor predicted continuity issues');
  }
  if (recommendations.length === 0) {
    recommendations.push('Identity continuity is well-maintained');
  }

  return {
    clinicianId,
    generatedAt: new Date().toISOString(),
    continuity,
    breaches: breaches.map((b) => ({
      type: b.type,
      severity: b.severity,
      message: b.message,
    })),
    predictions: predictions.map((p) => ({
      type: p.type,
      probability: p.probability,
      message: p.message,
    })),
    summary: {
      overallContinuity,
      status,
      recommendations,
    },
  };
}

