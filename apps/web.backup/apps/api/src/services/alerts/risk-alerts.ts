import { randomUUID } from 'crypto';

const CRITICAL_THRESHOLD = 0.75;
const SPIKE_THRESHOLD = 0.2;

export type RiskAlertType = 'threshold' | 'spike';

export interface RiskAlertRecipient {
  id: string;
  role: 'issuer' | 'recruiter';
  channel?: 'email' | 'slack' | 'webhook';
}

export interface RiskAlertInput {
  clinicianId: string;
  currentScore: number;
  previousScore?: number | null;
  recipients: RiskAlertRecipient[];
  reasonCodes?: string[];
  metadata?: Record<string, unknown>;
}

export interface RiskAlert {
  id: string;
  clinicianId: string;
  recipientId: string;
  recipientRole: RiskAlertRecipient['role'];
  type: RiskAlertType;
  subject: string;
  message: string;
  severity: 'medium' | 'high';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function evaluateRiskAlerts(input: RiskAlertInput): RiskAlert[] {
  if (!input.recipients.length) {
    return [];
  }

  const alerts: RiskAlert[] = [];
  const nowIso = new Date().toISOString();
  const exceedsThreshold = input.currentScore >= CRITICAL_THRESHOLD;
  const spikeAmount =
    typeof input.previousScore === 'number'
      ? input.currentScore - input.previousScore
      : 0;
  const spikeTriggered = spikeAmount >= SPIKE_THRESHOLD;

  if (!exceedsThreshold && !spikeTriggered) {
    return alerts;
  }

  for (const recipient of input.recipients) {
    if (exceedsThreshold) {
      alerts.push({
        id: randomUUID(),
        clinicianId: input.clinicianId,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        type: 'threshold',
        subject: 'Composite risk exceeds critical threshold',
        message: buildThresholdMessage(input.currentScore, input.reasonCodes),
        severity: 'high',
        createdAt: nowIso,
        metadata: {
          score: input.currentScore,
          reasonCodes: input.reasonCodes ?? [],
          ...input.metadata,
        },
      });
    }

    if (spikeTriggered) {
      alerts.push({
        id: randomUUID(),
        clinicianId: input.clinicianId,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        type: 'spike',
        subject: 'Rapid risk spike detected',
        message: buildSpikeMessage(spikeAmount),
        severity: 'medium',
        createdAt: nowIso,
        metadata: {
          currentScore: input.currentScore,
          previousScore: input.previousScore ?? null,
          delta: Number(spikeAmount.toFixed(4)),
          ...input.metadata,
        },
      });
    }
  }

  return alerts;
}

function buildThresholdMessage(score: number, reasons?: string[]): string {
  const reasonSummary =
    reasons && reasons.length
      ? ` Drivers: ${reasons.join(', ')}.`
      : '';
  return `Composite risk score ${(score * 100).toFixed(
    1,
  )}% exceeds zero-trust ceiling.${reasonSummary}`;
}

function buildSpikeMessage(delta: number): string {
  return `Composite risk increased by ${(delta * 100).toFixed(
    1,
  )} points within the last evaluation window.`;
}

