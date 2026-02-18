import { decodeJwt } from 'jose';
import { Request, Response, Router } from 'express';
import {
  issueCNonce,
  getCNonceLifetimeSeconds,
  validateHAIPCompliance,
  isStrictTransitionMode,
} from '../../services/haipPolicy';
import {
  assertActiveCredentialLifecycle,
  credentialStatusUrl,
} from '../../services/credentialStatus';
import { isES256SigningKeyConfigured, isSigningKeyConfigured } from '../../services/signingKeyProvider';
import {
  getControlledDidDocument,
  issueClinicianIdentityVC,
  verifyControlledIssuerDidDocument,
} from '../../services/vcIssuer';
import { getControlledIssuerDID } from '../../utils/didGenerator';
import { hashDeterministicPayload } from '../../utils/deterministic';

const router: Router = Router();

type CredentialProfile = {
  subjectDid: string;
  name: string;
  npi: string;
  specialty: string;
  organizationId?: string;
};

type JwtPayloadRecord = Record<string, unknown>;

type PayloadObject = Record<string, unknown>;

type BodyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PayloadObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBodyRecord(body: unknown): BodyRecord {
  if (isRecord(body)) {
    return body;
  }
  return {};
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArtifactId(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }

  return parseRequiredString(body.id, 'artifact.id');
}

function ensureArtifactIntegrity(artifactInput: unknown, requireArtifact: boolean): void {
  if (!artifactInput) {
    if (requireArtifact) {
      throw new Error('Missing artifact required for strict issuance.');
    }
    return;
  }

  const artifact = isRecord(artifactInput) ? artifactInput : {};
  if (Object.keys(artifact).length === 0) {
    if (requireArtifact) {
      throw new Error('artifact must be an object.');
    }
    return;
  }

  const artifactId = parseRequiredString(artifact.id, 'artifact.id');
  const integrityInput = normalizeString(artifact.integrity);
  const payloadForIntegrity = artifact.payload ?? artifact.claims ?? artifact.data;

  if (payloadForIntegrity === undefined) {
    if (requireArtifact) {
      throw new Error(`artifact integrity missing for ${artifactId}.`);
    }
    return;
  }

  if (integrityInput.length === 0) {
    if (requireArtifact) {
      throw new Error(`artifact.integrity required for ${artifactId}.`);
    }
    return;
  }

  const expected = integrityInput.startsWith('sha256:') ? integrityInput.slice(7) : integrityInput;
  const computed = hashDeterministicPayload(payloadForIntegrity);

  if (expected !== computed) {
    throw new Error(`artifact integrity mismatch for ${artifactId}.`);
  }
}

function parseSubjectFromProofJwt(token: string): string | null {
  try {
    const payload = decodeJwt(token) as JwtPayloadRecord;
    return parseOptionalString(payload.sub) ?? parseOptionalString(payload.iss) ?? null;
  } catch {
    return null;
  }
}

function parseCredentialProfile(body: BodyRecord): CredentialProfile {
  const credentialSubject = isRecord(body.credential_subject) ? body.credential_subject : {};
  const requestBody = isRecord(body.credential_request) ? body.credential_request : {};
  const requestSubject = isRecord(requestBody.credential_subject)
    ? requestBody.credential_subject
    : isRecord(requestBody.credentialSubject)
      ? requestBody.credentialSubject
      : {};
  const proof = isRecord(body.proof) ? body.proof : {};
  const proofJwt = parseOptionalString(proof.jwt);
  const subjectFromProof = proofJwt ? parseSubjectFromProofJwt(proofJwt) : null;

  const subjectDid = parseRequiredString(
    parseOptionalString(body.subjectDid) ??
      parseOptionalString(credentialSubject.id) ??
      parseOptionalString(requestSubject.id) ??
      subjectFromProof,
    'subjectDid',
  );

  return {
    subjectDid,
    name: parseRequiredString(
      parseOptionalString(credentialSubject.name) ?? parseOptionalString(requestSubject.name),
      'name',
    ),
    npi: parseRequiredString(
      parseOptionalString(credentialSubject.npi) ?? parseOptionalString(requestSubject.npi),
      'npi',
    ),
    specialty: parseRequiredString(
      parseOptionalString(credentialSubject.specialty) ?? parseOptionalString(requestSubject.specialty),
      'specialty',
    ),
    organizationId: parseOptionalString(
      parseOptionalString(credentialSubject.organizationId) ??
        parseOptionalString(requestSubject.organizationId) ??
        parseOptionalString(body.organizationId) ??
        parseOptionalString(body.organization_id),
    ),
  };
}

function validateSigningSetup(): void {
  if (!isSigningKeyConfigured()) {
    throw new Error('ISSUER_SIGNING_JWK is required and must be valid for issuance.');
  }
  if (!isES256SigningKeyConfigured()) {
    throw new Error('ISSUER_SIGNING_JWK must be configured for ES256.');
  }
}

function validateStrictDid(): void {
  if (!isStrictTransitionMode()) {
    return;
  }

  const document = getControlledDidDocument();
  const expectedDid = getControlledIssuerDID();
  if (document.id !== expectedDid) {
    throw new Error(`Strict mode issuer DID mismatch. Expected ${expectedDid}.`);
  }

  verifyControlledIssuerDidDocument(document);
}

router.post('/nonce', (_req: Request, res: Response): void => {
  const cNonce = issueCNonce();
  res.status(200).json({
    c_nonce: cNonce,
    c_nonce_expires_in: getCNonceLifetimeSeconds(),
  });
});

router.post('/credential', async (req: Request, res: Response): Promise<void> => {
  const body = parseBodyRecord(req.body);

  try {
    validateSigningSetup();
    validateHAIPCompliance(req);

    const strict = isStrictTransitionMode();
    validateStrictDid();

    const profile = parseCredentialProfile(body);
    const artifact = body.artifact ?? (isRecord(body.credential_request) ? body.credential_request.artifact : null);
    const artifactId = parseArtifactId(artifact);
    ensureArtifactIntegrity(artifact, strict);

    if (strict && !artifactId) {
      throw new Error('Strict mode requires an artifact with id.');
    }

    if (strict && artifactId) {
      await assertActiveCredentialLifecycle(artifactId);
    }

    const credentialStatus = artifactId
      ? {
          id: credentialStatusUrl(artifactId),
          type: 'VitalCredentialStatus' as const,
        }
      : undefined;

    const credential = await issueClinicianIdentityVC(profile, {
      ...(credentialStatus ? { credentialStatus } : {}),
    });

    res.status(201).json({
      format: 'jwt_vc_json',
      credential,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credential request.';
    res.status(400).json({
      error: 'haip_compliance_error',
      error_description: message,
    });
  }
});

export default router;
