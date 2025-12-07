import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockGetFusion = jest.fn();

jest.mock('../../qualityFusion/models/QualityCredentialFusion', () => ({
  getQualityCredentialFusion: (...args: unknown[]) => mockGetFusion(...args),
}));

import {
  applyFusionScoreToRiskScore,
  computeFusionModifier,
} from '../fusionIntegration';

describe('credential risk fusion integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns base score when fusion missing', async () => {
    mockGetFusion.mockResolvedValue(null);
    const result = await applyFusionScoreToRiskScore('clin-1', 55);
    expect(result.adjustedScore).toBe(55);
    expect(result.modifier).toBe(0);
  });

  it('reduces score for low fusion composite', async () => {
    mockGetFusion.mockResolvedValue({
      clinicianId: 'clin-2',
      compositeScore: 20,
      contributingQualitySignals: [],
      contributingCredentialSignals: [],
      complianceFindings: [],
      recommendedActions: [],
      ruleMatches: [],
      lastCalculatedAt: new Date('2025-11-15T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await applyFusionScoreToRiskScore('clin-2', 40);
    expect(result.modifier).toBeLessThan(0);
    expect(result.adjustedScore).toBeLessThan(40);
  });

  it('boosts score for elevated fusion composite', async () => {
    mockGetFusion.mockResolvedValue({
      clinicianId: 'clin-3',
      compositeScore: 78,
      contributingQualitySignals: [],
      contributingCredentialSignals: [],
      complianceFindings: [],
      recommendedActions: ['Escalate'],
      ruleMatches: [],
      lastCalculatedAt: new Date('2025-11-15T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await applyFusionScoreToRiskScore('clin-3', 50);
    expect(result.adjustedScore).toBeGreaterThan(50);
    expect(result.recommendedActions).toEqual(['Escalate']);
  });

  it('clamps adjusted score at 100', async () => {
    mockGetFusion.mockResolvedValue({
      clinicianId: 'clin-4',
      compositeScore: 95,
      contributingQualitySignals: [],
      contributingCredentialSignals: [],
      complianceFindings: [],
      recommendedActions: [],
      ruleMatches: [],
      lastCalculatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await applyFusionScoreToRiskScore('clin-4', 90);
    expect(result.adjustedScore).toBe(100);
  });

  it('exposes nonlinear modifier helper', () => {
    expect(computeFusionModifier(10)).toBeLessThan(0);
    expect(computeFusionModifier(50)).toBeGreaterThan(0);
    expect(computeFusionModifier(90)).toBeGreaterThan(computeFusionModifier(70));
  });
});


