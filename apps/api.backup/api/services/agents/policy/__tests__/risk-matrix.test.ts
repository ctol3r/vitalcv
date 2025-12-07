/**
 * B119C-AI-021: Agent risk matrix tests
 *
 * Tests for NeuralTrust risk assessment matrix with tier assignment
 */

import { getRiskMatrix, RiskTier } from '../risk-matrix';

describe('NeuralTrust Risk Matrix', () => {
  let riskMatrix: ReturnType<typeof getRiskMatrix>;

  beforeEach(() => {
    riskMatrix = getRiskMatrix();
  });

  describe('Tier Assignment', () => {
    it('should assign Proactive tier for low concern agents', () => {
      const telemetry = {
        anomalies: [],
        deviationScore: 0.1,
        governanceControls: true,
        monitoringEnabled: true,
      };

      const assessment = riskMatrix.assessAgent('agent-proactive', telemetry);

      expect(assessment.tier).toBe('Proactive');
      expect(assessment.concernScore).toBeLessThan(30);
    });

    it('should assign Managed tier for medium concern agents', () => {
      const telemetry = {
        anomalies: [1, 2],
        deviationScore: 0.3,
        governanceControls: true,
        monitoringEnabled: true,
        toolMisuse: 1,
      };

      const assessment = riskMatrix.assessAgent('agent-managed', telemetry);

      expect(assessment.tier).toBe('Managed');
      expect(assessment.concernScore).toBeGreaterThanOrEqual(30);
      expect(assessment.concernScore).toBeLessThan(70);
    });

    it('should assign Reactive tier for high concern (73% gap)', () => {
      const telemetry = {
        anomalies: [1, 2, 3, 4, 5],
        deviationScore: 0.8,
        injectionAttempts: 3,
        dataLeaks: 2,
        governanceControls: false,
        monitoringEnabled: false,
      };

      const assessment = riskMatrix.assessAgent('agent-reactive', telemetry);

      expect(assessment.tier).toBe('Reactive');
      expect(assessment.concernScore).toBeGreaterThanOrEqual(70);
    });

    it('should assign Reactive tier for critical risk factors', () => {
      const telemetry = {
        anomalies: [],
        deviationScore: 0.2,
        injectionAttempts: 10, // Critical threshold
        governanceControls: true,
        monitoringEnabled: true,
      };

      const assessment = riskMatrix.assessAgent('agent-critical', telemetry);

      expect(assessment.tier).toBe('Reactive');
      expect(assessment.riskFactors.some(f => f.severity === 'critical')).toBe(true);
    });
  });

  describe('NeuralTrust Metrics', () => {
    it('should calculate concern gap correctly', () => {
      const telemetry = {
        anomalies: [1, 2, 3],
        deviationScore: 0.5,
      };

      riskMatrix.assessAgent('agent-test', telemetry);
      const metrics = riskMatrix.getNeuralTrustMetrics('agent-test');

      expect(metrics).toBeTruthy();
      expect(metrics?.concernGap).toBeGreaterThan(0);
      expect(metrics?.concernGap).toBeLessThanOrEqual(100);
    });

    it('should detect 73% concern gap', () => {
      const telemetry = {
        anomalies: [1, 2, 3, 4, 5, 6, 7],
        deviationScore: 0.9,
        injectionAttempts: 2,
        dataLeaks: 1,
      };

      const assessment = riskMatrix.assessAgent('agent-73gap', telemetry);

      // Should result in Reactive tier due to high concern
      expect(assessment.tier).toBe('Reactive');
      expect(assessment.concernScore).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Risk Factor Identification', () => {
    it('should identify injection risks', () => {
      const telemetry = {
        injectionAttempts: 3,
        injectionEvidence: ['attempt1', 'attempt2'],
      };

      const assessment = riskMatrix.assessAgent('agent-injection', telemetry);

      const injectionFactor = assessment.riskFactors.find(f => f.type === 'injection');
      expect(injectionFactor).toBeTruthy();
      expect(injectionFactor?.severity).toBe('high');
    });

    it('should identify data leak risks', () => {
      const telemetry = {
        dataLeaks: 4,
        leakEvidence: ['leak1', 'leak2'],
      };

      const assessment = riskMatrix.assessAgent('agent-leak', telemetry);

      const leakFactor = assessment.riskFactors.find(f => f.type === 'leak');
      expect(leakFactor).toBeTruthy();
      expect(leakFactor?.severity).toBe('critical');
    });

    it('should identify governance gaps', () => {
      const telemetry = {
        governanceControls: false,
      };

      const assessment = riskMatrix.assessAgent('agent-governance', telemetry);

      const govFactor = assessment.riskFactors.find(f => f.type === 'governance');
      expect(govFactor).toBeTruthy();
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for Reactive tier', () => {
      const telemetry = {
        anomalies: [1, 2, 3, 4, 5],
        deviationScore: 0.8,
      };

      const assessment = riskMatrix.assessAgent('agent-rec', telemetry);

      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.some(r => r.includes('Immediate action'))).toBe(true);
    });

    it('should generate specific recommendations for risk factors', () => {
      const telemetry = {
        injectionAttempts: 2,
        dataLeaks: 1,
      };

      const assessment = riskMatrix.assessAgent('agent-spec-rec', telemetry);

      expect(assessment.recommendations.some(r => r.includes('input validation'))).toBe(true);
      expect(assessment.recommendations.some(r => r.includes('DLP'))).toBe(true);
    });
  });

  describe('Tier Summary', () => {
    it('should provide tier distribution summary', () => {
      // Create assessments for different tiers
      riskMatrix.assessAgent('agent-1', { anomalies: [], deviationScore: 0.1 });
      riskMatrix.assessAgent('agent-2', { anomalies: [1], deviationScore: 0.4 });
      riskMatrix.assessAgent('agent-3', { anomalies: [1, 2, 3, 4, 5], deviationScore: 0.9 });

      const summary = riskMatrix.getTierSummary();

      expect(summary.length).toBeGreaterThan(0);
      expect(summary.some(s => s.tier === 'Proactive')).toBe(true);
      expect(summary.some(s => s.tier === 'Managed')).toBe(true);
      expect(summary.some(s => s.tier === 'Reactive')).toBe(true);
    });
  });
});

