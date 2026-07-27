/**
 * VitalCV self-issued trust container — ADR: adr-credential-container-provider.md
 *
 * Signs the credential envelope as an ES256 VC-JWT under the VitalCV
 * issuer identity (did:web:vitalcv.com), verifiable against the public
 * JWKS already published at /.well-known/jwks.json. No external vendor.
 *
 * SHIPS DARK: `createTrustContainer()` still defaults to the mock
 * provider. Selecting this provider requires TRUST_CONTAINER_PROVIDER=vitalcv
 * plus the signing key env (RECEIPT_PRIVATE_KEY_JWK + RECEIPT_KID — the
 * same ES256 identity the receipt issuer uses). Missing config throws
 * MISSING_CONFIG, which the issuance path converts into an explicit
 * `failed` manifest entry — never a silent mock fallback.
 *
 * Honesty rules:
 *   - anchorReceipt() refuses: anchoring is parked per the substrate ADR,
 *     and this provider will not fabricate a txHash.
 *   - resolveDid() only resolves the local issuer DID.
 *   - mock is always false; the manifest labels this environment
 *     'vitalcv-signed'.
 */

// `CryptoKey` is intentionally NOT imported from jose. v6 exports the type and
// v5 does not, so importing it pins this file to a single major. The global
// WebCrypto `CryptoKey` (Node 18+) is structurally what `importJWK` returns for
// an asymmetric key and is what `SignJWT.sign()` accepts, so using the global
// keeps this file compiling against either.
import { SignJWT, importJWK, jwtVerify, type JWK } from 'jose';
import { sha256Hex, stableStringify } from '../../../utils/deterministic';
import type {
  AnchorReceiptResult,
  CredentialEnvelopePayload,
  DidDocument,
  HealthCheckResult,
  IssuedCredentialResult,
  PresentationResult,
  ProofBundleExport,
  TrustContainerProvider,
  TrustContainerProviderKind,
  VerificationResult,
} from './trustContainerContract';
import {
  assertLimitationConsistency,
  TrustContainerProviderError,
} from './trustContainerContract';

const DEFAULT_ISSUER_DID = 'did:web:vitalcv.com';
const VC_JWT_TYP = 'vc+jwt';

export interface VitalCvTrustContainerConfig {
  /** ES256 private key as a JWK JSON string (same shape as RECEIPT_PRIVATE_KEY_JWK). */
  privateKeyJwk?: string;
  /** Key id published in the JWKS (e.g. vcv-es256-prod-1). */
  kid?: string;
  /** Issuer DID; defaults to did:web:vitalcv.com. */
  issuerDid?: string;
}

interface LoadedKeyMaterial {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JWK;
  kid: string;
  issuerDid: string;
}

export class VitalCvTrustContainer implements TrustContainerProvider {
  readonly kind: TrustContainerProviderKind = 'vitalcv';

  private readonly privateKeyJwkRaw: string;
  private readonly kid: string;
  private readonly issuerDid: string;
  private keyMaterial: LoadedKeyMaterial | null = null;

  constructor(config: VitalCvTrustContainerConfig = {}) {
    const privateKeyJwk = config.privateKeyJwk ?? process.env.RECEIPT_PRIVATE_KEY_JWK;
    const kid = config.kid ?? process.env.RECEIPT_KID;
    const missing: string[] = [];
    if (!privateKeyJwk?.trim()) missing.push('RECEIPT_PRIVATE_KEY_JWK');
    if (!kid?.trim()) missing.push('RECEIPT_KID');
    if (missing.length > 0) {
      throw new TrustContainerProviderError(
        `VitalCV trust container requires signing config: ${missing.join(', ')} not set`,
        'MISSING_CONFIG',
      );
    }
    this.privateKeyJwkRaw = privateKeyJwk!.trim();
    this.kid = kid!.trim();
    this.issuerDid = (config.issuerDid ?? process.env.VITALCV_ISSUER_DID ?? DEFAULT_ISSUER_DID).trim();
  }

  private async keys(): Promise<LoadedKeyMaterial> {
    if (this.keyMaterial) return this.keyMaterial;

    let parsed: JWK;
    try {
      parsed = JSON.parse(this.privateKeyJwkRaw) as JWK;
    } catch {
      throw new TrustContainerProviderError(
        'RECEIPT_PRIVATE_KEY_JWK is not valid JWK JSON',
        'MISSING_CONFIG',
      );
    }

    if (parsed.kty !== 'EC' || parsed.crv !== 'P-256' || !parsed.d) {
      throw new TrustContainerProviderError(
        'VitalCV trust container requires an EC P-256 private JWK (ES256)',
        'MISSING_CONFIG',
      );
    }

    const { d: _privateScalar, ...publicJwk } = parsed;
    const privateKey = (await importJWK(parsed, 'ES256')) as CryptoKey;
    const publicKey = (await importJWK(publicJwk, 'ES256')) as CryptoKey;

    this.keyMaterial = {
      privateKey,
      publicKey,
      publicJwk: { ...publicJwk, kid: this.kid, alg: 'ES256', use: 'sig' },
      kid: this.kid,
      issuerDid: this.issuerDid,
    };
    return this.keyMaterial;
  }

