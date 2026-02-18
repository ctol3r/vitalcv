/**
 * Phase 1F — PSV Monitoring Engine.
 *
 * Stateless delta detection for NormalizedCredentialPayload changes.
 * Compares old vs new payloads and produces a list of material changes.
 *
 * Material fields:
 *   - credential.status
 *   - credential.expirationDate
 *   - credential.issuingStateOrBody
 *   - credential.credentialIdentifier
 *   - credential.compactStatus
 */

import type { DeltaLogEntry, CredentialStatus } from '../../../types/psv';
import { randomUUID } from 'node:crypto';
import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ────────────────────────────────────────────────────

export interface MonitoredPayload {
  credential: {
    status: string;
    expirationDate?: string;
    issuingStateOrBody: string;
    credentialIdentifier: string;
    compactStatus?: {
      participating: boolean;
      compactName: string | null;
    };
  };
}

export interface MaterialChange {
  field: string;
  previousValue: string | null;
  currentValue: string | null;
}

export interface MonitoringResult {
  changeDetected: boolean;
  changes: MaterialChange[];
  deltaLogEntries: DeltaLogEntry[];
}

// ── Detect changes ───────────────────────────────────────────

export function detectMaterialChange(
  oldPayload: MonitoredPayload,
  newPayload: MonitoredPayload,
): MaterialChange[] {
  const changes: MaterialChange[] = [];
  const oldCred = oldPayload.credential;
  const newCred = newPayload.credential;

  // Status
  if (oldCred.status !== newCred.status) {
    changes.push({
      field: 'credential.status',
      previousValue: oldCred.status,
      currentValue: newCred.status,
    });
  }

  // Expiration date
  const oldExp = oldCred.expirationDate ?? null;
  const newExp = newCred.expirationDate ?? null;
  if (oldExp !== newExp) {
    changes.push({
      field: 'credential.expirationDate',
      previousValue: oldExp,
      currentValue: newExp,
    });
  }

  // Issuing state or body
  if (oldCred.issuingStateOrBody !== newCred.issuingStateOrBody) {
    changes.push({
      field: 'credential.issuingStateOrBody',
      previousValue: oldCred.issuingStateOrBody,
      currentValue: newCred.issuingStateOrBody,
    });
  }

  // Credential identifier
  if (oldCred.credentialIdentifier !== newCred.credentialIdentifier) {
    changes.push({
      field: 'credential.credentialIdentifier',
      previousValue: oldCred.credentialIdentifier,
      currentValue: newCred.credentialIdentifier,
    });
  }

  // Compact status (deep compare)
  const oldCompact = oldCred.compactStatus
    ? JSON.stringify(oldCred.compactStatus)
    : null;
  const newCompact = newCred.compactStatus
    ? JSON.stringify(newCred.compactStatus)
    : null;
  if (oldCompact !== newCompact) {
    changes.push({
      field: 'credential.compactStatus',
      previousValue: oldCompact,
      currentValue: newCompact,
    });
  }

  return changes;
}

// ── Run monitoring check ─────────────────────────────────────

export function runMonitoringCheck(
  oldPayload: MonitoredPayload,
  newPayload: MonitoredPayload,
): MonitoringResult {
  const changes = detectMaterialChange(oldPayload, newPayload);

  if (changes.length === 0) {
    return { changeDetected: false, changes: [], deltaLogEntries: [] };
  }

  const deltaLogEntries: DeltaLogEntry[] = changes
    .filter((c) => c.field === 'credential.status')
    .map((c) => ({
      changeId: randomUUID(),
      previousStatus: (c.previousValue ?? 'Unknown') as CredentialStatus,
      newStatus: (c.currentValue ?? 'Unknown') as CredentialStatus,
      detectedAt: new Date().toISOString(),
      deltaPayloadHash: sha256ForPayload({
        previousValue: c.previousValue,
        currentValue: c.currentValue,
        detectedAt: new Date().toISOString(),
      }),
    }));

  return {
    changeDetected: true,
    changes,
    deltaLogEntries,
  };
}
