import crypto from 'crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export class AuditAnchor {
  /**
   * Anchors a revocation event immutably to the AuditEvent log.
   * @param npi The clinician NPI
   * @param source The source of the revocation (e.g., 'OIG', 'SAM.gov')
   * @param rawResponse The exact JSON response from the authority
   * @param reason The reason for revocation
   */
  async logRevocation(
    npi: string,
    source: string,
    rawResponse: unknown,
    reason: string,
  ): Promise<string> {
    const payloadString = JSON.stringify(rawResponse);
    const hash = crypto.createHash('sha256').update(payloadString).digest('hex');

    const auditEvent = await prisma.auditEvent.create({
      data: {
        type: 'AUTO_REVOCATION',
        hash,
        clinicianId: npi,
        metadata: {
          source,
          reason,
          rawResponse,
        } as any,
      },
    });

    log('info', `[AuditAnchor] Anchored revocation for NPI ${npi} from ${source}`, {
      auditEventId: auditEvent.id,
      hash,
    });

    return auditEvent.id;
  }
}

export const auditAnchor = new AuditAnchor();
