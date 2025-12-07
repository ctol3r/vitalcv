import { createHash } from 'crypto';
import { importJWK, type JWK, type KeyLike, SignJWT } from 'jose';
import { CredentialSchemaRegistry } from './schemas';
import type {
  CsdJwtHeader,
  CsdJwtPayload,
  CredentialSchemaId,
  DisclosureManifest,
  HolderDisclosure,
  IssueResult,
  IssueProof,
  VerifiableCredential,
} from './types';
import {
  base64UrlEncode,
  cloneDeep,
  generateSalt,
  getValueAtPath,
  hashDisclosureValue,
  unsetPath,
} from './utils';

export interface CsdJwtIssuerOptions {
  issuerDid: string;
  keyId: string;
  signingKey: JWK | KeyLike;
  algorithm?: string;
  schemaRegistry?: CredentialSchemaRegistry;
}

export interface IssueRequest {
  schemaId: CredentialSchemaId;
  credential: VerifiableCredential;
  revealGroups?: string[];
  nonce?: string;
  holderBinding?: {
    did?: string;
    nonce?: string;
  };
}

interface ManagedClaim {
  path: string;
  value: any;
  groupId: string;
  required?: boolean;
}

export class CsdJwtIssuer {
  private readonly issuerDid: string;
  private readonly keyId: string;
  private readonly schemaRegistry: CredentialSchemaRegistry;
  private readonly algorithm: string;
  private readonly privateKeyPromise: Promise<KeyLike>;

  constructor(options: CsdJwtIssuerOptions) {
    this.issuerDid = options.issuerDid;
    this.keyId = options.keyId;
    this.schemaRegistry = options.schemaRegistry ?? new CredentialSchemaRegistry();
    this.algorithm =
      options.algorithm ||
      (isJwk(options.signingKey) && options.signingKey.alg ? (options.signingKey.alg as string) : 'EdDSA');
    this.privateKeyPromise = isJwk(options.signingKey)
      ? importJWK(options.signingKey, this.algorithm)
      : Promise.resolve(options.signingKey);
  }

  async issue(request: IssueRequest): Promise<IssueResult> {
    const { schemaId, credential } = request;
    const normalizedCredential = cloneDeep(credential);

    if (!normalizedCredential.issuer) {
      normalizedCredential.issuer = this.issuerDid;
    }

    if (
      typeof normalizedCredential.issuer === 'string' &&
      normalizedCredential.issuer !== this.issuerDid
    ) {
      throw new Error(`Credential issuer mismatch. Expected ${this.issuerDid}`);
    }

    const schema = this.schemaRegistry.get(schemaId);
    const validation = this.schemaRegistry.validate(schemaId, normalizedCredential);
    if (!validation.valid) {
      throw new Error(`Credential does not satisfy ${schemaId}: ${validation.errors?.join('; ')}`);
    }

    const holderId = normalizedCredential.credentialSubject?.id;
    if (!holderId) {
      throw new Error('credentialSubject.id is required for selective disclosure');
    }

    const managedClaims = this.buildManagedClaims(schema.disclosureGroups, normalizedCredential);
    const { digests, disclosures } = this.buildDisclosures(
      managedClaims,
      request.revealGroups,
    );

    // Remove managed claims from credential payload to keep payload minimal
    managedClaims.forEach((claim) => {
      unsetPath(normalizedCredential, claim.path);
    });

    normalizedCredential.credentialSchema = {
      id: schemaId,
      type: 'JsonSchemaValidator2018',
    };

    const header: CsdJwtHeader = {
      alg: this.algorithm,
      typ: 'CSD-JWT',
      kid: this.keyId,
      cty: 'vc+sd+jwt',
    };

    const payload: CsdJwtPayload = {
      iss: typeof normalizedCredential.issuer === 'string'
        ? normalizedCredential.issuer
        : normalizedCredential.issuer.id,
      sub: holderId,
      iat: Math.floor(Date.now() / 1000),
      schemaId,
      vc: normalizedCredential,
      revealGroups: Array.from(
        new Set(disclosures.filter((d) => this.isGroupRevealed(d.groupId, request.revealGroups, schema.disclosureGroups)).map((d) => d.groupId)),
      ),
    };

    if (normalizedCredential.expirationDate) {
      payload.exp = Math.floor(new Date(normalizedCredential.expirationDate).getTime() / 1000);
    }

    const headerPart = base64UrlEncode(header);
    const payloadPart = base64UrlEncode(payload);
    const manifest: DisclosureManifest = {
      version: 1,
      schemaId,
      digests,
      groups: schema.disclosureGroups,
    };
    const manifestPart = base64UrlEncode(manifest);

    const digestHash = this.computePresentationHash(headerPart, payloadPart, manifestPart);
    const proofJws = await this.signProof(digestHash, holderId, request);

    const proofEnvelope = base64UrlEncode({ jws: proofJws });
    const token = `${headerPart}.${payloadPart}.${manifestPart}.${proofEnvelope}`;

    return {
      token,
      header,
      payload,
      manifest,
      disclosures,
      proof: {
        kid: this.keyId,
        alg: this.algorithm,
        digest: digestHash,
        nonce: request.nonce,
        holderBinding: request.holderBinding,
        issuedAt: payload.iat,
      },
      summary: {
        schemaId,
        issuer: payload.iss,
        subject: payload.sub,
      },
    };
  }

