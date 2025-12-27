import { randomUUID } from 'crypto';
import { getIssuerDid, getIssuerPrivateJwk } from '../crypto/issuerKeys';

export interface IssuedCredential {
  id: string;
  credential: Record<string, unknown>;
  jwt: string;
}

export interface IssueCredentialInput {
  subjectDid: string;
  claims: Record<string, unknown>;
}

export async function issueSignedCredential(
  input: IssueCredentialInput
): Promise<IssuedCredential> {
  const issuerDid = getIssuerDid();
  const issuanceDate = new Date().toISOString();
  const credentialId = `urn:uuid:${randomUUID()}`;

  const vcPayload = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential', 'VitalCVCredential'],
    id: credentialId,
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: {
      id: input.subjectDid,
      ...input.claims,
    },
  };

  const { SignJWT, importJWK } = await import('jose');
  const privateKey = await importJWK(getIssuerPrivateJwk(), 'EdDSA');
  const jwt = await new SignJWT({ vc: vcPayload })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer(issuerDid)
    .setSubject(input.subjectDid)
    .setJti(credentialId)
    .setIssuedAt()
    .sign(privateKey);

  const credentialWithProof = {
    ...vcPayload,
    proof: {
      type: 'JwtProof2020',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${issuerDid}#key-1`,
      jwt,
    },
  };

  return {
    id: credentialId,
    credential: credentialWithProof,
    jwt,
  };
}
