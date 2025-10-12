/**
 * OpenAPI 3.0 Specification for VitalCV API
 *
 * GET /api/openapi.json
 * Returns complete API documentation in OpenAPI 3.0 format
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'VitalCV API',
      version: '1.0.0',
      description:
        'Verifiable Credentials platform for healthcare professionals. Supports OIDC4VCI, SD-JWT, BBS+, and DCQL.',
      contact: {
        name: 'VitalCV Support',
        url: 'https://vitalcv.com/support',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_ISSUER_URL || 'http://localhost:3000',
        description: 'VitalCV API Server',
      },
    ],
    tags: [
      { name: 'OIDC4VCI', description: 'OpenID for Verifiable Credential Issuance endpoints' },
      { name: 'Verifier', description: 'Credential verification endpoints' },
      { name: 'Credentials', description: 'Credential management (CRUD)' },
      { name: 'Authentication', description: 'DID-based authentication' },
      { name: 'Schemas', description: 'Credential schema management' },
      { name: 'Issuers', description: 'Issuer management' },
      { name: 'Analytics', description: 'Usage analytics and metrics' },
      { name: 'Monitoring', description: 'Health checks and system monitoring' },
      { name: 'Discovery', description: 'Well-known discovery endpoints' },
    ],
    paths: {
      '/api/oidc4vci/offer': {
        post: {
          tags: ['OIDC4VCI'],
          summary: 'Create credential offer',
          description: 'Initiates OIDC4VCI flow by creating a pre-authorized credential offer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['credentialType', 'issuerId'],
                  properties: {
                    credentialType: { type: 'string', example: 'NursingLicense' },
                    issuerId: { type: 'string', example: 'vitalcv-issuer-001' },
                    subjectId: { type: 'string', example: 'user-123' },
                    txCode: { type: 'string', description: 'Optional transaction code' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Offer created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credential_offer_uri: { type: 'string' },
                      credential_offer: {
                        type: 'object',
                        properties: {
                          credential_issuer: { type: 'string' },
                          credential_configuration_ids: {
                            type: 'array',
                            items: { type: 'string' },
                          },
                          grants: {
                            type: 'object',
                            properties: {
                              'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
                                type: 'object',
                                properties: {
                                  'pre-authorized_code': { type: 'string' },
                                  tx_code: {
                                    type: 'object',
                                    properties: {
                                      input_mode: { type: 'string' },
                                      length: { type: 'number' },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid request' },
            '429': { description: 'Rate limit exceeded' },
            '500': { description: 'Internal server error' },
          },
        },
      },
      '/api/oidc4vci/token': {
        post: {
          tags: ['OIDC4VCI'],
          summary: 'Exchange pre-authorized code for access token',
          description: 'Token endpoint with PKCE validation',
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  required: ['grant_type', 'pre-authorized_code'],
                  properties: {
                    grant_type: {
                      type: 'string',
                      enum: ['urn:ietf:params:oauth:grant-type:pre-authorized_code'],
                    },
                    'pre-authorized_code': { type: 'string' },
                    code_verifier: { type: 'string', description: 'PKCE code verifier' },
                    tx_code: { type: 'string', description: 'Transaction code (if required)' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token issued successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      access_token: { type: 'string' },
                      token_type: { type: 'string', example: 'Bearer' },
                      expires_in: { type: 'number', example: 3600 },
                      c_nonce: { type: 'string' },
                      c_nonce_expires_in: { type: 'number', example: 300 },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid grant' },
            '401': { description: 'PKCE validation failed' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/oidc4vci/credential': {
        post: {
          tags: ['OIDC4VCI'],
          summary: 'Issue verifiable credential',
          description: 'Issues a verifiable credential using access token',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['format'],
                  properties: {
                    format: { type: 'string', enum: ['jwt_vc_json', 'vc+sd-jwt'] },
                    proof: {
                      type: 'object',
                      properties: {
                        proof_type: { type: 'string', example: 'jwt' },
                        jwt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Credential issued',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credential: { type: 'string' },
                      format: { type: 'string' },
                      c_nonce: { type: 'string' },
                      c_nonce_expires_in: { type: 'number' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid or missing access token' },
            '400': { description: 'Invalid proof or format' },
          },
        },
      },
      '/api/oidc4vci/nonce': {
        post: {
          tags: ['OIDC4VCI'],
          summary: 'Generate c_nonce',
          description: 'Generates a new c_nonce for proof generation',
          responses: {
            '200': {
              description: 'Nonce generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      c_nonce: { type: 'string' },
                      c_nonce_expires_in: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/verifier/presentation': {
        post: {
          tags: ['Verifier'],
          summary: 'Verify credential presentation',
          description: 'Verifies a credential with optional DCQL selective disclosure',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['credential'],
                  properties: {
                    credential: { type: 'string' },
                    dcqlQuery: {
                      type: 'object',
                      description: 'DCQL query for selective disclosure',
                    },
                    nonce: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' },
                      credentialId: { type: 'string' },
                      claims: { type: 'object' },
                      status: {
                        type: 'string',
                        enum: ['valid', 'expired', 'revoked', 'invalid'],
                      },
                      errors: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid request' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/credentials': {
        get: {
          tags: ['Credentials'],
          summary: 'List credentials',
          description: 'Returns paginated list of credentials',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'number' } },
            { name: 'limit', in: 'query', schema: { type: 'number' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Credentials list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credentials: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Credential' },
                      },
                      total: { type: 'number' },
                      page: { type: 'number' },
                      limit: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/credentials/{id}': {
        get: {
          tags: ['Credentials'],
          summary: 'Get credential by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Credential details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Credential' },
                },
              },
            },
            '404': { description: 'Credential not found' },
          },
        },
      },
      '/api/credentials/{id}/revoke': {
        post: {
          tags: ['Credentials'],
          summary: 'Revoke credential',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Credential revoked' },
            '404': { description: 'Credential not found' },
          },
        },
      },
      '/api/credentials/verify': {
        post: {
          tags: ['Credentials'],
          summary: 'Verify credential (legacy endpoint)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['credential'],
                  properties: {
                    credential: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/did/challenge': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate DID authentication challenge',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['did'],
                  properties: {
                    did: { type: 'string', example: 'did:key:z6MkpT...' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Challenge generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      challenge: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/did/verify': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify DID authentication',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['did', 'challenge', 'signature'],
                  properties: {
                    did: { type: 'string' },
                    challenge: { type: 'string' },
                    signature: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Authentication successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      expiresIn: { type: 'number' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Authentication failed' },
          },
        },
      },
      '/api/did/resolve/{did}': {
        get: {
          tags: ['Authentication'],
          summary: 'Resolve DID document',
          parameters: [{ name: 'did', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'DID document',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      didDocument: { type: 'object' },
                    },
                  },
                },
              },
            },
            '404': { description: 'DID not found' },
          },
        },
      },
      '/api/schemas': {
        get: {
          tags: ['Schemas'],
          summary: 'List credential schemas',
          responses: {
            '200': {
              description: 'Schemas list',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CredentialSchema' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/schemas/{id}': {
        get: {
          tags: ['Schemas'],
          summary: 'Get schema by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Schema details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CredentialSchema' },
                },
              },
            },
            '404': { description: 'Schema not found' },
          },
        },
      },
      '/api/issuers': {
        get: {
          tags: ['Issuers'],
          summary: 'List issuers',
          responses: {
            '200': {
              description: 'Issuers list',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Issuer' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/health': {
        get: {
          tags: ['Monitoring'],
          summary: 'Application health check',
          description: 'Lightweight health check for container orchestration',
          responses: {
            '200': {
              description: 'Service healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/health/redis': {
        get: {
          tags: ['Monitoring'],
          summary: 'Redis health check',
          responses: {
            '200': {
              description: 'Redis status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      redis_enabled: { type: 'boolean' },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/analytics/web-vitals': {
        post: {
          tags: ['Analytics'],
          summary: 'Report Web Vitals metrics',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'number' },
                    id: { type: 'string' },
                    label: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Metrics recorded' },
          },
        },
      },
      '/api/monitoring/health': {
        get: {
          tags: ['Monitoring'],
          summary: 'Detailed system health',
          responses: {
            '200': {
              description: 'System health status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      services: {
                        type: 'object',
                        properties: {
                          database: { type: 'string' },
                          redis: { type: 'string' },
                          api: { type: 'string' },
                        },
                      },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/.well-known/openid-credential-issuer': {
        get: {
          tags: ['Discovery'],
          summary: 'OpenID Credential Issuer metadata',
          description: 'Discovery endpoint for OIDC4VCI configuration',
          responses: {
            '200': {
              description: 'Issuer metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      credential_issuer: { type: 'string' },
                      credential_endpoint: { type: 'string' },
                      token_endpoint: { type: 'string' },
                      credential_configurations_supported: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/.well-known/jwks.json': {
        get: {
          tags: ['Discovery'],
          summary: 'JSON Web Key Set',
          description: 'Public keys for JWT verification',
          responses: {
            '200': {
              description: 'JWKS',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      keys: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            kty: { type: 'string' },
                            crv: { type: 'string' },
                            x: { type: 'string' },
                            y: { type: 'string' },
                            kid: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
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
      schemas: {
        Credential: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'array', items: { type: 'string' } },
            issuer: { type: 'string' },
            issuanceDate: { type: 'string', format: 'date-time' },
            expirationDate: { type: 'string', format: 'date-time' },
            credentialSubject: { type: 'object' },
            status: { type: 'string', enum: ['active', 'revoked', 'expired'] },
          },
        },
        CredentialSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            version: { type: 'string' },
            schema: { type: 'object' },
          },
        },
        Issuer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            did: { type: 'string' },
            logo: { type: 'string' },
            url: { type: 'string' },
          },
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
