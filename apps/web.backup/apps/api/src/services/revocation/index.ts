import { ChainClient } from '../chain/client';
import { statusListService } from '../status/statusList';

export type RevocationReasonCode =
  | 'LapsedLicense'
  | 'SanctionsMatch'
  | 'NPDBHit'
  | 'EmployerRequest';

export interface RevocationRequest {
  credentialId: string;
  reasonCode: RevocationReasonCode;
  issuedBy: string;
  statusListIndex: number;
  listId?: string;
  expiresAt?: Date;
  credentialHash?: string;
  notes?: string;
}

export interface RevocationRecord {
  credentialId: string;
  reasonCode: RevocationReasonCode;
  revokedAt: string;
  issuedBy: string;
  statusListIndex: number;
  listId: string;
  anchorReceiptId: string;
  metadata?: Record<string, unknown>;
}

const chainClient = new ChainClient();

export class RevocationService {
  async revoke(request: RevocationRequest): Promise<RevocationRecord> {
    const listId = request.listId ?? 'status-list-1';

    statusListService.markStatus(request.credentialId, 'revoked', {
      reason: request.reasonCode,
      index: request.statusListIndex,
      listId,
      hash: request.credentialHash,
      expiresAt: request.expiresAt,
    });

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'credential_revoked',
      payload: {
        credentialId: request.credentialId,
        reasonCode: request.reasonCode,
        statusListIndex: request.statusListIndex,
        listId,
        issuedBy: request.issuedBy,
        notes: request.notes,
      },
      tags: ['revocation', request.reasonCode],
    });

    return {
      credentialId: request.credentialId,
      reasonCode: request.reasonCode,
      revokedAt: receipt.timestamp,
      issuedBy: request.issuedBy,
      statusListIndex: request.statusListIndex,
      listId,
      anchorReceiptId: receipt.txHash,
      metadata: request.notes ? { notes: request.notes } : undefined,
    };
  }
}

export const revocationService = new RevocationService();










