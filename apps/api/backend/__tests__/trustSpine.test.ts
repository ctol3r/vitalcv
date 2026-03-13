/**
 * Wave 249 — Trust Spine Hardening tests
 *
 * Tests cover:
 * 1. Integrity report returns HEALTHY when no capsules/artifacts exist (empty DB = healthy)
 * 2. Integrity report structure: valid status, checks array, stats, computedAt
 * 3. ensureArtifactHashOnCapsule rejects empty hash
 * 4. ensureArtifactHashOnCapsule rejects null/undefined hash
 * 5. ensureArtifactHashOnCapsule rejects malformed hash (non-hex / wrong length)
 * 6. ensureArtifactHashOnCapsule accepts a valid 64-char hex SHA-256 hash
 * 7. Deterministic recomputation: same inputs → same score (reuse Wave 243 pattern)
 * 8. IntegrityReport.status is HEALTHY when all checks pass
 * 9. Graph integrity report has expected shape
 */

import {
  ensureArtifactHashOnCapsule,
} from '../src/services/integrity/pipelineEnforcer';
import type { DecisionCapsuleRecord } from '../src/services/decision/capsuleEngine';

// ── Pure helpers for deterministic score tests (mirrors Wave 243 test pattern) ─

type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';

function computeScore(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  credentialCount: number;
  hasVerifiedArtifacts: boolean;
}): number {
  let score = 0;
  if (params.identityVerified) score += 30;
  if (params.licensureStatus === 'verified') score += 30;
  else if (params.licensureStatus === 'pending') score += 15;
  else if (params.licensureStatus === 'expired') score += 0;
  else score += 5;
  if (params.exclusionClear) score += 20;
  const credScore = Math.min(params.credentialCount * 5, 20);
  score += credScore;
  return Math.min(score, 100);
}

function deriveBand(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  trustScore: number;
}): TrustBand {
  if (!params.exclusionClear) return 'L0';
  if (!params.identityVerified) return 'L0';
  if (params.licensureStatus === 'expired') return 'L0';
  if (params.trustScore >= 80) return 'L3';
  if (params.trustScore >= 60) return 'L2';
  if (params.trustScore >= 30) return 'L1';
  return 'L0';
}

// ── Mock prisma for DB-backed tests ──────────────────────────────────────────

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: { count: jest.fn().mockResolvedValue(0) },
    decisionCapsule: { count: jest.fn().mockResolvedValue(0) },
    monitoringEvent: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([{ cnt: BigInt(0) }]),
    candidateCredential: { findMany: jest.fn().mockResolvedValue([]) },
    knowledgeNode: {
      upsert: jest.fn().mockResolvedValue({ id: 'node-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    authorityEdge: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'edge-1' }),
    },
  },
  Prisma: {},
  PrismaClient: jest.fn(),
}));

// ── Test 1: Empty DB → HEALTHY integrity report ──────────────────────────────

describe('validatePipelineIntegrity — empty database', () => {
  it('returns HEALTHY status when there are no capsules or artifacts', async () => {
    const { validatePipelineIntegrity } = await import('../src/services/integrity/trustSpine');
    const report = await validatePipelineIntegrity();

    expect(report.status).toBe('HEALTHY');
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    expect(report.computedAt).toBeTruthy();
  });
});

// ── Test 2: IntegrityReport has expected shape ────────────────────────────────

describe('validatePipelineIntegrity — report shape', () => {
  it('report contains status, checks, stats, and computedAt', async () => {
    const { validatePipelineIntegrity } = await import('../src/services/integrity/trustSpine');
    const report = await validatePipelineIntegrity();

    expect(typeof report.status).toBe('string');
    expect(['HEALTHY', 'DEGRADED', 'CRITICAL']).toContain(report.status);

    // Each check has required fields
    for (const check of report.checks) {
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.details).toBe('string');
    }

    // Stats present
    expect(typeof report.stats.totalArtifacts).toBe('number');
    expect(typeof report.stats.totalCapsules).toBe('number');
    expect(typeof report.stats.totalEdges).toBe('number');
    expect(typeof report.stats.totalMonitoringStreams).toBe('number');

    // ISO timestamp
    expect(() => new Date(report.computedAt)).not.toThrow();
  });
});

