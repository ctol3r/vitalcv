import { randomUUID } from 'crypto';
import type {
  Credential,
  ChangeField,
  ChangeSet,
  DeltaLogEntry,
  PsvArtifact,
  NormalizedCredentialPayload,
  Monitoring,
} from '../types/psv';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';
import { buildPsvArtifact, SignFunction } from './artifactBuilder';

// Fields that constitute a material change in credential status
const MATERIAL_FIELDS: (keyof Credential)[] = [
  'status',
  'expirationDate',
  'issuingStateOrBody',
  'credentialIdentifier',
  'compactStatus',
];

/**
 * Compare two credential arrays and detect changes.
 * Returns a ChangeSet describing what changed.
 */
export function detectMaterialChange(
  oldCredentials: Credential[],
  newCredentials: Credential[],
): ChangeSet {
  const changedFields: ChangeField[] = [];

  // Compare credentials by index (same order from same adapter)
  const maxLen = Math.max(oldCredentials.length, newCredentials.length);

  for (let i = 0; i < maxLen; i++) {
    const oldCred = oldCredentials[i];
    const newCred = newCredentials[i];

    if (!oldCred && newCred) {
      changedFields.push({
        field: `credentials[${i}]`,
        previousValue: '',
        newValue: `ADDED: ${newCred.credentialType}`,
      });
      continue;
    }

    if (oldCred && !newCred) {
      changedFields.push({
        field: `credentials[${i}]`,
        previousValue: `${oldCred.credentialType}`,
        newValue: 'REMOVED',
      });
      continue;
    }

    if (oldCred && newCred) {
      for (const field of MATERIAL_FIELDS) {
        const oldVal = String(oldCred[field]);
        const newVal = String(newCred[field]);
        if (oldVal !== newVal) {
          changedFields.push({
            field: `credentials[${i}].${field}`,
            previousValue: oldVal,
            newValue: newVal,
          });
        }
      }
    }
  }

  const materialChange = changedFields.length > 0;
  const changeHash = sha256(canonicalize(changedFields));

  return {
    changedFields,
    materialChange,
    changeHash,
  };
}

export interface MonitoringResult {
  changed: boolean;
  artifact: PsvArtifact;
  deltaEntry: DeltaLogEntry | null;
}

/**
 * Run a monitoring check: compare existing artifact against fresh data.
 * If material change detected, build new artifact with delta log entry.
 * If no change, update lastCheckedAt and return existing artifact.
 */
export async function runMonitoringCheck(
  existingArtifact: PsvArtifact,
  newPayload: NormalizedCredentialPayload,
  sign: SignFunction,
): Promise<MonitoringResult> {
  const changeSet = detectMaterialChange(
    existingArtifact.credentials,
    newPayload.credentials,
  );

  if (!changeSet.materialChange) {
    // No change — just update monitoring timestamp
    const updatedMonitoring: Monitoring = {
      ...existingArtifact.monitoring,
      lastCheckedAt: new Date().toISOString(),
    };

    return {
      changed: false,
      artifact: {
        ...existingArtifact,
        monitoring: updatedMonitoring,
      },
      deltaEntry: null,
    };
  }

  // Material change detected — build new artifact
  const buildResult = await buildPsvArtifact(newPayload, sign);
  const newArtifact = buildResult.artifact;

  const deltaEntry: DeltaLogEntry = {
    deltaId: randomUUID(),
    detectedAt: new Date().toISOString(),
    changeSet,
    previousArtifactHash: existingArtifact.integrity.artifactHash,
    newArtifactHash: newArtifact.integrity.artifactHash,
  };

  // Append delta to new artifact's log
  const finalArtifact: PsvArtifact = {
    ...newArtifact,
    deltaLog: [...existingArtifact.deltaLog, deltaEntry],
    monitoring: {
      ...newArtifact.monitoring,
      lastCheckedAt: new Date().toISOString(),
      deltaLog: [...existingArtifact.monitoring.deltaLog, deltaEntry],
    },
  };

  return {
    changed: true,
    artifact: finalArtifact,
    deltaEntry,
  };
}
