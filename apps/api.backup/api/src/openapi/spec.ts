/**
 * OpenAPI Specification for VitalCV API
 *
 * This module generates OpenAPI 3.1 documentation for all API routes.
 * Run `npm run generate:openapi` to generate openapi.json
 */

import type { OpenAPIV3_1 } from 'openapi-types';

export const openApiSpec: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: {
    title: 'VitalCV API',
    version: '1.0.0',
    description: `
VitalCV is a healthcare credential verification platform built on W3C Verifiable Credentials.

## Authentication

Most endpoints require authentication via JWT Bearer token:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Partner endpoints use API key authentication:

\`\`\`
x-api-key: <partner-api-key>
\`\`\`

## Request IDs

All responses include an \`x-request-id\` header for debugging and support.

## Rate Limiting

API requests are rate limited. See response headers:
- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

## Errors

Errors follow RFC 7807 Problem Details format:

\`\`\`json
{
  "type": "https://api.vitalcv.com/errors/invalid-credential",
  "title": "Invalid Credential",
  "status": 400,
  "detail": "The credential ID format is invalid",
  "instance": "/api/credentials/invalid-id"
}
\`\`\`
    `.trim(),
    contact: {
      name: 'VitalCV Support',
      email: 'support@vitalcv.com',
      url: 'https://vitalcv.com/support',
    },
    license: {
      name: 'Proprietary',
      url: 'https://vitalcv.com/terms',
    },
  },
  servers: [
    {
      url: 'https://api.vitalcv.com',
      description: 'Production',
    },
    {
      url: 'https://sandbox-api.vitalcv.com',
      description: 'Sandbox',
    },
    {
      url: 'http://localhost:4000',
      description: 'Local Development',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Credentials', description: 'Credential management' },
    { name: 'NPI', description: 'NPI lookup and validation' },
    { name: 'Claims', description: 'Claim management' },
    { name: 'Issuer', description: 'Credential issuance (Issuer role)' },
    { name: 'Verifier', description: 'Credential verification (Verifier role)' },
    { name: 'Partner', description: 'Partner/ATS integration' },
  ],
  paths: {
    // Health Endpoints
    '/healthz': {
      get: {
        tags: ['Health'],
        summary: 'Comprehensive health check',
        description: 'Returns health status of all system components',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System healthy or degraded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheckResponse' },
              },
            },
          },
          '503': {
            description: 'System failing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheckResponse' },
              },
            },
          },
        },
      },
    },
    '/healthz/liveness': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Simple check if process is running (for K8s)',
        operationId: 'getLiveness',
        responses: {
          '200': {
            description: 'Process is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['OK'] },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/healthz/readiness': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Check if service is ready to accept traffic (for K8s)',
        operationId: 'getReadiness',
        responses: {
          '200': {
            description: 'Service is ready',
          },
          '503': {
            description: 'Service not ready',
          },
        },
      },
    },

    // Auth Endpoints
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT token',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProblemDetail' },
              },
            },
          },
        },
      },
    },
    '/api/auth/session': {
      get: {
        tags: ['Auth'],
        summary: 'Get current session',
        description: 'Returns current user session if authenticated',
        operationId: 'getSession',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Session found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponse' },
              },
            },
          },
          '401': {
            description: 'Not authenticated',
          },
        },
      },
    },

    // NPI Endpoints
    '/api/npi/lookup': {
      get: {
        tags: ['NPI'],
        summary: 'Look up NPI',
        description: 'Look up provider information by NPI number',
        operationId: 'lookupNpi',
        parameters: [
          {
            name: 'npi',
            in: 'query',
            required: true,
            schema: { type: 'string', pattern: '^[0-9]{10}$' },
            description: '10-digit NPI number',
          },
        ],
        responses: {
          '200': {
            description: 'Provider found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NpiLookupResponse' },
              },
            },
          },
          '404': {
            description: 'NPI not found',
          },
          '400': {
            description: 'Invalid NPI format',
          },
        },
      },
    },

    // Credentials Endpoints
    '/api/credentials': {
      get: {
        tags: ['Credentials'],
        summary: 'List credentials',
        description: 'Get all credentials for the authenticated user',
        operationId: 'listCredentials',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'pending', 'revoked', 'expired'] },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string' },
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
                      items: { $ref: '#/components/schemas/Credential' },
                    },
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
        summary: 'Get credential',
        description: 'Get a specific credential by ID',
        operationId: 'getCredential',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Credential found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Credential' },
              },
            },
          },
          '404': {
            description: 'Credential not found',
          },
        },
      },
    },

    // Claims Endpoints
    '/api/claims/{npi}/status': {
      get: {
        tags: ['Claims'],
        summary: 'Get claim status',
        description: 'Get the current claim status for an NPI',
        operationId: 'getClaimStatus',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'npi',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[0-9]{10}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Claim status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ClaimStatus' },
              },
            },
          },
        },
      },
    },

    // Verify Endpoints
    '/api/verify': {
      post: {
        tags: ['Verifier'],
        summary: 'Verify credential',
        description: 'Verify a credential presentation',
        operationId: 'verifyCredential',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerificationRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Verification result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VerificationResult' },
              },
            },
          },
        },
      },
    },

    // Issuer Endpoints
    '/api/issuer/attestations/pending': {
      get: {
        tags: ['Issuer'],
        summary: 'List pending attestations',
        description: 'Get all pending attestation requests (Issuer role required)',
        operationId: 'listPendingAttestations',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of pending attestation requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Issuer role required',
          },
        },
      },
    },

    // Partner Widget Endpoints
    '/api/partner/widget/token': {
      post: {
        tags: ['Partner'],
        summary: 'Get widget token',
        description: 'Get a token for embedding the verification widget',
        operationId: 'getWidgetToken',
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetNpi'],
                properties: {
                  targetNpi: { type: 'string', pattern: '^[0-9]{10}$' },
                  redirectUri: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Widget token issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid API key',
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
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      ProblemDetail: {
        type: 'object',
        required: ['type', 'title', 'status'],
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          instance: { type: 'string' },
        },
      },
      HealthCheckResponse: {
        type: 'object',
        properties: {
          overall: { type: 'string', enum: ['OK', 'DEGRADED', 'FAIL'] },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string' },
          components: {
            type: 'object',
            properties: {
              database: { $ref: '#/components/schemas/ComponentHealth' },
              queue: { $ref: '#/components/schemas/ComponentHealth' },
              chain: { $ref: '#/components/schemas/ComponentHealth' },
              tefca: { $ref: '#/components/schemas/ComponentHealth' },
              fhir: { $ref: '#/components/schemas/ComponentHealth' },
              ats: { $ref: '#/components/schemas/ComponentHealth' },
            },
          },
        },
      },
      ComponentHealth: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OK', 'DEGRADED', 'FAIL'] },
          latency: { type: 'number' },
          message: { type: 'string' },
          lastChecked: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      SessionResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['holder', 'issuer', 'verifier', 'recruiter', 'admin'] },
          npi: { type: 'string' },
        },
      },
      NpiLookupResponse: {
        type: 'object',
        properties: {
          npi: { type: 'string' },
          name: { type: 'string' },
          specialty: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              state: { type: 'string' },
            },
          },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      Credential: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string', enum: ['active', 'pending', 'revoked', 'expired'] },
          issuer: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          claims: { type: 'object', additionalProperties: true },
        },
      },
      ClaimStatus: {
        type: 'object',
        properties: {
          level: { type: 'integer', enum: [0, 1, 2, 3] },
          status: { type: 'string', enum: ['unclaimed', 'basic', 'verified', 'attested'] },
          lastUpdated: { type: 'string', format: 'date-time' },
        },
      },
      VerificationRequest: {
        type: 'object',
        required: ['credentialId'],
        properties: {
          credentialId: { type: 'string' },
          nonce: { type: 'string' },
          audience: { type: 'string' },
        },
      },
      VerificationResult: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          credential: { $ref: '#/components/schemas/Credential' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

export default openApiSpec;
