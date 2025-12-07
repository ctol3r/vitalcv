import { getServiceLogger } from '../../logging/serviceLogger.js';
import { EhrAdapter, EhrPrivilegeAssignmentRequest, EhrPrivilegeAssignmentResult } from './types.js';
import { EhrSynchronizationStatus } from '../models/EHRSynchronization.js';

const log = getServiceLogger('ehr/adapters/meditech');

const PRIVILEGE_MAP: Record<string, string> = {
  'MED-CORE': 'CORE-ACCESS',
  'MED-ORDERS': 'ORDER-ENTRY',
  'MED-LAB': 'LAB-READ',
};

const FALLBACK_PRIVILEGE = 'BASIC-ACCESS';

export class MeditechAdapter implements EhrAdapter {
  async assignPrivilege(request: EhrPrivilegeAssignmentRequest): Promise<EhrPrivilegeAssignmentResult> {
    const mappedPrivilege = PRIVILEGE_MAP[request.privilegeCode] ?? FALLBACK_PRIVILEGE;
    const usedFallback = mappedPrivilege === FALLBACK_PRIVILEGE && !(request.privilegeCode in PRIVILEGE_MAP);

    const rawResponse = {
      ticket: `meditech-${Date.now()}`,
      mappedPrivilege,
      fallbackApplied: usedFallback,
      clinicianId: request.clinicianId,
    };

    log.info('MeditechAdapter privilege mapping', {
      clinicianId: request.clinicianId,
      originalPrivilege: request.privilegeCode,
      mappedPrivilege,
      fallbackApplied: usedFallback,
    });

    return {
      success: true,
      status: EhrSynchronizationStatus.SYNCED,
      message: usedFallback
        ? `Fallback Meditech privilege ${FALLBACK_PRIVILEGE} applied`
        : `Meditech privilege ${mappedPrivilege} applied`,
      rawResponse,
    };
  }
}