  private envelopeHash(payload: CredentialEnvelopePayload): string {
    // Same hash domain as the mock provider so envelope correlation
    // survives a provider switch.
    return sha256Hex(`vitalcv.envelope::${stableStringify(payload)}`);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const material = await this.keys();
      return {
        ok: true,
        status: 'vitalcv-signer-ready',
        reason: `kid=${material.kid} issuer=${material.issuerDid}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'vitalcv-signer-unavailable',
        reason: err instanceof Error ? err.message : 'signing key unavailable',
      };
    }
  }

  async issueCredential(payload: CredentialEnvelopePayload): Promise<IssuedCredentialResult> {
    assertLimitationConsistency(payload);

    const material = await this.keys();
    const envelopeHash = this.envelopeHash(payload);
    const issuedAtDate = new Date();
    const issuedAt = issuedAtDate.toISOString();
    const jti = `vcv_vc_${envelopeHash.substring(0, 32)}`;

    const jwt = await new SignJWT({
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VitalCVReadinessCredential'],
        issuer: material.issuerDid,
        issuanceDate: issuedAt,
        credentialSubject: payload,
      },
      vcv_envelope_hash: envelopeHash,
    })
      .setProtectedHeader({ alg: 'ES256', kid: material.kid, typ: VC_JWT_TYP })
      .setIssuer(material.issuerDid)
      .setSubject(payload.subject.did ?? `vitalcv:entity:${payload.entityId}`)
      .setJti(jti)
      .setIssuedAt(Math.floor(issuedAtDate.getTime() / 1000))
      .sign(material.privateKey);

    return {
      id: jti,
      did: material.issuerDid,
      vcPayload: { format: VC_JWT_TYP, jwt },
      issuedAt,
      envelopeHash,
      mock: false,
    };
  }

  async verifyCredential(vc: unknown): Promise<VerificationResult> {
    const jwt =
      typeof vc === 'string'
        ? vc
        : (vc as { jwt?: unknown } | null | undefined)?.jwt;

    if (typeof jwt !== 'string' || jwt.length === 0) {
      return {
        valid: false,
        errors: ['Expected a VC-JWT string (or { jwt }) issued by the VitalCV trust container.'],
        mock: false,
      };
    }

    try {
      const material = await this.keys();
      const { payload } = await jwtVerify(jwt, material.publicKey, {
        issuer: material.issuerDid,
      });
      const envelopeHash =
        typeof payload.vcv_envelope_hash === 'string' ? payload.vcv_envelope_hash : undefined;
      return {
        valid: true,
        errors: [],
        ...(envelopeHash ? { envelopeHash } : {}),
        mock: false,
      };
    } catch (err) {
      return {
        valid: false,
        errors: [err instanceof Error ? err.message : 'VC-JWT verification failed'],
        mock: false,
      };
    }
  }

  async anchorReceipt(_receiptData: unknown): Promise<AnchorReceiptResult> {
    // Substrate anchoring is parked (docs/architecture/adr-substrate-anchoring.md).
    // Refuse rather than fabricate a transaction hash.
    throw new TrustContainerProviderError(
      'Anchoring is parked per the substrate ADR; the VitalCV container will not fabricate a txHash. Rely on signed receipts + Merkle proofs.',
      'PROVIDER_UNAVAILABLE',
    );
  }

  async createPresentation(vcs: unknown[]): Promise<PresentationResult> {
    const material = await this.keys();
    const jwt = await new SignJWT({
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: vcs,
      },
    })
      .setProtectedHeader({ alg: 'ES256', kid: material.kid, typ: 'vp+jwt' })
      .setIssuer(material.issuerDid)
      .setIssuedAt()
      .sign(material.privateKey);

    return { vpPayload: { format: 'vp+jwt', jwt }, mock: false };
  }

  async resolveDid(did: string): Promise<DidDocument> {
    const material = await this.keys();
    if (did !== material.issuerDid) {
      throw new TrustContainerProviderError(
        `VitalCV trust container only resolves its own issuer DID (${material.issuerDid}); external DID resolution is not wired.`,
        'PROVIDER_UNAVAILABLE',
      );
    }
    return {
      did,
      document: {
        id: did,
        '@context': 'https://www.w3.org/ns/did/v1',
        verificationMethod: [
          {
            id: `${did}#${material.kid}`,
            type: 'JsonWebKey2020',
            controller: did,
            publicKeyJwk: material.publicJwk,
          },
        ],
        assertionMethod: [`${did}#${material.kid}`],
      },
      mock: false,
    };
  }

  async exportProofBundle(entityId: string): Promise<ProofBundleExport> {
    // Bundle assembly lives with the proof-pack export path, not the
    // signer. An empty bundle here is explicit, not a stub pretending.
    return { entityId, bundle: [], mock: false };
  }
}
