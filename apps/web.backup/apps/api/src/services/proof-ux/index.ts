import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 224 — Zero-Friction Proof UX v3
 * Make verifiable credential sharing, scanning, and validating feel like magic
 */

export interface ProofUXConfig {
  oneTapShare: boolean;
  instantScan: boolean;
  hapticFeedback: boolean;
  confidenceIndicator: boolean;
  animatedTimeline: boolean;
  employerSummary: boolean;
  deepLinkSupport: boolean;
  rapidReVerification: boolean;
}

/**
 * Get or create proof UX config
 */
export async function getProofUXConfig(): Promise<ProofUXConfig> {
  const config = await prisma.proofUXConfig.findUnique({
    where: { id: 'default' },
  });

  if (config) {
    return config.config as any as ProofUXConfig;
  }

  // Create default config
  const defaultConfig: ProofUXConfig = {
    oneTapShare: true,
    instantScan: true,
    hapticFeedback: true,
    confidenceIndicator: true,
    animatedTimeline: true,
    employerSummary: true,
    deepLinkSupport: true,
    rapidReVerification: true,
  };

  await prisma.proofUXConfig.create({
    data: {
      id: 'default',
      config: defaultConfig as any,
      updatedAt: new Date(),
    },
  });

  return defaultConfig;
}

/**
 * Generate deep link for proof request
 */
export async function generateDeepLink(
  requestId: string,
  credentialTypes: string[],
  verifierId: string,
): Promise<{
  deepLink: string;
  expiresAt: string;
}> {
  const linkId = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  // Store link metadata
  await prisma.proofUXConfig.upsert({
    where: { id: `link_${linkId}` },
    create: {
      id: `link_${linkId}`,
      config: {
        type: 'deep_link',
        requestId,
        credentialTypes,
        verifierId,
        expiresAt: expiresAt.toISOString(),
      } as any,
      updatedAt: new Date(),
    },
    update: {
      config: {
        type: 'deep_link',
        requestId,
        credentialTypes,
        verifierId,
        expiresAt: expiresAt.toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  // Generate deep link URL
  const baseUrl = process.env.APP_URL || 'https://app.vitalcv.com';
  const deepLink = `${baseUrl}/proof/${linkId}`;

  return {
    deepLink,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Rapid re-verification using cached anchors
 */
export async function rapidReVerification(
  credentialId: string,
  previousVerificationId: string,
): Promise<{
  verified: boolean;
  cached: boolean;
  confidence: number;
}> {
  // Check if previous verification exists and is recent
  const previousVerification = await prisma.proofUXConfig.findUnique({
    where: { id: `verification_${previousVerificationId}` },
  });

  if (!previousVerification) {
    return {
      verified: false,
      cached: false,
      confidence: 0,
    };
  }

  const config = previousVerification.config as any;
  const verifiedAt = new Date(config.verifiedAt);
  const hoursSinceVerification = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60);

  // Use cached verification if < 24 hours old
  if (hoursSinceVerification < 24 && config.credentialId === credentialId) {
    return {
      verified: config.verified || false,
      cached: true,
      confidence: config.confidence || 0.8,
    };
  }

  return {
    verified: false,
    cached: false,
    confidence: 0,
  };
}

/**
 * Cache verification result for rapid re-verification
 */
export async function cacheVerification(
  credentialId: string,
  verificationId: string,
  result: {
    verified: boolean;
    confidence: number;
    details: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.proofUXConfig.upsert({
    where: { id: `verification_${verificationId}` },
    create: {
      id: `verification_${verificationId}`,
      config: {
        type: 'verification_cache',
        credentialId,
        verificationId,
        verified: result.verified,
        confidence: result.confidence,
        details: result.details,
        verifiedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
    update: {
      config: {
        type: 'verification_cache',
        credentialId,
        verificationId,
        verified: result.verified,
        confidence: result.confidence,
        details: result.details,
        verifiedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Anchor proof UX snapshot
 */
export async function anchorProofUXSnapshot(): Promise<void> {
  const config = await getProofUXConfig();
  const configHash = createHash('sha256').update(JSON.stringify(config)).digest('hex');

  anchorEvent('proofUXAnchored', {
    configHash,
    features: {
      oneTapShare: config.oneTapShare,
      instantScan: config.instantScan,
      hapticFeedback: config.hapticFeedback,
      confidenceIndicator: config.confidenceIndicator,
      animatedTimeline: config.animatedTimeline,
      employerSummary: config.employerSummary,
      deepLinkSupport: config.deepLinkSupport,
      rapidReVerification: config.rapidReVerification,
    },
    timestamp: new Date().toISOString(),
  });
}








