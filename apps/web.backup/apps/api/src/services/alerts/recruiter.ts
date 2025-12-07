import { randomUUID } from 'crypto';

export type RecruiterAlertType =
  | 'readinessThreshold'
  | 'surgePoolMatch'
  | 'credentialExpiring';

export type RecruiterAlertSeverity = 'info' | 'warning' | 'critical';

export interface RecruiterAlert {
  id: string;
  clinicianId: string;
  type: RecruiterAlertType;
  severity: RecruiterAlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SurgePoolMatch {
  jobId: string;
  score: number;
  specialty: string;
  matchedAt?: string;
}

export interface ExpiringCredential {
  credentialId: string;
  label: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface RecruiterAlertInput {
  clinicianId: string;
  readinessScoreBefore?: number;
  readinessScoreAfter: number;
  surgeMatches?: SurgePoolMatch[];
  expiringCredentials?: ExpiringCredential[];
}

export function evaluateRecruiterAlerts(input: RecruiterAlertInput): RecruiterAlert[] {
  const alerts: RecruiterAlert[] = [];

  if (
    typeof input.readinessScoreBefore === 'number' &&
    input.readinessScoreBefore < 0.85 &&
    input.readinessScoreAfter >= 0.85
  ) {
    alerts.push(createAlert(input.clinicianId, {
      type: 'readinessThreshold',
      severity: 'info',
      message: `Clinician readiness crossed 0.85 (${(input.readinessScoreAfter * 100).toFixed(1)}%)`,
      metadata: {
        previous: input.readinessScoreBefore,
        current: input.readinessScoreAfter,
      },
    }));
  }

  (input.surgeMatches ?? []).forEach((match) => {
    alerts.push(
      createAlert(input.clinicianId, {
        type: 'surgePoolMatch',
        severity: match.score >= 0.8 ? 'info' : 'warning',
        message: `New surge pool match for ${match.specialty} (${Math.round(match.score * 100)}% fit)`,
        metadata: match,
      }),
    );
  });

  (input.expiringCredentials ?? [])
    .filter((credential) => credential.daysUntilExpiry <= 30)
    .forEach((credential) => {
      alerts.push(
        createAlert(input.clinicianId, {
          type: 'credentialExpiring',
          severity: credential.daysUntilExpiry <= 7 ? 'critical' : 'warning',
          message: `${credential.label} expires in ${credential.daysUntilExpiry} days`,
          metadata: credential,
        }),
      );
    });

  return alerts;
}

function createAlert(
  clinicianId: string,
  details: Omit<RecruiterAlert, 'id' | 'clinicianId' | 'createdAt'>,
): RecruiterAlert {
  return {
    id: randomUUID(),
    clinicianId,
    createdAt: new Date().toISOString(),
    ...details,
  };
}










