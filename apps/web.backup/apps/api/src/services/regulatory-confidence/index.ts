/**
 * Batch 433 — Regulatory Confidence Map v8
 * Score how confident VitalCV is in regulatory decisions for each clinician across jurisdictions
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface ConfidenceSignal {
  source: 'regulatory_api' | 'issuer' | 'chain_anchor' | 'employer_attestation' | 'trust_engine';
  confidence: number; // 0-100
  jurisdiction: string;
  timestamp: string;
}

export interface RegulatoryConfidenceResult {
  clinicianId: string;
  confidence: {
    overall: number; // 0-100
    byJurisdiction: Record<string, number>;
    bySource: Record<string, number>;
    signals: ConfidenceSignal[];
  };
  conflicts: {
    detected: boolean;
    mismatches: Array<{
      jurisdiction: string;
      interpretations: Array<{
        source: string;
        interpretation: string;
        confidence: number;
      }>;
    }>;
  };
  crossBorder: {
    countries: string[];
    fusedConfidence: Record<string, number>; // country -> confidence
    conflicts: Array<{
      country1: string;
      country2: string;
      conflict: string;
    }>;
  };
  drift: {
    predicted: boolean;
    predictedLoss: number;
    factors: string[];
    forecastDate: string | null;
  };
  reinforcement: {
    recommended: boolean;
    evidence: Array<{
      type: string;
      description: string;
      expectedBoost: number;
    }>;
  };
  updatedAt: string;
}

/**
 * Compute 0–100 regulatory confidence
 */
function computeConfidenceScore(signals: ConfidenceSignal[]): number {
  if (signals.length === 0) return 50; // Default neutral

  const weights: Record<string, number> = {
    regulatory_api: 0.4,
    issuer: 0.3,
    chain_anchor: 0.15,
    employer_attestation: 0.1,
    trust_engine: 0.05,
  };

  const weightedSum = signals.reduce((sum, signal) => {
    const weight = weights[signal.source] || 0.1;
    return sum + signal.confidence * weight;
  }, 0);

  const totalWeight = signals.reduce((sum, signal) => {
    return sum + (weights[signal.source] || 0.1);
  }, 0);

  return Math.round(weightedSum / totalWeight);
}

/**
 * Detect mismatched regulatory interpretations
 */
function detectRegulatorConflicts(signals: ConfidenceSignal[]): RegulatoryConfidenceResult['conflicts'] {
  const byJurisdiction = signals.reduce((acc, signal) => {
    if (!acc[signal.jurisdiction]) acc[signal.jurisdiction] = [];
    acc[signal.jurisdiction].push(signal);
    return acc;
  }, {} as Record<string, ConfidenceSignal[]>);

  const mismatches: RegulatoryConfidenceResult['conflicts']['mismatches'] = [];

  Object.entries(byJurisdiction).forEach(([jurisdiction, jurSignals]) => {
    const interpretations = jurSignals.map((s) => ({
      source: s.source,
      interpretation: s.confidence > 70 ? 'high_confidence' : s.confidence > 40 ? 'moderate_confidence' : 'low_confidence',
      confidence: s.confidence,
    }));

    const uniqueInterpretations = new Set(interpretations.map((i) => i.interpretation));
    if (uniqueInterpretations.size > 1) {
      mismatches.push({
        jurisdiction,
        interpretations,
      });
    }
  });

  return {
    detected: mismatches.length > 0,
    mismatches,
  };
}

/**
 * Fuse confidence levels across different countries
 */
function fuseCrossBorderConfidence(signals: ConfidenceSignal[]): RegulatoryConfidenceResult['crossBorder'] {
  const countries = [...new Set(signals.map((s) => s.jurisdiction))];
  const fusedConfidence: Record<string, number> = {};
  const conflicts: RegulatoryConfidenceResult['crossBorder']['conflicts'] = [];

  countries.forEach((country) => {
    const countrySignals = signals.filter((s) => s.jurisdiction === country);
    fusedConfidence[country] = computeConfidenceScore(countrySignals);
  });

  // Detect conflicts between countries
  for (let i = 0; i < countries.length; i++) {
    for (let j = i + 1; j < countries.length; j++) {
      const conf1 = fusedConfidence[countries[i]];
      const conf2 = fusedConfidence[countries[j]];
      if (Math.abs(conf1 - conf2) > 30) {
        conflicts.push({
          country1: countries[i],
          country2: countries[j],
          conflict: `Confidence gap of ${Math.abs(conf1 - conf2)} points between ${countries[i]} and ${countries[j]}`,
        });
      }
    }
  }

  return {
    countries,
    fusedConfidence,
    conflicts,
  };
}

