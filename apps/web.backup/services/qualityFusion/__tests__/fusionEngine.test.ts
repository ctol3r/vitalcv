import { describe, it, expect } from '@jest/globals';
import { evaluateQualityCredentialFusion } from '../fusionEngine';
import {
  QualitySignalType,
  CredentialSignalType,
  FusionEngineInput,
} from '../types';
import { CredentialRiskFactors } from '../../credentialRisk/enums';

function buildInput(overrides: Partial<FusionEngineInput> = {}): FusionEngineInput {
  return {
    clinicianId: 'clin-1',
    qualitySignals: [],
    credentialSignals: [],
    complianceFindings: [],
    baselineRiskScore: 0,
    ...overrides,
  };
}

describe('fusionEngine scoring', () => {
  it('returns zero score when no signals provided', () => {
    const result = evaluateQualityCredentialFusion(buildInput());
    expect(result.compositeScore).toBe(0);
    expect(result.recommendedActions).toEqual([]);
  });

  it('adds weighted points for quality signals', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        qualitySignals: [
          {
            type: QualitySignalType.OPPE_FAILURE,
            severity: 'HIGH',
            recommendedActions: ['Escalate to MEC'],
          },
          {
            type: QualitySignalType.FPPE_ESCALATION,
            severity: 'MODERATE',
          },
        ],
      })
    );
    expect(result.breakdown.qualityScore).toBeGreaterThan(20);
    expect(result.recommendedActions).toContain('Escalate to MEC');
  });

  it('derives credential signals from risk factors', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        credentialRiskFactors: [CredentialRiskFactors.BOARD_EXPIRED],
      })
    );
    expect(result.contributingCredentialSignals).toHaveLength(1);
    expect(result.breakdown.credentialScore).toBeGreaterThan(0);
  });

  it('scores compliance findings separately', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        complianceFindings: [
          { label: 'NCQA fail', severity: 'CRITICAL' },
          { label: 'TJC warn', severity: 'MODERATE' },
        ],
      })
    );
    expect(result.breakdown.complianceScore).toBeGreaterThanOrEqual(10);
  });

  it('matches OPPE failing plus board drift rule', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        qualitySignals: [
          { type: QualitySignalType.OPPE_FAILURE, severity: 'HIGH' },
        ],
        credentialSignals: [
          { type: CredentialSignalType.BOARD_STATUS_DRIFT, severity: 'MODERATE' },
        ],
      })
    );
    expect(result.ruleMatches.some((match) => match.id === 'OPPE_FAIL_BOARD_DRIFT')).toBe(true);
    expect(result.breakdown.ruleScore).toBeGreaterThan(0);
  });

  it('matches PECOS conflict plus denial spike rule', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        qualitySignals: [
          { type: QualitySignalType.PAYER_DENIAL_SPIKE, severity: 'HIGH' },
        ],
        credentialSignals: [
          { type: CredentialSignalType.PECOS_CONFLICT, severity: 'HIGH' },
        ],
      })
    );
    expect(result.ruleMatches.some((match) => match.id === 'PECOS_DENIAL_SPIKE')).toBe(true);
  });

  it('matches license drift plus complication spike rule', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        qualitySignals: [
          { type: QualitySignalType.COMPLICATION_SPIKE, severity: 'CRITICAL' },
        ],
        credentialSignals: [
          { type: CredentialSignalType.LICENSE_DRIFT, severity: 'MODERATE' },
        ],
      })
    );
    expect(
      result.ruleMatches.some((match) => match.id === 'LICENSE_COMPLICATION_CRITICAL')
    ).toBe(true);
  });

  it('caps baseline risk contribution at 10 points', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        baselineRiskScore: 200,
      })
    );
    expect(result.breakdown.baselineContribution).toBe(10);
  });

  it('deduplicates recommended actions across sources', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        qualitySignals: [
          {
            type: QualitySignalType.OPPE_FAILURE,
            severity: 'HIGH',
            recommendedActions: ['Escalate', 'Escalate'],
          },
        ],
        credentialSignals: [
          {
            type: CredentialSignalType.PECOS_CONFLICT,
            severity: 'HIGH',
            recommendedActions: ['Escalate'],
          },
        ],
      })
    );
    expect(result.recommendedActions).toEqual(['Escalate']);
  });

  it('clamps composite score at 100', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        baselineRiskScore: 90,
        qualitySignals: [
          { type: QualitySignalType.OPPE_FAILURE, severity: 'CRITICAL' },
          { type: QualitySignalType.COMPLICATION_SPIKE, severity: 'CRITICAL' },
        ],
        credentialSignals: [
          { type: CredentialSignalType.LICENSE_DRIFT, severity: 'CRITICAL' },
        ],
        complianceFindings: [
          { label: 'NCQA', severity: 'CRITICAL' },
          { label: 'TJC', severity: 'CRITICAL' },
        ],
      })
    );
    expect(result.compositeScore).toBe(100);
  });

  it('prefers most severe signal per type when merging', () => {
    const result = evaluateQualityCredentialFusion(
      buildInput({
        credentialSignals: [
          { type: CredentialSignalType.BOARD_STATUS_DRIFT, severity: 'LOW' },
          { type: CredentialSignalType.BOARD_STATUS_DRIFT, severity: 'HIGH' },
        ],
      })
    );
    expect(result.contributingCredentialSignals).toHaveLength(1);
    expect(result.contributingCredentialSignals[0].severity).toBe('HIGH');
  });

  it('preserves timestamp override', () => {
    const asOf = new Date('2025-11-15T05:00:00Z');
    const result = evaluateQualityCredentialFusion(
      buildInput({
        asOf,
        qualitySignals: [{ type: QualitySignalType.OPPE_FAILURE, severity: 'HIGH' }],
      })
    );
    expect(result.timestamp.toISOString()).toBe(asOf.toISOString());
  });
});


