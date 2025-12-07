/**
 * Identity Anomaly Detection
 * Task 5: Add anomaly detection for identity drift
 *
 * Detects anomalies in identity data that may indicate fraud,
 * errors, or significant changes requiring attention.
 */

import type { CredentialNode, RoleNode } from './professional-graph';
import type { IdentityVibration } from './continuum-model';

export type AnomalyType =
  | 'credential_sudden_change'
  | 'credential_expiry_cluster'
  | 'role_inconsistency'
  | 'identity_drift'
  | 'unusual_pattern'
  | 'data_integrity'
  | 'verification_mismatch'
  | 'temporal_anomaly';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IdentityAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  detectedAt: Date;
  description: string;
  affectedEntities: string[]; // credential IDs, role IDs, etc.
  confidence: number; // 0-1
  evidence: Array<{
    field: string;
    expected: unknown;
    observed: unknown;
    deviation: number;
  }>;
  recommendations: string[];
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface AnomalyThresholds {
  credentialVelocityMax: number; // credentials per month
  credentialGapMax: number; // months between credentials
  roleTransitionMax: number; // roles per year
  driftThreshold: number; // 0-1
  verificationMismatchThreshold: number; // 0-1
}

export interface IdentityDrift {
  metric: string;
  baseline: number;
  current: number;
  deviation: number; // percentage
  trend: 'increasing' | 'decreasing' | 'stable';
  timeWindow: number; // days
}

export class IdentityAnomalyDetector {
  private anomalies: IdentityAnomaly[];
  private thresholds: AnomalyThresholds;
  private baselineMetrics: Map<string, { value: number; timestamp: Date }>;

  constructor(thresholds?: Partial<AnomalyThresholds>) {
    this.anomalies = [];
    this.thresholds = {
      credentialVelocityMax: 3,
      credentialGapMax: 60,
      roleTransitionMax: 4,
      driftThreshold: 0.3,
      verificationMismatchThreshold: 0.2,
      ...thresholds,
    };
    this.baselineMetrics = new Map();
  }

  /**
   * Detect all anomalies in current identity state
   */
  detectAnomalies(
    credentials: CredentialNode[],
    roles: RoleNode[],
    vibrations: IdentityVibration[]
  ): IdentityAnomaly[] {
    const detected: IdentityAnomaly[] = [];

    // Check credential anomalies
    detected.push(...this.detectCredentialAnomalies(credentials));

    // Check role anomalies
    detected.push(...this.detectRoleAnomalies(roles));

    // Check identity drift
    detected.push(...this.detectIdentityDrift(credentials, roles));

    // Check temporal patterns
    detected.push(...this.detectTemporalAnomalies(credentials, vibrations));

    // Update anomaly list
    this.anomalies.push(...detected);

    // Mark old anomalies as potentially stale
    this.updateAnomalyStatus();

    return detected;
  }