  private async signProof(
    digest: string,
    subject: string,
    request: IssueRequest,
  ): Promise<string> {
    const signer = await this.privateKeyPromise;
    const proofJwt = await new SignJWT({
      digest,
      nonce: request.nonce,
      holderBinding: request.holderBinding,
    })
      .setProtectedHeader({
        alg: this.algorithm,
        kid: this.keyId,
        typ: 'CSD-PROOF',
      })
      .setIssuedAt()
      .setSubject(subject)
      .setIssuer(this.issuerDid)
      .sign(signer);

    return proofJwt;
  }

  private buildManagedClaims(
    groups: ReturnType<CredentialSchemaRegistry['get']>['disclosureGroups'],
    credential: VerifiableCredential,
  ): ManagedClaim[] {
    const claims: ManagedClaim[] = [];
    groups.forEach((group) => {
      group.claims.forEach((path) => {
        const value = getValueAtPath(credential, path);
        if (value === undefined) {
          return;
        }
        claims.push({
          path,
          value,
          groupId: group.id,
          required: group.required,
        });
      });
    });

    return claims;
  }

  private buildDisclosures(
    claims: ManagedClaim[],
    requestedRevealGroups: string[] | undefined,
  ): {
    digests: DisclosureManifest['digests'];
    disclosures: HolderDisclosure[];
  } {
    const digests: DisclosureManifest['digests'] = [];
    const disclosures: HolderDisclosure[] = [];

    claims.forEach((claim) => {
      const salt = generateSalt();
      const digest = hashDisclosureValue(claim.path, claim.value, salt);
      const isRevealed = this.isGroupRevealed(claim.groupId, requestedRevealGroups);

      digests.push({
        digest,
        path: claim.path,
        groupId: claim.groupId,
      });

      disclosures.push({
        groupId: claim.groupId,
        path: claim.path,
        salt,
        value: claim.value,
        digest,
        required: claim.required,
      });

      if (!isRevealed && claim.required) {
        throw new Error(`Required disclosure group ${claim.groupId} cannot be concealed`);
      }
    });

    return { digests, disclosures };
  }

  private isGroupRevealed(
    groupId: string,
    requestedRevealGroups: string[] | undefined,
    groups?: ReturnType<CredentialSchemaRegistry['get']>['disclosureGroups'],
  ): boolean {
    if (groups) {
      const definition = groups.find((group) => group.id === groupId);
      if (definition?.required) {
        return true;
      }
    }
    if (!requestedRevealGroups) {
      return false;
    }
    return requestedRevealGroups.includes(groupId);
  }

  private computePresentationHash(header: string, payload: string, manifest: string): string {
    return createHash('sha256')
      .update(`${header}.${payload}.${manifest}`)
      .digest('base64url');
  }
}

function isJwk(value: JWK | KeyLike): value is JWK {
  return (value as JWK).kty !== undefined;
}


