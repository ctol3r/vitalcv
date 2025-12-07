/**
 * B185C-PAYER-003: Enrollment discrepancy detector
 *
 * Inspects CAQH snapshots, payer configuration, and enrollment metadata to
 * surface actionable discrepancies credentialing teams need to resolve.
 */

import type { PayerEnrollmentV2Record } from './models/PayerEnrollmentV2.js';

export type DiscrepancyCode =
  | 'MISSING_CAQH_DATA'
  | 'SPECIALTY_MISMATCH'
  | 'MALPRACTICE_OUTDATED'
  | 'PANEL_CLOSED';

export interface DiscrepancyFinding {
  code: DiscrepancyCode;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation?: string;
  context?: Record<string, unknown>;
}

export interface CaqhDiscrepancySnapshot {
  hasProfile: boolean;
  missingSections?: string[];
  specialtyCodes?: string[];
  malpractice?: {
    carrier?: string;
    policyNumber?: string;
    expirationDate?: string | Date | null;
  } | null;
}

export interface PayerSummary {
  id: string;
  name: string;
  requiresCaqh?: boolean;
  specialty?: string[];
  states?: string[];
}

export interface DiscrepancyContext {
  clinicianId: string;
  clinicianSpecialty?: string;
  targetState?: string;
  caqh?: CaqhDiscrepancySnapshot;
  payer: PayerSummary;
  enrollment?: PayerEnrollmentV2Record | null;
}

export function detectPayerDiscrepancies(context: DiscrepancyContext): DiscrepancyFinding[] {
  const findings: DiscrepancyFinding[] = [];

  findings.push(...detectMissingCaqhData(context));
  findings.push(...detectSpecialtyMismatch(context));
  findings.push(...detectMalpractice(context));
  findings.push(...detectPanelClosed(context));

  return findings;
}

function detectMissingCaqhData(context: DiscrepancyContext): DiscrepancyFinding[] {
  const findings: DiscrepancyFinding[] = [];
  const requiresCaqh = context.payer.requiresCaqh ?? true;
  const profile = context.caqh;

  if (requiresCaqh && (!profile || !profile.hasProfile)) {
    findings.push({
      code: 'MISSING_CAQH_DATA',
      severity: 'critical',
      message: 'CAQH profile missing for payer that requires it',
      recommendation: 'Sync CAQH ProView or link clinician CAQH ID',
    });
    return findings;
  }

  if (profile && profile.missingSections && profile.missingSections.length > 0) {
    findings.push({
      code: 'MISSING_CAQH_DATA',
      severity: 'warning',
      message: `CAQH incomplete sections: ${profile.missingSections.join(', ')}`,
      recommendation: 'Complete missing CAQH sections before submission',
      context: { missingSections: profile.missingSections },
    });
  }

  return findings;
}

function detectSpecialtyMismatch(context: DiscrepancyContext): DiscrepancyFinding[] {
  const payerSpecialties = context.payer.specialty ?? [];
  if (payerSpecialties.length === 0) {
    return [];
  }

  const clinicianSpecialty = context.clinicianSpecialty?.toLowerCase();
  if (!clinicianSpecialty) {
    return [];
  }

  const matches = payerSpecialties.some(
    (specialty) => specialty.toLowerCase() === clinicianSpecialty
  );

  if (matches) {
    return [];
  }

  return [
    {
      code: 'SPECIALTY_MISMATCH',
      severity: 'critical',
      message: `Clinician specialty ${context.clinicianSpecialty} not accepted by ${context.payer.name}`,
      recommendation: 'Select a payer that supports this specialty or update target specialty',
      context: { payerSpecialties },
    },
  ];
}

function detectMalpractice(context: DiscrepancyContext): DiscrepancyFinding[] {
  const profile = context.caqh;
  if (!profile || !profile.hasProfile) return [];

  if (!profile.malpractice) {
    return [
      {
        code: 'MALPRACTICE_OUTDATED',
        severity: 'warning',
        message: 'Malpractice insurance is missing from CAQH',
        recommendation: 'Upload current malpractice certificate',
      },
    ];
  }

  const expirationDate = profile.malpractice.expirationDate
    ? new Date(profile.malpractice.expirationDate)
    : null;
  if (expirationDate && expirationDate < new Date()) {
    return [
      {
        code: 'MALPRACTICE_OUTDATED',
        severity: 'critical',
        message: 'Malpractice insurance expired',
        recommendation: 'Renew malpractice policy and update CAQH',
        context: { expiredOn: expirationDate.toISOString() },
      },
    ];
  }

  return [];
}

function detectPanelClosed(context: DiscrepancyContext): DiscrepancyFinding[] {
  const enrollment = context.enrollment;
  if (!enrollment) return [];

  if (enrollment.status === 'PANEL_FULL' || enrollment.panelType === 'CLOSED') {
    return [
      {
        code: 'PANEL_CLOSED',
        severity: 'warning',
        message: `${context.payer.name} panel is closed for this clinician`,
        recommendation: 'Re-attempt when panel reopens or request exception with payer relations',
      },
    ];
  }

  if (enrollment.status === 'REJECTED') {
    return [
      {
        code: 'PANEL_CLOSED',
        severity: 'critical',
        message: `${context.payer.name} rejected the panel request`,
        recommendation: 'Review rejection reasons and escalate if needed',
      },
    ];
  }

  return [];
}

