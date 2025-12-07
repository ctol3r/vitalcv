/**
 * OID4VCI Well-Known Endpoint
 *
 * Exposes /.well-known/openid-credential-issuer metadata per OID4VCI 1.0 spec.
 * Includes supported credential formats, types from VC registry, and endpoints.
 */

import { Request, Response, Router } from 'express';
import { listCredentialTypes } from '../../vc/registry/credentialTypes';

const router = Router();

const BASE_URL =
  process.env.OIDC4VCI_ISSUER_BASE || process.env.VC_ISSUER_BASE_URL || 'https://api.vitalcv.com';
const CREDENTIAL_ENDPOINT = `${BASE_URL}/api/oid4vci/credential`;
const TOKEN_ENDPOINT = `${BASE_URL}/api/oid4vci/token`;
const PAR_ENDPOINT = `${BASE_URL}/api/oid4vci/par`;
const DEFERRED_ENDPOINT = `${BASE_URL}/api/oid4vci/deferred`;

router.get('/openid-credential-issuer', (req: Request, res: Response) => {
  const credentialTypes = listCredentialTypes();

  // Build supported credentials from registry
  const supported_credentials = credentialTypes.map((typeDef) => ({
    format: 'jwt_vc_json',
    id: typeDef.type,
    types: ['VerifiableCredential', typeDef.type],
    display: [
      {
        name: typeDef.humanName,
        description: typeDef.description,
        locale: 'en-US',
      },
    ],
    cryptographic_binding_methods_supported: ['did:jwk', 'did:key', 'did:web'],
    cryptographic_suites_supported: ['ES256', 'ES384', 'ES512', 'EdDSA'],
    proof_types_supported: ['JsonWebSignature2020'],
    credential_schema: [
      {
        id: typeof typeDef.jsonSchema === 'string' ? typeDef.jsonSchema : typeDef.jsonSchema.id,
        type:
          typeof typeDef.jsonSchema === 'object'
            ? typeDef.jsonSchema.type
            : 'JsonSchemaValidator2018',
      },
    ],
  }));

  const metadata = {
    credential_issuer: BASE_URL,
    credential_endpoint: CREDENTIAL_ENDPOINT,
    deferred_credential_endpoint: DEFERRED_ENDPOINT,
    token_endpoint: TOKEN_ENDPOINT,
    authorization_server: TOKEN_ENDPOINT, // Can be separate if needed
    supported_credential_formats: ['jwt_vc_json', 'vc+sd-jwt'],
    supported_credential_types: credentialTypes.map((t) => t.type),
    supported_credentials,
    // Optional: Add other OID4VCI metadata
    display: [
      {
        name: 'VitalCV Credential Issuer',
        description: 'Healthcare credential issuance service',
        locale: 'en-US',
      },
    ],
  };

  res.setHeader('Content-Type', 'application/json');
  res.json(metadata);
});

export default router;
