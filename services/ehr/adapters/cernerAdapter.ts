import { getServiceLogger } from '../../logging/serviceLogger.js';
import { EhrSynchronizationStatus } from '../models/EHRSynchronization.js';
import { EhrAdapter, EhrPrivilegeAssignmentRequest, EhrPrivilegeAssignmentResult } from './types.js';

const log = getServiceLogger('ehr/adapters/cerner');

interface CernerMetadata {
  role?: string;
  auditOnly?: boolean;
  simulateWarning?: boolean;
}

export class CernerAdapter implements EhrAdapter {
  async assignPrivilege(request: EhrPrivilegeAssignmentRequest): Promise<EhrPrivilegeAssignmentResult> {
    const metadata = (request.metadata ?? {}) as CernerMetadata;
    const assignedRole = metadata.role ?? 'STANDARD-PRACTITIONER';
    const auditId = `cerner-audit-${Date.now()}`;

    const rawResponse = {
      auditId,
      assignedRole: metadata.auditOnly ? null : assignedRole,
      auditOnly: metadata.auditOnly ?? false,
      privilegeCode: request.privilegeCode,
      clinicianId: request.clinicianId,
      warnings: metadata.simulateWarning ? ['Role already active'] : [],
    };

    const message = metadata.auditOnly
      ? 'Cerner audit completed without role mutation'
      : `Cerner role ${assignedRole} assigned`;

    log.info('CernerAdapter role push', {
      clinicianId: request.clinicianId,
      privilegeCode: request.privilegeCode,
      assignedRole,
      auditOnly: metadata.auditOnly ?? false,
      auditId,
    });

    return {
      success: true,
      status: EhrSynchronizationStatus.SYNCED,
      message,
      rawResponse,
    };
  }
}
