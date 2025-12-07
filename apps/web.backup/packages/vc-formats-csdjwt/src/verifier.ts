import { createHash } from 'crypto';
import { importJWK, JWK, type KeyLike, jwtVerify } from 'jose';
import { CredentialSchemaRegistry } from './schemas';
import type {
  DisclosureManifest,
  HolderDisclosure,
  IssueProof,
  VerificationResult,
} from './types';
import { base64UrlDecode, cloneDeep, hashDisclosureValue, setValueAtPath } from './utils';

export interface CsdPresentationDisclosure {
  groupId: string;
  path: string;
  salt: string;
  value: any;
}

export interface CsdJwtVerifierOptions {
  schemaRegistry?: CredentialSchemaRegistry;
  keyResolver: KeyResolver;
}

export type KeyResolver = (descriptor: { kid?: string; alg?: string }) => Promise<KeyLike | JWK>;

export interface VerifyOptions {
  csdJwt: string;
  disclosures: CsdPresentationDisclosure[];
  revealGroups?: string[];
  expectedNonce?: string;
}

export class CsdJwtVerifier {
  private readonly registry: CredentialSchemaRegistry;
  private readonly keyResolver: KeyResolver;

  constructor(options: CsdJwtVerifierOptions) {
    this.registry = options.schemaRegistry ?? new CredentialSchemaRegistry();
    this.keyResolver = options.keyResolver;
  }

  async verify(options: VerifyOptions): Promise<VerificationResult> {
    try {
      const { csdJwt } = options;
      const parts = csdJwt.split('.');
      if (parts.length !== 4) {
        return { valid: false, error: 'Invalid CSD-JWT format', code: 'malformed_token' };
      }

      const [headerPart, payloadPart, manifestPart, proofPart] = parts;
      const header = base64UrlDecode<any>(headerPart);
      const payload = base64UrlDecode<any>(payloadPart);
      const manifest = base64UrlDecode<DisclosureManifest>(manifestPart);
      const proofEnvelope = base64UrlDecode<{ jws?: string }>(proofPart);

      if (!manifest?.schemaId) {
        return { valid: false, error: 'Manifest missing schema information', code: 'invalid_manifest' };
      }

      if (!proofEnvelope?.jws) {
        return { valid: false, error: 'Missing proof JWS', code: 'missing_proof' };
      }

      const digestHash = this.computePresentationHash(headerPart, payloadPart, manifestPart);
      const proofResult = await this.verifyProof(
        proofEnvelope.jws,
        header,
        payload,
        digestHash,
        options.expectedNonce,
      );
      if (!proofResult.valid) {
        return proofResult;
      }

      const digestMap = new Map(manifest.digests.map((digest) => [digest.digest, digest]));
      const revealed = new Map<string, any>();
      const credential = cloneDeep(payload.vc);

      for (const disclosure of options.disclosures) {
        const computedDigest = hashDisclosureValue(disclosure.path, disclosure.value, disclosure.salt);
        const registered = digestMap.get(computedDigest);
        if (!registered) {
          return {
            valid: false,
            error: `Disclosure for ${disclosure.path} not registered`,
            code: 'unregistered_disclosure',
          };
        }
        if (registered.groupId !== disclosure.groupId) {
          return {
            valid: false,
            error: `Disclosure group mismatch for ${disclosure.path}`,
            code: 'group_mismatch',
          };
        }
        revealed.set(disclosure.path, disclosure.value);
        setValueAtPath(credential, disclosure.path, disclosure.value);
      }

      const validation = this.registry.validate(manifest.schemaId, credential);
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.errors?.join('; ') ?? 'Schema validation failed',
          code: 'schema_validation_failed',
        };
      }

      for (const group of manifest.groups) {
        if (!group.required) {
          continue;
        }
        const groupDigests = manifest.digests.filter((digest) => digest.groupId === group.id);
        const missing = groupDigests.some((digest) => !revealed.has(digest.path));
        if (missing) {
          return {
            valid: false,
            error: `Required group ${group.id} missing from presentation`,
            code: 'required_group_missing',
          };
        }
      }

      const groupSummaries = manifest.groups.map((group) => ({
        id: group.id,
        label: group.label,
        description: group.description,
        required: group.required,
        revealed:
          group.required ||
          options.revealGroups?.includes(group.id) ||
          manifest.digests.some((digest) => digest.groupId === group.id && revealed.has(digest.path)),
      }));

      const revealedClaims: Record<string, any> = {};
      for (const [path, value] of revealed.entries()) {
        revealedClaims[path] = value;
      }

      const proof: IssueProof = {
        kid: proofResult.kid,
        alg: proofResult.alg,
        digest: digestHash,
        nonce: proofResult.nonce,
        issuedAt: proofResult.issuedAt,
      };

      return {
        valid: true,
        schemaId: manifest.schemaId,
        issuer: payload.iss,
        subject: payload.sub,
        revealedClaims,
        credential,
        manifest,
        groups: groupSummaries,
        proof,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        code: 'unexpected_error',
      };
    }
  }

  private async verifyProof(
    jws: string,
    header: any,
    payload: any,
    digest: string,
    expectedNonce?: string,
  ): Promise<
    | { valid: true; kid?: string; alg: string; nonce?: string; issuedAt: number }
    | { valid: false; error: string; code: string }
  > {
    const decodedProtected = JSON.parse(
      Buffer.from(jws.split('.')[0], 'base64url').toString('utf8'),
    );

    const keyMaterial = await this.keyResolver({
      kid: decodedProtected.kid ?? header.kid,
      alg: decodedProtected.alg ?? header.alg,
    });
    const key = isJwk(keyMaterial) ? await importJWK(keyMaterial, decodedProtected.alg) : keyMaterial;

    const verified = await jwtVerify(jws, key, {
      algorithms: [decodedProtected.alg],
      issuer: payload.iss,
      subject: payload.sub,
    });

    if (verified.payload.digest !== digest) {
      return { valid: false, error: 'Digest mismatch in proof', code: 'digest_mismatch' };
    }

    if (expectedNonce && verified.payload.nonce !== expectedNonce) {
      return { valid: false, error: 'Nonce mismatch', code: 'nonce_mismatch' };
    }

    return {
      valid: true,
      kid: decodedProtected.kid,
      alg: decodedProtected.alg,
      nonce: verified.payload.nonce as string | undefined,
      issuedAt: verified.payload.iat as number,
    };
  }

  private computePresentationHash(header: string, payload: string, manifest: string): string {
    return createHash('sha256')
      .update(`${header}.${payload}.${manifest}`)
      .digest('base64url');
  }
}

function isJwk(value: KeyLike | JWK): value is JWK {
  return (value as JWK).kty !== undefined;
}


