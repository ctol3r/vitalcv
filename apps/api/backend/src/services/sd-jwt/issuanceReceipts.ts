import { generateIssuanceReceipt, type AuditReceipt } from '../audit/receiptGenerator';
import type { VerifiableCredential } from '../credentials/credentialModel';

export interface SdJwtIssuanceReceiptInput {
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  credentialType: string;
  compact: string;
  issuedAt: string;
  expiresAt?: string;
}

export async function recordIssuanceReceipt(
  receipt: SdJwtIssuanceReceiptInput,
): Promise<AuditReceipt> {
  const credential: VerifiableCredential = {
    credentialId: receipt.credentialId,
    issuer: receipt.issuerDid,
    subject: receipt.holderDid,
    claims: {
      type: ['VerifiableCredential', receipt.credentialType],
    },
    signature: receipt.compact,
    status: 'ACTIVE',
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
    schemaVersion: '1.0',
  };

  return generateIssuanceReceipt(credential, 'vc+sd-jwt');
}