/**
 * Forecast loss of regulatory trust
 */
function forecastConfidenceDrift(signals: ConfidenceSignal[]): RegulatoryConfidenceResult['drift'] {
  const recentSignals = signals
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  if (recentSignals.length < 2) {
    return {
      predicted: false,
      predictedLoss: 0,
      factors: [],
      forecastDate: null,
    };
  }

  const oldAvg = recentSignals.slice(5).reduce((sum, s) => sum + s.confidence, 0) / 5;
  const newAvg = recentSignals.slice(0, 5).reduce((sum, s) => sum + s.confidence, 0) / 5;
  const loss = oldAvg - newAvg;

  return {
    predicted: loss > 10,
    predictedLoss: Math.round(loss),
    factors: loss > 10 ? ['Declining confidence signals', 'Conflicting interpretations'] : [],
    forecastDate: loss > 10 ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() : null,
  };
}

/**
 * Recommend evidence to strengthen confidence
 */
function recommendReinforcement(
  confidence: number,
  conflicts: RegulatoryConfidenceResult['conflicts']
): RegulatoryConfidenceResult['reinforcement'] {
  const evidence: RegulatoryConfidenceResult['reinforcement']['evidence'] = [];
  let recommended = false;

  if (confidence < 70) {
    recommended = true;
    evidence.push({
      type: 'additional_verification',
      description: 'Obtain additional regulatory verification from authoritative sources',
      expectedBoost: 15,
    });
  }

  if (conflicts.detected) {
    recommended = true;
    evidence.push({
      type: 'conflict_resolution',
      description: 'Resolve conflicting regulatory interpretations',
      expectedBoost: 20,
    });
  }

  return { recommended, evidence };
}

/**
 * Generate regulatory confidence profile
 */
export async function generateRegulatoryConfidence(
  clinicianId: string,
  signals: ConfidenceSignal[]
): Promise<RegulatoryConfidenceResult> {
  const overall = computeConfidenceScore(signals);

  const byJurisdiction = signals.reduce((acc, signal) => {
    if (!acc[signal.jurisdiction]) acc[signal.jurisdiction] = [];
    acc[signal.jurisdiction].push(signal);
    return acc;
  }, {} as Record<string, ConfidenceSignal[]>);

  const byJurisdictionConfidence: Record<string, number> = {};
  Object.entries(byJurisdiction).forEach(([jurisdiction, jurSignals]) => {
    byJurisdictionConfidence[jurisdiction] = computeConfidenceScore(jurSignals);
  });

  const bySource = signals.reduce((acc, signal) => {
    if (!acc[signal.source]) acc[signal.source] = [];
    acc[signal.source].push(signal);
    return acc;
  }, {} as Record<string, ConfidenceSignal[]>);

  const bySourceConfidence: Record<string, number> = {};
  Object.entries(bySource).forEach(([source, sourceSignals]) => {
    bySourceConfidence[source] = computeConfidenceScore(sourceSignals);
  });

  const conflicts = detectRegulatorConflicts(signals);
  const crossBorder = fuseCrossBorderConfidence(signals);
  const drift = forecastConfidenceDrift(signals);
  const reinforcement = recommendReinforcement(overall, conflicts);

  const result: RegulatoryConfidenceResult = {
    clinicianId,
    confidence: {
      overall,
      byJurisdiction: byJurisdictionConfidence,
      bySource: bySourceConfidence,
      signals,
    },
    conflicts,
    crossBorder,
    drift,
    reinforcement,
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await prisma.regulatoryConfidenceMap.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      confidence: result as any,
    },
    update: {
      confidence: result as any,
    },
  });

  return result;
}

/**
 * Export confidence pack
 */
export async function exportConfidencePack(clinicianId: string): Promise<{
  confidence: RegulatoryConfidenceResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.regulatoryConfidenceMap.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    throw new Error(`No regulatory confidence map found for clinician ${clinicianId}`);
  }

  const confidence = record.confidence as any as RegulatoryConfidenceResult;

  // Anchor snapshot
  anchorEvent('regulatoryConfidenceAnchored', {
    clinicianId,
    confidenceHash: createHash('sha256').update(JSON.stringify(confidence)).digest('hex'),
    overallConfidence: confidence.confidence.overall,
    conflictCount: confidence.conflicts.mismatches.length,
  });

  return {
    confidence,
    exportHash: `confidence_${clinicianId}_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}








