import { PrismaClient, NCIVerifiableProofType } from '@prisma/client';
import type { PassportEnvelope } from '../passport/v3/types';
import { VerifiableProofRegistry } from '../nci/verifiableProofRegistry';
import { verifyPassportCredential } from '../passport/v3/verifier';

export interface PassportExchangeRequest {
  fromOrgId: string;
  toOrgId: string;
  envelope: PassportEnvelope;
  credentials: Array<{
    sdJwt: string;
    disclosures: string[];
  }>;
  publicKeyHex: string;
}

export interface PassportExchangeResult {
  accepted: boolean;
  reasons: string[];
  verifiedCredentials: Array<{
    credentialId: string;
    domain: string;
    hash: string;
  }>;
}

export class PassportExchangeService {
  constructor(
    private readonly prisma: PrismaClient = new PrismaClient(),
    private readonly proofRegistry: VerifiableProofRegistry = new VerifiableProofRegistry(),
  ) {}

  async transfer(request: PassportExchangeRequest): Promise<PassportExchangeResult> {
    const reasons: string[] = [];

    const proofs = await this.proofRegistry.listProofs(
      request.envelope.holder.did,
      NCIVerifiableProofType.ISSUANCE,
    );
    if (!proofs.length) {
      reasons.push('No NCI issuance proofs found for passport holder.');
    }

    if (!request.envelope.summary.licenseCount) {
      reasons.push('No active licenses present.');
    }
    if (!request.envelope.summary.privilegeCount) {
      reasons.push('No granted privileges present.');
    }

    const verifiedCredentials = [];
    for (const credential of request.credentials) {
      try {
        const verification = await verifyPassportCredential({
          sdJwt: credential.sdJwt,
          disclosures: credential.disclosures,
          publicKeyHex: request.publicKeyHex,
        });
        verifiedCredentials.push({
          credentialId: verification.credentialId,
          domain: verification.domain,
          hash: verification.hash,
        });
      } catch (error: any) {
        reasons.push(
          `Credential verification failed: ${error.message ?? 'invalid credential'}`,
        );
      }
    }

    return {
      accepted: reasons.length === 0,
      reasons,
      verifiedCredentials,
    };
  }
}

export const passportExchangeService = new PassportExchangeService();

