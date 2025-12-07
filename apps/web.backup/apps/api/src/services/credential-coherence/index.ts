/**
 * Batch 401 — Credential Harmonic Coherence Engine v7
 * Ensure credentials "harmonize" logically across timelines, issuers, roles, and evidence sources
 */

import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface CoherenceField {
  field: string;
  value: any;
  source: string;
  timestamp: string;
}

export interface CoherenceResult {
  clinicianId: string;
  resonanceScore: number; // 0-100, how "in sync" all components are
  harmonized: {
    license?: { privileges: string[]; state: string; status: string };
    cme?: { competency: string[]; hours: number };
    board?: { specialty: string; certification: string };
    role?: { experience: string[]; years: number };
  };
  errors: Array<{
    type: 'structural' | 'temporal' | 'issuer' | 'jurisdiction';
    field: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  drift: {
    detected: boolean;
    magnitude: number;
    direction: 'improving' | 'declining' | 'stable';
  };
  suggestions: string[];
  updatedAt: string;
}

/**
 * Harmonize credential fields
 */
function harmonizeFields(fields: CoherenceField[]): CoherenceResult['harmonized'] {
  const harmonized: CoherenceResult['harmonized'] = {};

  // Group by field type
  const licenseFields = fields.filter((f) => f.field.startsWith('license.'));
  const cmeFields = fields.filter((f) => f.field.startsWith('cme.'));
  const boardFields = fields.filter((f) => f.field.startsWith('board.'));
  const roleFields = fields.filter((f) => f.field.startsWith('role.'));

  // Harmonize license → privileges
  if (licenseFields.length > 0) {
    const privileges = licenseFields
      .filter((f) => f.field === 'license.privileges')
      .map((f) => f.value)
      .flat();
    const state = licenseFields.find((f) => f.field === 'license.state')?.value || 'unknown';
    const status = licenseFields.find((f) => f.field === 'license.status')?.value || 'unknown';
    harmonized.license = { privileges: [...new Set(privileges)], state, status };
  }

  // Harmonize CME → competency
  if (cmeFields.length > 0) {
    const competency = cmeFields
      .filter((f) => f.field === 'cme.competency')
      .map((f) => f.value)
      .flat();
    const hours = cmeFields
      .map((f) => (f.field === 'cme.hours' ? Number(f.value) || 0 : 0))
      .reduce((a, b) => a + b, 0);
    harmonized.cme = { competency: [...new Set(competency)], hours };
  }

  // Harmonize board → specialty
  if (boardFields.length > 0) {
    const specialty = boardFields.find((f) => f.field === 'board.specialty')?.value || 'unknown';
    const certification = boardFields.find((f) => f.field === 'board.certification')?.value || 'unknown';
    harmonized.board = { specialty, certification };
  }

  // Harmonize role → experience
  if (roleFields.length > 0) {
    const experience = roleFields
      .filter((f) => f.field === 'role.experience')
      .map((f) => f.value)
      .flat();
    const years = roleFields
      .map((f) => (f.field === 'role.years' ? Number(f.value) || 0 : 0))
      .reduce((a, b) => a + b, 0);
    harmonized.role = { experience: [...new Set(experience)], years };
  }

  return harmonized;
}

/**
 * Classify coherence errors
 */
function classifyErrors(fields: CoherenceField[]): CoherenceResult['errors'] {
  const errors: CoherenceResult['errors'] = [];

  // Structural errors (missing required fields)
  const requiredFields = ['license.state', 'license.status', 'board.specialty'];
  for (const required of requiredFields) {
    if (!fields.some((f) => f.field === required)) {
      errors.push({
        type: 'structural',
        field: required,
        description: `Missing required field: ${required}`,
        severity: 'high',
      });
    }
  }

  // Temporal errors (conflicting timestamps)
  const timestamps = fields.map((f) => new Date(f.timestamp).getTime()).sort();
  if (timestamps.length > 1) {
    const maxGap = Math.max(...timestamps) - Math.min(...timestamps);
    const daysGap = maxGap / (1000 * 60 * 60 * 24);
    if (daysGap > 365) {
      errors.push({
        type: 'temporal',
        field: 'timestamp',
        description: `Large temporal gap: ${daysGap.toFixed(0)} days between oldest and newest fields`,
        severity: 'medium',
      });
    }
  }

  // Issuer errors (conflicting issuers for same field)
  const byField = fields.reduce((acc, f) => {
    if (!acc[f.field]) acc[f.field] = [];
    acc[f.field].push(f);
    return acc;
  }, {} as Record<string, CoherenceField[]>);

  for (const [field, fieldFields] of Object.entries(byField)) {
    const sources = new Set(fieldFields.map((f) => f.source));
    if (sources.size > 1) {
      errors.push({
        type: 'issuer',
        field,
        description: `Multiple issuers for ${field}: ${Array.from(sources).join(', ')}`,
        severity: 'low',
      });
    }
  }

  return errors;
}

/**
 * Calculate resonance score (how "in sync" components are)
 */
function calculateResonance(harmonized: CoherenceResult['harmonized'], errors: CoherenceResult['errors']): number {
  let score = 100;

  // Deduct for errors
  for (const error of errors) {
    const penalty = error.severity === 'high' ? 20 : error.severity === 'medium' ? 10 : 5;
    score -= penalty;
  }

  // Bonus for complete harmonization
  const components = Object.keys(harmonized).length;
  if (components >= 3) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Detect drift
 */
function detectDrift(fields: CoherenceField[]): CoherenceResult['drift'] {
  if (fields.length < 2) {
    return { detected: false, magnitude: 0, direction: 'stable' };
  }

  const sorted = [...fields].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const values = sorted.map((f) => (typeof f.value === 'number' ? f.value : 0));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const detected = stdDev > 15;
  const magnitude = stdDev;
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const direction = Math.abs(secondMean - firstMean) < 5 ? 'stable' : secondMean > firstMean ? 'improving' : 'declining';

  return { detected, magnitude, direction };
}

/**
 * Generate coherence profile
 */
export async function generateCoherenceProfile(clinicianId: string, fields: CoherenceField[]): Promise<CoherenceResult> {
  const harmonized = harmonizeFields(fields);
  const errors = classifyErrors(fields);
  const resonanceScore = calculateResonance(harmonized, errors);
  const drift = detectDrift(fields);

  // Generate suggestions
  const suggestions: string[] = [];
  if (errors.length > 0) {
    suggestions.push('Review and resolve coherence errors');
  }
  if (drift.detected && drift.direction === 'declining') {
    suggestions.push('Address declining coherence drift');
  }
  if (resonanceScore < 70) {
    suggestions.push('Improve credential field alignment');
  }

  const result: CoherenceResult = {
    clinicianId,
    resonanceScore,
    harmonized,
    errors,
    drift,
    suggestions,
    updatedAt: new Date().toISOString(),
  };

  // Save to database
  await prisma.credentialCoherence.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      coherence: result as any,
    },
    update: {
      coherence: result as any,
    },
  });

  return result;
}

/**
 * Generate audit pack
 */
export async function generateCoherenceAuditPack(clinicianId: string): Promise<{
  coherence: CoherenceResult;
  exportHash: string;
  generatedAt: string;
}> {
  const record = await prisma.credentialCoherence.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    throw new Error(`No coherence profile found for clinician ${clinicianId}`);
  }

  const coherence = record.coherence as any as CoherenceResult;

  // Anchor snapshot
  anchorEvent('credentialCoherenceAnchored', {
    clinicianId,
    coherenceHash: JSON.stringify(coherence).substring(0, 64),
    resonanceScore: coherence.resonanceScore,
    errorCount: coherence.errors.length,
  });

  return {
    coherence,
    exportHash: `coherence_${clinicianId}_${Date.now()}`,
    generatedAt: new Date().toISOString(),
  };
}