  /**
   * Detect credential-related anomalies
   */
  private detectCredentialAnomalies(credentials: CredentialNode[]): IdentityAnomaly[] {
    const anomalies: IdentityAnomaly[] = [];

    // Check for sudden credential additions
    const recentCredentials = credentials.filter(
      (c) => new Date(c.issuedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    if (recentCredentials.length > this.thresholds.credentialVelocityMax) {
      anomalies.push({
        id: this.generateId(),
        type: 'credential_sudden_change',
        severity: recentCredentials.length > this.thresholds.credentialVelocityMax * 2 ? 'high' : 'medium',
        detectedAt: new Date(),
        description: `Unusually high credential velocity: ${recentCredentials.length} credentials in the past month`,
        affectedEntities: recentCredentials.map((c) => c.id),
        confidence: 0.8,
        evidence: [
          {
            field: 'credential_velocity',
            expected: this.thresholds.credentialVelocityMax,
            observed: recentCredentials.length,
            deviation: (recentCredentials.length / this.thresholds.credentialVelocityMax - 1) * 100,
          },
        ],
        recommendations: [
          'Verify all recent credentials are legitimate',
          'Check for potential credential duplication',
          'Review credential issuance patterns',
        ],
      });
    }

    // Check for expiring credentials cluster
    const now = new Date();
    const expiringSoon = credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry = (c.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry < 90;
    });

    if (expiringSoon.length > credentials.length * 0.5) {
      anomalies.push({
        id: this.generateId(),
        type: 'credential_expiry_cluster',
        severity: 'medium',
        detectedAt: new Date(),
        description: `High percentage of credentials expiring soon: ${expiringSoon.length}/${credentials.length}`,
        affectedEntities: expiringSoon.map((c) => c.id),
        confidence: 0.9,
        evidence: [
          {
            field: 'expiring_credentials',
            expected: credentials.length * 0.2,
            observed: expiringSoon.length,
            deviation: ((expiringSoon.length / credentials.length) - 0.2) * 100,
          },
        ],
        recommendations: [
          'Plan credential renewal in advance',
          'Identify which credentials are most critical',
          'Set up renewal reminders',
        ],
      });
    }

    // Check for large gaps in credential issuance
    const sortedCredentials = [...credentials].sort(
      (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime()
    );

    for (let i = 1; i < sortedCredentials.length; i++) {
      const gapMonths =
        (sortedCredentials[i].issuedAt.getTime() - sortedCredentials[i - 1].issuedAt.getTime()) /
        (1000 * 60 * 60 * 24 * 30);

      if (gapMonths > this.thresholds.credentialGapMax) {
        anomalies.push({
          id: this.generateId(),
          type: 'temporal_anomaly',
          severity: 'low',
          detectedAt: new Date(),
          description: `Large gap between credentials: ${Math.round(gapMonths)} months`,
          affectedEntities: [sortedCredentials[i - 1].id, sortedCredentials[i].id],
          confidence: 0.7,
          evidence: [
            {
              field: 'credential_gap_months',
              expected: this.thresholds.credentialGapMax,
              observed: gapMonths,
              deviation: ((gapMonths / this.thresholds.credentialGapMax) - 1) * 100,
            },
          ],
          recommendations: [
            'Verify credentials were not missed during this period',
            'Check if this gap is expected based on career path',
          ],
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect role-related anomalies
   */
  private detectRoleAnomalies(roles: RoleNode[]): IdentityAnomaly[] {
    const anomalies: IdentityAnomaly[] = [];

    // Check for overlapping roles
    const activeRoles = roles.filter((r) => !r.endDate || r.endDate > new Date());

    if (activeRoles.length > 3) {
      anomalies.push({
        id: this.generateId(),
        type: 'role_inconsistency',
        severity: 'medium',
        detectedAt: new Date(),
        description: `Multiple active roles detected: ${activeRoles.length}`,
        affectedEntities: activeRoles.map((r) => r.id),
        confidence: 0.6,
        evidence: [
          {
            field: 'active_roles',
            expected: 1,
            observed: activeRoles.length,
            deviation: (activeRoles.length - 1) * 100,
          },
        ],
        recommendations: [
          'Verify all roles are current and accurate',
          'Check for role transitions that need end dates',
          'Confirm if multiple concurrent roles are expected',
        ],
      });
    }

    // Check for rapid role transitions
    const sortedRoles = [...roles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const recentRoles = sortedRoles.filter((r) => r.startDate >= yearAgo);

    if (recentRoles.length > this.thresholds.roleTransitionMax) {
      anomalies.push({
        id: this.generateId(),
        type: 'unusual_pattern',
        severity: 'medium',
        detectedAt: new Date(),
        description: `High role transition rate: ${recentRoles.length} roles in the past year`,
        affectedEntities: recentRoles.map((r) => r.id),
        confidence: 0.75,
        evidence: [
          {
            field: 'role_transitions_per_year',
            expected: this.thresholds.roleTransitionMax,
            observed: recentRoles.length,
            deviation: ((recentRoles.length / this.thresholds.roleTransitionMax) - 1) * 100,
          },
        ],
        recommendations: [
          'Review role history for accuracy',
          'Verify if this transition rate is expected',
          'Check for data entry errors',
        ],
      });
    }

    return anomalies;
  }

  /**
   * Detect identity drift
   */
  private detectIdentityDrift(credentials: CredentialNode[], roles: RoleNode[]): IdentityAnomaly[] {
    const anomalies: IdentityAnomaly[] = [];

    // Calculate current metrics
    const currentCredentialCount = credentials.length;
    const currentRoleCount = roles.length;
    const currentCredentialValue = credentials.reduce((sum, c) => sum + c.value, 0) / Math.max(1, credentials.length);

    // Compare with baseline
    const credentialBaseline = this.getBaseline('credential_count', currentCredentialCount);
    const roleBaseline = this.getBaseline('role_count', currentRoleCount);
    const valueBaseline = this.getBaseline('credential_value_avg', currentCredentialValue);

    const drifts: IdentityDrift[] = [];

    if (credentialBaseline) {
      const deviation = Math.abs(currentCredentialCount - credentialBaseline.value) / Math.max(1, credentialBaseline.value);
      if (deviation > this.thresholds.driftThreshold) {
        drifts.push({
          metric: 'credential_count',
          baseline: credentialBaseline.value,
          current: currentCredentialCount,
          deviation: deviation * 100,
          trend: currentCredentialCount > credentialBaseline.value ? 'increasing' : 'decreasing',
          timeWindow: (Date.now() - credentialBaseline.timestamp.getTime()) / (1000 * 60 * 60 * 24),
        });
      }
    }

    if (drifts.length > 0) {
      const maxDrift = drifts.reduce((max, d) => (d.deviation > max.deviation ? d : max), drifts[0]);

      anomalies.push({
        id: this.generateId(),
        type: 'identity_drift',
        severity: maxDrift.deviation > 50 ? 'high' : maxDrift.deviation > 30 ? 'medium' : 'low',
        detectedAt: new Date(),
        description: `Identity drift detected in ${maxDrift.metric}: ${maxDrift.deviation.toFixed(1)}% change`,
        affectedEntities: credentials.map((c) => c.id).concat(roles.map((r) => r.id)),
        confidence: 0.8,
        evidence: drifts.map((d) => ({
          field: d.metric,
          expected: d.baseline,
          observed: d.current,
          deviation: d.deviation,
        })),
        recommendations: [
          'Review recent identity changes',
          'Verify drift is intentional and legitimate',
          'Update baseline metrics if changes are expected',
        ],
      });
    }

    return anomalies;
  }

  /**
   * Detect temporal anomalies
   */
  private detectTemporalAnomalies(
    credentials: CredentialNode[],
    vibrations: IdentityVibration[]
  ): IdentityAnomaly[] {
    const anomalies: IdentityAnomaly[] = [];

    // Check for unusual vibration patterns
    const recentVibrations = vibrations.filter(
      (v) => v.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    if (recentVibrations.length > 50) {
      anomalies.push({
        id: this.generateId(),
        type: 'unusual_pattern',
        severity: 'medium',
        detectedAt: new Date(),
        description: `Unusual activity pattern: ${recentVibrations.length} events in the past 24 hours`,
        affectedEntities: Array.from(new Set(recentVibrations.flatMap((v) => v.affectedFields))),
        confidence: 0.7,
        evidence: [
          {
            field: 'vibration_count_24h',
            expected: 10,
            observed: recentVibrations.length,
            deviation: ((recentVibrations.length / 10) - 1) * 100,
          },
        ],
        recommendations: [
          'Review recent identity activity',
          'Check for automated processes or bots',
          'Verify all changes are authorized',
        ],
      });
    }

    return anomalies;
  }

  /**
   * Get baseline metric or create one
   */
  private getBaseline(metric: string, currentValue: number): { value: number; timestamp: Date } | null {
    const existing = this.baselineMetrics.get(metric);

    if (!existing) {
      this.baselineMetrics.set(metric, { value: currentValue, timestamp: new Date() });
      return null;
    }

    // Update baseline if older than 30 days
    const daysSinceUpdate = (Date.now() - existing.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      this.baselineMetrics.set(metric, { value: currentValue, timestamp: new Date() });
      return null;
    }

    return existing;
  }

  /**
   * Update anomaly status (mark old ones as potentially resolved)
   */
  private updateAnomalyStatus(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    this.anomalies.forEach((anomaly) => {
      if (!anomaly.resolved && anomaly.detectedAt < thirtyDaysAgo && anomaly.severity === 'low') {
        // Could auto-resolve low severity anomalies after 30 days
        // For now, just leave them
      }
    });
  }

  /**
   * Get all active anomalies
   */
  getActiveAnomalies(): IdentityAnomaly[] {
    return this.anomalies.filter((a) => !a.resolved);
  }

  /**
   * Get anomalies by severity
   */
  getAnomaliesBySeverity(severity: AnomalySeverity): IdentityAnomaly[] {
    return this.anomalies.filter((a) => a.severity === severity && !a.resolved);
  }

  /**
   * Mark anomaly as resolved
   */
  resolveAnomaly(anomalyId: string): void {
    const anomaly = this.anomalies.find((a) => a.id === anomalyId);
    if (anomaly) {
      anomaly.resolved = true;
      anomaly.resolvedAt = new Date();
    }
  }

  private generateId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