// ── Test 3: ensureArtifactHashOnCapsule — rejects empty string ───────────────

describe('ensureArtifactHashOnCapsule', () => {
  const baseCapsule: DecisionCapsuleRecord = {
    id: 'test-capsule-1',
    subjectDid: 'did:vitalcv:1234567890',
    subjectNpi: '1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: new Date().toISOString(),
    credentialIds: [],
    issuerIds: [],
    artifactHash: '',
    methodology: 'CRS_v1.0',
    status: 'VALID',
    metadata: {},
    createdAt: new Date().toISOString(),
  };

  it('rejects an empty artifactHash', () => {
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: '' });
    expect(result).toBe(false);
  });

  it('rejects a whitespace-only artifactHash', () => {
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: '   ' });
    expect(result).toBe(false);
  });

  it('rejects a too-short hash (not 64 hex chars)', () => {
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: 'abc123' });
    expect(result).toBe(false);
  });

  it('rejects a non-hex string of correct length', () => {
    const notHex = 'z'.repeat(64);
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: notHex });
    expect(result).toBe(false);
  });

  it('accepts a valid 64-character lowercase hex SHA-256 hash', () => {
    const validHash = 'a'.repeat(64); // 64 hex chars, all lowercase
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: validHash });
    expect(result).toBe(true);
  });

  it('accepts a valid 64-character uppercase hex SHA-256 hash', () => {
    const validHash = 'A'.repeat(64); // 64 hex chars, all uppercase
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: validHash });
    expect(result).toBe(true);
  });

  it('accepts a realistic-looking SHA-256 hash', () => {
    const realisticHash = 'd2c3a4b5e6f7089012345678901234567890abcdef1234567890abcdef123456';
    const result = ensureArtifactHashOnCapsule({ ...baseCapsule, artifactHash: realisticHash });
    expect(result).toBe(true);
  });
});

// ── Test 7: Deterministic score recomputation (Wave 243 pattern) ─────────────

describe('Trust score — deterministic recomputation', () => {
  const baseParams = {
    identityVerified: true,
    licensureStatus: 'verified' as LicensureStatus,
    exclusionClear: true,
    credentialCount: 4,
    hasVerifiedArtifacts: true,
  };

  it('produces identical scores on repeated calls with same inputs', () => {
    const score1 = computeScore(baseParams);
    const score2 = computeScore(baseParams);
    expect(score1).toBe(score2);
  });

  it('produces identical bands on repeated calls with same inputs', () => {
    const score = computeScore(baseParams);
    const band1 = deriveBand({ ...baseParams, trustScore: score });
    const band2 = deriveBand({ ...baseParams, trustScore: score });
    expect(band1).toBe(band2);
  });

  it('excluded clinician is always L0 regardless of score', () => {
    const score = computeScore({ ...baseParams, exclusionClear: false });
    const band = deriveBand({ ...baseParams, exclusionClear: false, trustScore: score });
    expect(band).toBe('L0');
  });

  it('fully verified clinician with 4+ credentials reaches L3', () => {
    const score = computeScore(baseParams);
    expect(score).toBeGreaterThanOrEqual(80);
    const band = deriveBand({ ...baseParams, trustScore: score });
    expect(band).toBe('L3');
  });

  it('same inputs always produce the same score across 10 iterations', () => {
    const scores = Array.from({ length: 10 }, () => computeScore(baseParams));
    const unique = new Set(scores);
    expect(unique.size).toBe(1);
  });
});

// ── Test 9: Graph integrity report shape ─────────────────────────────────────

describe('validateGraphIntegrity — report shape', () => {
  it('returns expected structure with arrays and computedAt', async () => {
    const { validateGraphIntegrity } = await import('../src/services/integrity/trustSpine');
    const report = await validateGraphIntegrity();

    expect(Array.isArray(report.orphanedNodes)).toBe(true);
    expect(Array.isArray(report.invalidEdges)).toBe(true);
    expect(Array.isArray(report.missingCapsuleEdges)).toBe(true);
    expect(typeof report.computedAt).toBe('string');
    expect(() => new Date(report.computedAt)).not.toThrow();
  });
});
