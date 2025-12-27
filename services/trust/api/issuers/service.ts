import { createHash } from 'crypto';
import {
  Issuer,
  IssuerAnchor,
  IssuerAnchorType,
  RegisterIssuerInput,
  VerifyIssuerInput,
} from './models';

interface TrustLedgerAnchorRequest {
  issuerId: string;
  type: IssuerAnchorType;
  payload: Record<string, unknown>;
}

interface TrustLedgerClient {
  anchor(request: TrustLedgerAnchorRequest): Promise<IssuerAnchor>;
}

class HashTrustLedgerClient implements TrustLedgerClient {
  constructor(private polkadot?: { anchorData?: (payload: string) => Promise<string> }) {}

  async anchor(request: TrustLedgerAnchorRequest): Promise<IssuerAnchor> {
    const digest = createHash('sha256')
      .update(JSON.stringify({ issuerId: request.issuerId, payload: request.payload }))
      .digest('hex');

    const txId = this.polkadot?.anchorData
      ? await this.polkadot.anchorData(digest)
      : `simulated-${digest.slice(0, 16)}`;

    return {
      type: request.type,
      txId,
      digest,
      anchoredAt: new Date(),
      metadata: { ...request.payload, issuerId: request.issuerId },
    };
  }
}

export class IssuerRegistryService {
  private issuers = new Map<string, Issuer>();

  constructor(private trustLedger: TrustLedgerClient = new HashTrustLedgerClient()) {}

  async registerIssuer(input: RegisterIssuerInput): Promise<Issuer> {
    const issuerId = input.id.trim();
    if (!issuerId) {
      throw new Error('issuer id is required');
    }

    const normalizedNpi = input.npiType2.replace(/\D/g, '');
    if (normalizedNpi.length !== 10) {
      throw new Error('npiType2 must be a 10-digit organizational NPI');
    }

    const existing = this.issuers.get(issuerId);
    const anchor = await this.trustLedger.anchor({
      issuerId,
      type: 'registration',
      payload: {
        npiType2: normalizedNpi,
        metadata: input.metadata,
        event: 'issuer_registered',
      },
    });

    const issuer: Issuer = existing
      ? {
          ...existing,
          npiType2: normalizedNpi,
          anchors: [...existing.anchors, anchor],
        }
      : {
          id: issuerId,
          npiType2: normalizedNpi,
          verified: false,
          anchors: [anchor],
        };

    this.issuers.set(issuerId, issuer);
    return issuer;
  }

  async verifyIssuer(input: VerifyIssuerInput): Promise<Issuer> {
    const issuer = this.issuers.get(input.id);
    if (!issuer) {
      throw new Error(`issuer ${input.id} is not registered`);
    }

    const attestationDigest = createHash('sha256').update(input.attestation).digest('hex');
    const anchor = await this.trustLedger.anchor({
      issuerId: issuer.id,
      type: 'verification',
      payload: {
        attestationDigest,
        verifierDid: input.verifierDid,
        evidenceUri: input.evidenceUri,
        event: 'issuer_verified',
      },
    });

    const updated: Issuer = {
      ...issuer,
      verified: true,
      anchors: [...issuer.anchors, anchor],
    };

    this.issuers.set(issuer.id, updated);
    return updated;
  }
}

export function createIssuerRegistryService(
  trustLedger?: TrustLedgerClient
): IssuerRegistryService {
  return new IssuerRegistryService(trustLedger);
}
