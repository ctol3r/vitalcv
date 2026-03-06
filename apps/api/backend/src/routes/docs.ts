/**
 * docs.ts — Wave 117: Developer Documentation Routes
 *
 * GET /api/docs/openapi.json  — OpenAPI 3.1 specification
 * GET /api/docs/endpoints     — Human-readable endpoint list
 */

import type { Express, Request, Response } from 'express';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'VitalCV Trust Infrastructure API',
    version: '1.0.0',
    description: 'Cryptographic trust infrastructure for healthcare credentialing. Supports W3C VCs, SD-JWT, OID4VCI/VP, and DID operations.',
    contact: { name: 'VitalCV API Support', url: 'https://vitalcv.com/developers' },
  },
  servers: [
    { url: 'https://api.vitalcv.com', description: 'Production' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
  paths: {
    '/api/credentials/issue': {
      post: {
        summary: 'Issue a verifiable credential',
        tags: ['Credentials'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subjectDid', 'credentialType', 'claims'],
                properties: {
                  subjectDid: { type: 'string', example: 'did:vitalcv:abc123' },
                  credentialType: { type: 'string', example: 'MedicalLicense' },
                  claims: { type: 'object' },
                  expiresInDays: { type: 'number', example: 365 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Credential issued successfully' },
          '400': { description: 'Invalid request' },
        },
      },
    },
    '/api/credentials/verify': {
      post: {
        summary: 'Verify a credential JWT',
        tags: ['Credentials'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credentialJwt'],
                properties: {
                  credentialJwt: { type: 'string' },
                  checkRevocation: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Verification result' },
        },
      },
    },
    '/api/registry/issuers': {
      get: {
        summary: 'List trusted issuers',
        tags: ['Trust Registry'],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by issuer type' },
        ],
        responses: { '200': { description: 'Array of trusted issuers' } },
      },
    },
    '/api/did/register': {
      post: {
        summary: 'Register a new DID',
        tags: ['DID'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['controller'],
                properties: {
                  controller: { type: 'string' },
                  keyAlgorithm: { type: 'string', default: 'ES256' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'DID registered' } },
      },
    },
    '/api/did/resolve/{did}': {
      get: {
        summary: 'Resolve a DID document',
        tags: ['DID'],
        parameters: [{ name: 'did', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'DID document' },
          '404': { description: 'DID not found' },
        },
      },
    },
    '/api/conformance/report': {
      get: {
        summary: 'Run conformance suite',
        tags: ['Conformance'],
        responses: { '200': { description: 'Conformance report with pass/fail results' } },
      },
    },
    '/api/oid4vci/credential': {
      post: {
        summary: 'Issue credential via OID4VCI',
        tags: ['OID4VCI'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['format', 'types'],
                properties: {
                  format: { type: 'string', enum: ['jwt_vc_json', 'vc+sd-jwt'] },
                  types: { type: 'array', items: { type: 'string' } },
                  proof: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Credential response' } },
      },
    },
    '/api/analytics/overview': {
      get: {
        summary: 'Platform analytics overview',
        tags: ['Analytics'],
        responses: { '200': { description: 'KPI metrics' } },
      },
    },
    '/api/subscriptions': {
      post: {
        summary: 'Create or upgrade subscription',
        tags: ['Billing'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['clinicianId', 'tier'],
                properties: {
                  clinicianId: { type: 'string' },
                  tier: { type: 'string', enum: ['STARTER', 'GROWTH', 'ENTERPRISE'] },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Subscription created' } },
      },
    },
    '/api/feedback': {
      post: {
        summary: 'Submit user feedback or NPS score',
        tags: ['Feedback'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'message'],
                properties: {
                  type: { type: 'string', enum: ['nps', 'bug', 'feature'] },
                  score: { type: 'number', minimum: 0, maximum: 10 },
                  message: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Feedback submitted' } },
      },
    },
  },
};

const ENDPOINTS_SUMMARY = [
  { method: 'POST', path: '/api/credentials/issue', description: 'Issue a W3C Verifiable Credential (ES256 JWS)', tags: ['Credentials'] },
  { method: 'POST', path: '/api/credentials/verify', description: 'Verify credential JWT and check revocation', tags: ['Credentials'] },
  { method: 'GET',  path: '/api/credentials/wallet/:clinicianId', description: 'List wallet contents with expiry status', tags: ['Credentials'] },
  { method: 'POST', path: '/api/credentials/present', description: 'Create VP bundle for presentation', tags: ['Credentials'] },
  { method: 'POST', path: '/api/credentials/present/selective', description: 'Selective disclosure presentation', tags: ['Credentials'] },
  { method: 'GET',  path: '/api/registry/issuers', description: 'List trusted issuers with trust scores', tags: ['Registry'] },
  { method: 'POST', path: '/api/registry/issuers', description: 'Register a new trusted issuer', tags: ['Registry'] },
  { method: 'POST', path: '/api/did/register', description: 'Register a new DID (did:vitalcv method)', tags: ['DID'] },
  { method: 'GET',  path: '/api/did/resolve/:did', description: 'Resolve a DID document', tags: ['DID'] },
  { method: 'POST', path: '/api/did/rotate/:did', description: 'Rotate DID keys', tags: ['DID'] },
  { method: 'POST', path: '/api/revocation/revoke/:credentialId', description: 'Revoke a credential permanently', tags: ['Revocation'] },
  { method: 'GET',  path: '/api/revocation/status/:credentialId', description: 'Check revocation status', tags: ['Revocation'] },
  { method: 'POST', path: '/api/oid4vci/credential', description: 'Issue credential via OID4VCI flow', tags: ['OID4VCI'] },
  { method: 'GET',  path: '/api/oid4vci/.well-known/openid-credential-issuer', description: 'Issuer metadata', tags: ['OID4VCI'] },
  { method: 'POST', path: '/api/oid4vp/request', description: 'Create OID4VP presentation request', tags: ['OID4VP'] },
  { method: 'POST', path: '/api/oid4vp/response', description: 'Submit OID4VP presentation response', tags: ['OID4VP'] },
  { method: 'GET',  path: '/api/conformance/report', description: 'Run full conformance suite', tags: ['Conformance'] },
  { method: 'GET',  path: '/api/analytics/overview', description: 'Platform KPI overview', tags: ['Analytics'] },
  { method: 'GET',  path: '/api/analytics/credentials', description: 'Credential issuance stats by day', tags: ['Analytics'] },
  { method: 'GET',  path: '/api/analytics/network', description: 'Network growth and top issuers', tags: ['Analytics'] },
  { method: 'POST', path: '/api/subscriptions', description: 'Create/upgrade subscription tier', tags: ['Billing'] },
  { method: 'POST', path: '/api/api-keys', description: 'Generate API key', tags: ['Billing'] },
  { method: 'GET',  path: '/api/federation/metadata', description: 'OpenID Federation entity statement', tags: ['Federation'] },
  { method: 'POST', path: '/api/feedback', description: 'Submit NPS score or feedback', tags: ['Feedback'] },
];

export function registerDocsRoutes(app: Express): void {

  app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(OPENAPI_SPEC);
  });

  app.get('/api/docs/endpoints', (_req: Request, res: Response) => {
    const byTag: Record<string, typeof ENDPOINTS_SUMMARY> = {};
    for (const ep of ENDPOINTS_SUMMARY) {
      const tag = ep.tags[0];
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(ep);
    }
    res.json({
      total: ENDPOINTS_SUMMARY.length,
      byTag,
      endpoints: ENDPOINTS_SUMMARY,
    });
  });
}
