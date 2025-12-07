/**
 * Batch 400 — Global Provider Trust Synthesis Layer v8
 * Main service orchestrating all trust synthesis components
 */

import { PrismaClient } from '@prisma/client';
import { normalizeTrustSignals, type TrustSignal } from './normalize';
import { fuseTrustSignals, type TrustDomain } from './weighting';
import { detectContradictions } from './contradiction';
import { calculateStability } from './stability';
import { forecastTrust } from './forecast';
import { synthesizeCrossJurisdiction, type JurisdictionTrust } from './cross-jurisdiction';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface TrustSynthesisInput {
  clinicianId: string;
  chainTrust?: number;
  issuerTrust?: number;
  verifierTrust?: number;
  employerTrust?: number;
  regulatoryTrust?: number;
  jurisdictions?: JurisdictionTrust[];
}

export interface TrustSynthesisResult {
  clinicianId: string;
  overallScore: number;
  domainScores: Record<string, number>;
  stability: {
    score: number;
    trend: string;
    volatility: number;
  };
  contradictions: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  forecast: {
    horizonDays: number;
    predictedScore: number;
    confidence: number;
    trend: string;
  };
  crossJurisdiction?: {
    globalScore: number;
    harmonized: boolean;
    conflicts: Array<{ jurisdiction1: string; jurisdiction2: string; delta: number }>;
  };
  updatedAt: string;
}

/**
 * Synthesize trust profile for a clinician
 */
export async function synthesizeTrustProfile(input: TrustSynthesisInput): Promise<TrustSynthesisResult> {
  const signals: TrustSignal[] = [];
  const now = new Date().toISOString();

  // Collect signals
  if (input.chainTrust !== undefined) {
    signals.push({ source: 'chain', value: input.chainTrust, timestamp: now });
  }
  if (input.issuerTrust !== undefined) {
    signals.push({ source: 'issuer', value: input.issuerTrust, timestamp: now });
  }
  if (input.verifierTrust !== undefined) {
    signals.push({ source: 'verifier', value: input.verifierTrust, timestamp: now });
  }
  if (input.employerTrust !== undefined) {
    signals.push({ source: 'employer', value: input.employerTrust, timestamp: now });
  }
  if (input.regulatoryTrust !== undefined) {
    signals.push({ source: 'regulatory', value: input.regulatoryTrust, timestamp: now });
  }

  // Normalize signals
  const normalized = normalizeTrustSignals(signals);

  // Organize into domains
  const domains: TrustDomain[] = [
    {
      domain: 'blockchain',
      signals: normalized.filter((s) => s.source === 'chain'),
      domainWeight: 0.25,
    },
    {
      domain: 'issuance',
      signals: normalized.filter((s) => s.source === 'issuer'),
      domainWeight: 0.30,
    },
    {
      domain: 'verification',
      signals: normalized.filter((s) => s.source === 'verifier'),
      domainWeight: 0.20,
    },
    {
      domain: 'employment',
      signals: normalized.filter((s) => s.source === 'employer'),
      domainWeight: 0.15,
    },
    {
      domain: 'regulatory',
      signals: normalized.filter((s) => s.source === 'regulatory'),
      domainWeight: 0.10,
    },
  ].filter((d) => d.signals.length > 0);

  // Fuse signals
  const fusion = fuseTrustSignals(domains);

  // Detect contradictions
  const contradictions = detectContradictions(normalized);

  // Calculate stability
  const stability = calculateStability(normalized);

  // Forecast
  const forecast = forecastTrust(normalized, 90);

  // Cross-jurisdiction synthesis (if provided)
  let crossJurisdiction;
  if (input.jurisdictions && input.jurisdictions.length > 0) {
    const crossJur = synthesizeCrossJurisdiction(input.jurisdictions);
    crossJurisdiction = {
      globalScore: crossJur.globalScore,
      harmonized: crossJur.harmonized,
      conflicts: crossJur.conflicts.map((c) => ({
        jurisdiction1: c.jurisdiction1,
        jurisdiction2: c.jurisdiction2,
        delta: c.delta,
      })),
    };
  }

  // Build synthesis result
  const synthesis = {
    overallScore: fusion.overallScore,
    domainScores: fusion.domainScores,
    stability: {
      score: stability.score,
      trend: stability.trend,
      volatility: stability.volatility,
    },
    contradictions: contradictions.map((c) => ({
      type: c.type,
      severity: c.severity,
      description: c.description,
    })),
    forecast: {
      horizonDays: forecast.horizonDays,
      predictedScore: forecast.predictedScore,
      confidence: forecast.confidence,
      trend: forecast.trend,
    },
    crossJurisdiction,
    signals: normalized,
    confidence: fusion.confidence,
    updatedAt: now,
  };

  // Save to database
  await prisma.trustSynthesisLayer.upsert({
    where: { clinicianId: input.clinicianId },
    create: {
      clinicianId: input.clinicianId,
      synthesis: synthesis as any,
    },
    update: {
      synthesis: synthesis as any,
    },
  });

  return {
    clinicianId: input.clinicianId,
    overallScore: fusion.overallScore,
    domainScores: fusion.domainScores,
    stability: {
      score: stability.score,
      trend: stability.trend,
      volatility: stability.volatility,
    },
    contradictions: contradictions.map((c) => ({
      type: c.type,
      severity: c.severity,
      description: c.description,
    })),
    forecast: {
      horizonDays: forecast.horizonDays,
      predictedScore: forecast.predictedScore,
      confidence: forecast.confidence,
      trend: forecast.trend,
    },
    crossJurisdiction,
    updatedAt: now,
  };
}

/**
 * Generate executive trust dossier (export pack)
 */
export async function generateTrustDossier(clinicianId: string): Promise<{
  synthesis: TrustSynthesisResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.trustSynthesisLayer.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    throw new Error(`No trust synthesis found for clinician ${clinicianId}`);
  }

  const synthesis = record.synthesis as any as TrustSynthesisResult;

  // Anchor snapshot
  anchorEvent('trustSynthesisAnchored', {
    clinicianId,
    synthesisHash: JSON.stringify(synthesis).substring(0, 64), // Simplified hash
    overallScore: synthesis.overallScore,
    stabilityScore: synthesis.stability.score,
    contradictionCount: synthesis.contradictions.length,
  });

  return {
    synthesis,
    exportHash: `trust_${clinicianId}_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}

