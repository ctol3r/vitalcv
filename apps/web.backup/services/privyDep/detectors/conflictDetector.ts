import { eventBus } from '../../../backend/src/services/notifications/eventBus';
import { buildClinicianPrivilegeSnapshot } from '../clinicianSnapshot';
import { fetchPrivilegeMatrixEntries } from '../graph';
import { normalizePrivilegeCode, PrivilegeMatrixEntry, PrivilegePrerequisite } from '../types';
import { createDriftEvent, DriftEvent } from '../../drift/utils';
import { emitPrivilegeGraphChange } from '../events/emitter';
import { CredentialRiskFactors } from '../../credentialRisk/enums';

const DETECTOR_ID = 'PrivilegeConflictDetector';

export interface PrivilegeConflict {
  privileges: string[];
  reason: string;
  group?: string;
}

export interface PrivilegeConflictDetectionResult {
  clinicianId: string;
  conflicts: PrivilegeConflict[];
  events: DriftEvent[];
}

function extractConflictPairs(entry: PrivilegeMatrixEntry): PrivilegeConflict[] {
  const conflicts: PrivilegeConflict[] = [];
  for (const prerequisite of entry.prerequisites) {
    if (prerequisite.type !== 'CONFLICT') continue;
    const codes = prerequisite.privilegeCodes.map((code) => normalizePrivilegeCode(code)).filter(Boolean);
    if (!codes.length) continue;
    conflicts.push({
      privileges: [entry.privilegeCode, ...codes],
      reason: prerequisite.description ?? `Conflicts with ${codes.join(', ')}`,
    });
  }
  return conflicts;
}

function extractMutexTag(entry: PrivilegeMatrixEntry): string | undefined {
  for (const tag of entry.tags ?? []) {
    const [prefix, value] = tag.split(':', 2);
    if (prefix?.toLowerCase() === 'mutex' && value) {
      return normalizePrivilegeCode(value);
    }
  }
  return undefined;
}

export async function detectPrivilegeConflicts(input: {
  clinicianId: string;
  orgId?: string;
  broadcast?: boolean;
}): Promise<PrivilegeConflictDetectionResult> {
  const snapshot = await buildClinicianPrivilegeSnapshot(input.clinicianId);
  const grantedCodes = Array.from(snapshot.grantedPrivilegeCodes);

  if (grantedCodes.length < 2) {
    return {
      clinicianId: snapshot.clinicianId,
      conflicts: [],
      events: [],
    };
  }

  const entries = await fetchPrivilegeMatrixEntries(grantedCodes, true);
  const conflicts: PrivilegeConflict[] = [];
  const mutexGroups = new Map<string, Set<string>>();

  for (const entry of entries) {
    conflicts.push(...extractConflictPairs(entry));
    const mutexGroup = extractMutexTag(entry);
    if (mutexGroup) {
      if (!mutexGroups.has(mutexGroup)) {
        mutexGroups.set(mutexGroup, new Set());
      }
      mutexGroups.get(mutexGroup)!.add(entry.privilegeCode);
    }
  }

  for (const [group, codes] of mutexGroups.entries()) {
    if (codes.size > 1) {
      conflicts.push({
        privileges: Array.from(codes),
        reason: `Mutex group ${group} cannot be held simultaneously`,
        group,
      });
    }
  }

  const filteredConflicts = conflicts.filter((conflict) =>
    conflict.privileges.every((code) => snapshot.grantedPrivilegeCodes.has(code))
  );

  if (!filteredConflicts.length) {
    return {
      clinicianId: snapshot.clinicianId,
      conflicts: [],
      events: [],
    };
  }

  const events: DriftEvent[] = filteredConflicts.map((conflict) =>
    createDriftEvent({
      detector: DETECTOR_ID,
      category: 'privilege',
      severity: 'high',
      title: 'Mutually exclusive privileges detected',
      summary: conflict.reason,
      subject: {
        type: 'privilege',
        id: conflict.privileges.join('+'),
        label: conflict.privileges.join(', '),
      },
      metadata: {
        clinicianId: snapshot.clinicianId,
        privileges: conflict.privileges,
        group: conflict.group,
      },
      recommendations: [
        'Review privilege assignments for clinical safety',
        'Notify medical staff office to reconcile privilege set',
      ],
    })
  );

  await eventBus.publish('CredentialDiscrepancyFound', {
    clinicianId: snapshot.clinicianId,
    clinicianDid: snapshot.clinicianDid,
    npi: snapshot.customAttributes.npi as string | undefined,
    issue: 'PRIVILEGE_CONFLICT',
    severity: 'CRITICAL',
    detectedAt: new Date().toISOString(),
    remediation: 'Place conflicting privilege on hold and trigger review',
    metadata: {
      conflicts: filteredConflicts,
    },
  });

  if (input.broadcast) {
    await emitPrivilegeGraphChange({
      clinicianId: snapshot.clinicianId,
      clinicianDid: snapshot.clinicianDid,
      orgId: input.orgId,
      changeType: 'PRIVILEGE_CONFLICT',
      privilegeCode: filteredConflicts[0].privileges[0],
      reason: filteredConflicts[0].reason,
      conflicts: filteredConflicts.map((conflict) => conflict.privileges.join(', ')),
      riskFactorsToAdd: [CredentialRiskFactors.PRIVILEGE_CONFLICT],
      metadata: {
        conflicts: filteredConflicts,
      },
    });
  }

  return {
    clinicianId: snapshot.clinicianId,
    conflicts: filteredConflicts,
    events,
  };
}

