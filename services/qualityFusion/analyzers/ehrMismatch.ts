import type { DriftEvent } from '../../drift/types';
import { createDriftEvent } from '../../drift/utils';
import { QualitySignal, createQualitySignal } from '../models/QualitySignal';

export interface EhrPrivilegeSnapshot {
  code: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'PENDING' | 'REVOKED';
  department?: string;
  lastSyncedAt?: Date;
}

export interface VitalPrivilegeSnapshot {
  code: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  grantedAt?: Date;
  suspendedAt?: Date;
}

export interface EhrPrivilegeMismatchInput {
  clinicianId: string;
  orgId?: string;
  ehrPrivileges: EhrPrivilegeSnapshot[];
  vitalPrivileges: VitalPrivilegeSnapshot[];
}

export interface EhrPrivilegeMismatchResult {
  signals: QualitySignal[];
  driftEvents: DriftEvent[];
  mismatches: {
    missingInVital: string[];
    missingInEhr: string[];
    downgraded: string[];
  };
}

const ACTIVE_STATUSES = new Set(['ACTIVE', 'APPROVED', 'CURRENT']);

export function analyzeEhrPrivilegeMismatch(
  input: EhrPrivilegeMismatchInput,
): EhrPrivilegeMismatchResult {
  const ehrActive = normalizeActiveCodes(input.ehrPrivileges);
  const vitalActive = normalizeActiveCodes(input.vitalPrivileges);

  const missingInVital = ehrActive.filter((code) => !vitalActive.includes(code));
  const missingInEhr = vitalActive.filter((code) => !ehrActive.includes(code));

  const downgraded = input.vitalPrivileges
    .filter((priv) => priv.status === 'SUSPENDED' && ehrActive.includes(priv.code))
    .map((priv) => priv.code);

  const mismatches = {
    missingInVital,
    missingInEhr,
    downgraded,
  };

  if (
    missingInVital.length === 0 &&
    missingInEhr.length === 0 &&
    downgraded.length === 0
  ) {
    return {
      signals: [],
      driftEvents: [],
      mismatches,
    };
  }

  const signals: QualitySignal[] = [
    createQualitySignal({
      clinicianId: input.clinicianId,
      signalType: 'EHR_PRIVILEGE_MISMATCH',
      severity: 'CRITICAL',
      timestamp: new Date(),
      details: {
        summary: 'EHR privilege roster does not match VitalCV records',
        metadata: mismatches,
      },
      source: 'qualityFusion/ehrMismatch',
    }),
  ];

  const driftEvents: DriftEvent[] = [
    createDriftEvent({
      detector: 'EhrPrivilegeMismatch',
      category: 'licensure',
      severity: 'critical',
      title: 'EHR privilege mismatch detected',
      summary: `EHR privileges differ from VitalCV (${missingInVital.length} missing in Vital, ${missingInEhr.length} missing in EHR).`,
      subject: {
        type: 'clinician',
        id: input.clinicianId,
      },
      metadata: {
        ...mismatches,
        orgId: input.orgId,
      },
      recommendations: [
        'Synchronize VitalCV privileges with EHR',
        'Pause privileging approvals until mismatch is resolved',
      ],
    }),
  ];

  if (missingInVital.length === 0 && downgraded.length === 0 && missingInEhr.length > 0) {
    // No EHR overstatement, downgrade severity of drift, but keep quality signal critical per requirement
    driftEvents[0].severity = 'high';
  }

  return {
    signals,
    driftEvents,
    mismatches,
  };
}

function normalizeActiveCodes(
  privileges: Array<EhrPrivilegeSnapshot | VitalPrivilegeSnapshot>,
): string[] {
  return privileges
    .filter((priv) => {
      if (!priv.code) return false;
      if (!priv.status) return true;
      return ACTIVE_STATUSES.has(priv.status.toUpperCase());
    })
    .map((priv) => priv.code)
    .sort();
}

