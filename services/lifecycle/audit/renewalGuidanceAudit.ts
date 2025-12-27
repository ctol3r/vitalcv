import { PrismaClient, Prisma } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { RenewalMethod } from '../models/CredentialLifecycle.js';

const log = getServiceLogger('lifecycle/audit/renewal-guidance');

export interface RenewalGuidanceAuditInput {
  credentialId: string;
  renewalAuthorityId?: string;
  renewalMethod: RenewalMethod;
  issuedBy?: string;
  policyId?: string;
  metadata?: Record<string, unknown>;
}

export class RenewalGuidanceAuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record issuance of renewal guidance for traceability.
   */
  async logGuidanceIssued(input: RenewalGuidanceAuditInput) {
    const auditEvent = await this.prisma.auditEvent.create({
      data: {
        type: 'RENEWAL_INSTRUCTIONS_AVAILABLE',
        subjectNpi: null,
        userId: input.issuedBy,
        data: {
          credentialId: input.credentialId,
          renewalAuthorityId: input.renewalAuthorityId,
          renewalMethod: input.renewalMethod,
          policyId: input.policyId,
          issuedAt: new Date().toISOString(),
          metadata: input.metadata || {},
        } as Prisma.InputJsonValue,
      },
    });

    log.info('Renewal guidance issued', {
      auditEventId: auditEvent.id,
      credentialId: input.credentialId,
      renewalAuthorityId: input.renewalAuthorityId,
      renewalMethod: input.renewalMethod,
    });

    return auditEvent;
  }
}

