import { getServiceLogger } from '../../logging/serviceLogger.js';
import { EhrSynchronizationStatus } from '../models/EHRSynchronization.js';
import { EhrAdapter, EhrPrivilegeAssignmentRequest, EhrPrivilegeAssignmentResult } from './types.js';

const log = getServiceLogger('ehr/adapters/epic');

export class EpicAdapter implements EhrAdapter {
  async assignPrivilege(request: EhrPrivilegeAssignmentRequest): Promise<EhrPrivilegeAssignmentResult> {
    const mockResponse = {
      requestId: `epic-${Date.now()}`,
      endpoint: '/fhir/R4/PrivilegeAssignment',
      privilegeCode: request.privilegeCode,
      clinicianId: request.clinicianId,
    };

    const shouldFail = request.metadata?.simulateFailure === true;
    const result: EhrPrivilegeAssignmentResult = shouldFail
      ? {
          success: false,
          status: EhrSynchronizationStatus.FAILED,
          message: 'Epic adapter simulated failure',
          rawResponse: { ...mockResponse, status: 500, error: 'Simulated failure' },
          error: 'Simulated Epic privilege failure',
        }
      : {
          success: true,
          status: EhrSynchronizationStatus.SYNCED,
          message: 'Epic privilege assignment acknowledged',
          rawResponse: { ...mockResponse, status: 200 },
        };

    log.info('EpicAdapter privilege push', {
      success: result.success,
      clinicianId: request.clinicianId,
      privilegeCode: request.privilegeCode,
      response: result.rawResponse,
    });

    return result;
  }
}
