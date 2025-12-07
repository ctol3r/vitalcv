/**
 * OpenAPI Specification with Examples
 * B108B-OPENAPI-028: OpenAPI examples (issuer/verifier/privileges/evidence)
 *
 * Provides comprehensive OpenAPI 3.1 specification with examples
 * for issuer, verifier, privileges, and evidence endpoints.
 */

import { Router } from 'express';

const router = Router();

/**
 * GET /openapi.json
 * Returns OpenAPI 3.1 specification with examples
 */
router.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'VitalCV Platform API',
      version: '1.0.0',
      description: 'API for healthcare credential verification, issuance, and compliance',
      contact: {
        name: 'VitalCV Support',
        email: 'support@vitalcv.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api.vitalcv.com',
        description: 'Production server',
      },
    ],
    paths: {
      '/api/issuer/credentials': {
        post: {
          summary: 'Issue a verifiable credential',
          description: 'Issue a new verifiable credential to a holder',
          tags: ['Issuer'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['credentialSubject', 'type'],
                  properties: {
                    credentialSubject: {
                      type: 'object',
                      description: 'Credential subject data',
                    },
                    type: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Credential types',
                    },
                    expirationDate: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
                examples: {
                  medicalLicense: {
                    summary: 'Medical License Credential',
                    value: {
                      credentialSubject: {
                        id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                        npi: '1234567890',
                        licenseNumber: 'MD12345',
                        state: 'CA',
                        specialty: 'Internal Medicine',
                        issuedDate: '2023-01-15T00:00:00Z',
                        expirationDate: '2025-01-15T00:00:00Z',
                      },
                      type: ['VerifiableCredential', 'MedicalLicense'],
                      expirationDate: '2025-01-15T00:00:00Z',
                    },
                  },
                  boardCertification: {
                    summary: 'Board Certification Credential',
                    value: {
                      credentialSubject: {
                        id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                        npi: '1234567890',
                        board: 'American Board of Internal Medicine',
                        certification: 'Internal Medicine',
                        certificationDate: '2020-06-01T00:00:00Z',
                        expirationDate: '2030-06-01T00:00:00Z',
                      },
                      type: ['VerifiableCredential', 'BoardCertification'],
                      expirationDate: '2030-06-01T00:00:00Z',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Credential issued successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credentialId: { type: 'string' },
                      credential: { type: 'object' },
                      auditRef: { type: 'string' },
                    },
                  },
                  examples: {
                    success: {
                      summary: 'Successful issuance',
                      value: {
                        credentialId: 'vc_abc123def456',
                        credential: {
                          '@context': ['https://www.w3.org/2018/credentials/v1'],
                          type: ['VerifiableCredential', 'MedicalLicense'],
                          issuer: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                          issuanceDate: '2025-01-09T12:00:00Z',
                          credentialSubject: {
                            id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                            npi: '1234567890',
                            licenseNumber: 'MD12345',
                          },
                          proof: {
                            type: 'Ed25519Signature2020',
                            created: '2025-01-09T12:00:00Z',
                            proofPurpose: 'assertionMethod',
                            verificationMethod: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                            jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..signature',
                          },
                        },
                        auditRef: 'AUDIT-20250109-abc123',
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid request',
            },
            '403': {
              description: 'Unauthorized - issuer role required',
            },
          },
        },
        get: {
          summary: 'List issued credentials',
          description: 'Get a list of credentials issued by the authenticated issuer',
          tags: ['Issuer'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 50 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', default: 0 },
            },
          ],
          responses: {
            '200': {
              description: 'List of credentials',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credentials: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      total: { type: 'integer' },
                    },
                  },
                  example: {
                    credentials: [
                      {
                        credentialId: 'vc_abc123',
                        type: ['VerifiableCredential', 'MedicalLicense'],
                        issuedTo: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                        issuedAt: '2025-01-09T12:00:00Z',
                        status: 'active',
                      },
                    ],
                    total: 1,
                  },
                },
              },
            },
          },
        },
      },
      '/api/verifier/presentation': {
        post: {
          summary: 'Verify a verifiable presentation',
          description: 'Verify a verifiable presentation containing one or more credentials',
          tags: ['Verifier'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['presentation'],
                  properties: {
                    presentation: {
                      type: 'object',
                      description: 'Verifiable presentation to verify',
                    },
                    credentialId: {
                      type: 'string',
                      description: 'Credential ID to verify (alternative to presentation)',
                    },
                    nonce: {
                      type: 'string',
                      description: 'Nonce for replay protection',
                    },
                    audience: {
                      type: 'string',
                      description: 'Audience (verifier DID)',
                    },
                  },
                },
                examples: {
                  presentation: {
                    summary: 'Full presentation verification',
                    value: {
                      presentation: {
                        '@context': ['https://www.w3.org/2018/credentials/v1'],
                        type: ['VerifiablePresentation'],
                        verifiableCredential: [
                          {
                            '@context': ['https://www.w3.org/2018/credentials/v1'],
                            type: ['VerifiableCredential', 'MedicalLicense'],
                            credentialSubject: {
                              npi: '1234567890',
                              licenseNumber: 'MD12345',
                            },
                            proof: {
                              type: 'Ed25519Signature2020',
                              jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..signature',
                            },
                          },
                        ],
                        proof: {
                          type: 'Ed25519Signature2020',
                          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..vp_signature',
                        },
                      },
                      nonce: 'random-nonce-12345',
                      audience: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                    },
                  },
                  credentialId: {
                    summary: 'Credential ID verification',
                    value: {
                      credentialId: 'vc_abc123def456',
                      nonce: 'random-nonce-12345',
                      audience: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Verification successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean' },
                      status: { type: 'string', enum: ['valid', 'invalid', 'revoked', 'unknown'] },
                      credentialId: { type: 'string' },
                      auditRef: { type: 'string' },
                      issuer: { type: 'string' },
                      issuedDate: { type: 'string', format: 'date-time' },
                      expiryDate: { type: 'string', format: 'date-time' },
                    },
                  },
                  examples: {
                    valid: {
                      summary: 'Valid credential',
                      value: {
                        valid: true,
                        status: 'valid',
                        credentialId: 'vc_abc123def456',
                        auditRef: 'AUDIT-20250109-xyz789',
                        issuer: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                        issuedDate: '2023-01-15T00:00:00Z',
                        expiryDate: '2025-01-15T00:00:00Z',
                      },
                    },
                    revoked: {
                      summary: 'Revoked credential',
                      value: {
                        valid: false,
                        status: 'revoked',
                        credentialId: 'vc_abc123def456',
                        auditRef: 'AUDIT-20250109-xyz789',
                        reason: 'License suspended due to administrative review',
                      },
                    },
                  },
                },
              },
            },
            '403': {
              description: 'EUDI-only mode: Non-EUDI presentation blocked',
            },
          },
        },
      },
      '/api/privileges': {
        get: {
          summary: 'List privileges for a provider',
          description: 'Get clinical privileges for a healthcare provider',
          tags: ['Privileges'],
          parameters: [
            {
              name: 'npi',
              in: 'query',
              required: true,
              schema: { type: 'string', pattern: '^\\d{10}$' },
              description: 'National Provider Identifier',
            },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['active', 'pending', 'suspended', 'expired'] },
            },
          ],
          responses: {
            '200': {
              description: 'List of privileges',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      npi: { type: 'string' },
                      privileges: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            category: { type: 'string' },
                            status: { type: 'string' },
                            grantedDate: { type: 'string', format: 'date-time' },
                            expirationDate: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    npi: '1234567890',
                    privileges: [
                      {
                        id: 'priv_001',
                        name: 'General Medicine',
                        category: 'Clinical',
                        status: 'active',
                        grantedDate: '2023-01-15T00:00:00Z',
                        expirationDate: '2025-01-15T00:00:00Z',
                      },
                      {
                        id: 'priv_002',
                        name: 'Emergency Medicine',
                        category: 'Clinical',
                        status: 'active',
                        grantedDate: '2023-06-01T00:00:00Z',
                        expirationDate: '2025-06-01T00:00:00Z',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Grant privileges to a provider',
          description: 'Grant clinical privileges to a healthcare provider',
          tags: ['Privileges'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['npi', 'privilegeIds'],
                  properties: {
                    npi: { type: 'string' },
                    privilegeIds: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    grantedBy: { type: 'string' },
                    expirationDate: { type: 'string', format: 'date-time' },
                  },
                },
                example: {
                  npi: '1234567890',
                  privilegeIds: ['priv_001', 'priv_002'],
                  grantedBy: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
                  expirationDate: '2025-12-31T23:59:59Z',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Privileges granted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      privileges: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                    },
                  },
                  example: {
                    success: true,
                    privileges: [
                      {
                        id: 'priv_001',
                        name: 'General Medicine',
                        status: 'active',
                        grantedDate: '2025-01-09T12:00:00Z',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/api/compliance/evidence/{providerId}/export': {
        get: {
          summary: 'Export evidence bundle for a provider',
          description: 'Export NCQA-compliant evidence bundle for a provider',
          tags: ['Evidence'],
          parameters: [
            {
              name: 'providerId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Provider identifier (NPI)',
            },
            {
              name: 'format',
              in: 'query',
              schema: { type: 'string', enum: ['json', 'zip'], default: 'zip' },
            },
          ],
          responses: {
            '200': {
              description: 'Evidence bundle exported',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      providerId: { type: 'string' },
                      exportedAt: { type: 'string', format: 'date-time' },
                      checks: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      policyExcerpt: { type: 'object' },
                      endpointRoster: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      movLogs: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      reviewerAttestation: { type: 'object' },
                    },
                  },
                  example: {
                    providerId: '1234567890',
                    exportedAt: '2025-01-09T12:00:00Z',
                    checks: [
                      {
                        id: 'check_001',
                        checkType: 'CR1',
                        sourceId: 'nppes',
                        result: 'verified',
                        createdAt: '2025-01-01T00:00:00Z',
                      },
                    ],
                    policyExcerpt: {
                      standard: 'NCQA-2025',
                      version: '1.0',
                      excerpt: 'API-only Primary/Approved Source policy',
                    },
                    endpointRoster: [
                      {
                        sourceId: 'nppes',
                        sourceName: 'NPPES Registry',
                        endpoint: 'https://npiregistry.cms.hhs.gov/api',
                        method: 'GET',
                        lastVerified: '2025-01-09T00:00:00Z',
                      },
                    ],
                    movLogs: [
                      {
                        verificationId: 'check_001',
                        methodOfVerification: 'API',
                        timestamp: '2025-01-09T00:00:00Z',
                        result: 'verified',
                      },
                    ],
                    reviewerAttestation: {
                      reviewer: 'system',
                      attestedAt: '2025-01-09T12:00:00Z',
                    },
                  },
                },
                'application/zip': {
                  schema: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
            '404': {
              description: 'No evidence found for provider',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  });
});

export { router as openapi };
