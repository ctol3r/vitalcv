import type { OpenAPIV3 } from 'openapi-types';

const spec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'VitalCV API',
    version: '1.0.0',
    description:
      'Healthcare credentialing API. Verify once, trust everywhere. ' +
      'The canonical path enforces Recognition → Acceptance → Start with cryptographic audit trails.',
    contact: {
      name: 'VitalCV',
    },
  },
  servers: [
    { url: '/', description: 'Current server' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for write operations. Obtain from your organization admin.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['error'],
      },
      Verification: {
        type: 'object',
        properties: {
          verifiedAt: { type: 'string', format: 'date-time' },
          verificationRef: { type: 'string', description: 'PSV report reference ID' },
        },
        required: ['verifiedAt', 'verificationRef'],
      },
      RecognitionInput: {
        type: 'object',
        properties: {
          subjectId: { type: 'string', description: 'Clinician identifier (e.g. clinician:alice)' },
          employerId: { type: 'string', description: 'Employer identifier' },
          recognizedAt: { type: 'string', format: 'date-time' },
          verification: { $ref: '#/components/schemas/Verification' },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Expiry timestamp or null for no expiry',
          },
        },
        required: ['subjectId', 'employerId', 'recognizedAt', 'verification', 'expiresAt'],
      },
      AcceptanceInput: {
        type: 'object',
        properties: {
          recognitionId: { type: 'string', description: 'ID of the prior recognition event' },
          employerId: { type: 'string' },
          facilityId: { type: 'string' },
          acceptedAt: { type: 'string', format: 'date-time' },
          psvReportId: { type: 'string', description: 'PSV report ID (required)' },
        },
        required: ['recognitionId', 'acceptedAt', 'psvReportId'],
      },
      StartInput: {
        type: 'object',
        properties: {
          acceptanceId: { type: 'string', description: 'ID of the prior acceptance event' },
          attestedAt: { type: 'string', format: 'date-time' },
        },
        required: ['acceptanceId', 'attestedAt'],
      },
      TrustState: {
        type: 'object',
        properties: {
          recognized: { type: 'boolean' },
          accepted: { type: 'boolean' },
          started: { type: 'boolean' },
          recognitionId: { type: 'string', nullable: true },
          acceptanceId: { type: 'string', nullable: true },
          startId: { type: 'string', nullable: true },
          start_ready: { type: 'boolean' },
          crs: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              band: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED'] },
              factors: { type: 'object', additionalProperties: true },
            },
          },
          blocking_reasons: {
            type: 'array',
            items: { type: 'string' },
          },
          timeline_preview: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                label: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                employer: { type: 'string', nullable: true },
                facility: { type: 'string', nullable: true },
                metadata: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
      SubjectStatus: {
        type: 'object',
        properties: {
          recognized: { type: 'boolean' },
          accepted: { type: 'boolean' },
          started: { type: 'boolean' },
          recognitionId: { type: 'string', nullable: true },
          acceptanceId: { type: 'string', nullable: true },
          startId: { type: 'string', nullable: true },
        },
      },
      NpiIngestRequest: {
        type: 'object',
        properties: {
          clinician_id: { type: 'string', description: 'Clinician identifier (optional if npi provided)' },
          npi: { type: 'string', description: '10-digit NPI number' },
        },
        required: ['npi'],
      },
      FileIngestRequest: {
        type: 'object',
        properties: {
          clinician_id: { type: 'string' },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                mime_type: { type: 'string' },
                content_base64: { type: 'string', description: 'Base64-encoded file content' },
              },
              required: ['filename', 'mime_type', 'content_base64'],
            },
          },
        },
        required: ['clinician_id', 'files'],
      },
      VerificationRequest: {
        type: 'object',
        properties: {
          clinician_id: { type: 'string' },
          lane: { type: 'string', enum: ['PUBLIC', 'PARTNER', 'MANUAL'] },
          subject: { type: 'string', description: 'Credential subject (e.g. license type)' },
        },
        required: ['clinician_id', 'lane', 'subject'],
      },
    },
  },
  paths: {
    '/': {
      get: {
        summary: 'API info',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'API name and version',
            content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } } } },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Service health with latency metrics',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, metrics: { type: 'object' } } } } },
          },
        },
      },
    },
    '/recognitions': {
      post: {
        summary: 'Create a recognition event',
        description:
          'Records that a clinician has been recognized (verified) by an employer. ' +
          'This is the first step in the canonical path: Recognition → Acceptance → Start.',
        tags: ['Canonical Path'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  recognition: { $ref: '#/components/schemas/RecognitionInput' },
                },
                required: ['recognition'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Recognition created',
            content: { 'application/json': { schema: { type: 'object', properties: { recognitionId: { type: 'string' } } } } },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/recognitions/{recognitionId}': {
      get: {
        summary: 'Get a recognition by ID',
        tags: ['Canonical Path'],
        parameters: [
          { name: 'recognitionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Recognition details',
            content: { 'application/json': { schema: { type: 'object', properties: { recognition: { type: 'object' } } } } },
          },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/acceptances': {
      post: {
        summary: 'Create an acceptance event',
        description:
          'Records that an employer has accepted a recognized clinician. ' +
          'Requires a prior recognition and completed PSV. Second step in the canonical path.',
        tags: ['Canonical Path'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  acceptance: { $ref: '#/components/schemas/AcceptanceInput' },
                },
                required: ['acceptance'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Acceptance created',
            content: { 'application/json': { schema: { type: 'object', properties: { acceptanceId: { type: 'string' } } } } },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Missing or invalid API key' },
          '404': { description: 'Recognition not found' },
          '409': { description: 'Domain constraint violated (missing PSV, identity conflict, etc.)' },
        },
      },
    },
    '/starts': {
      post: {
        summary: 'Create a start attestation',
        description:
          'Attests that a clinician has started work at an employer. ' +
          'Final step in the canonical path. Enforces PSV freshness, sanctions check, and CRS threshold.',
        tags: ['Canonical Path'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  start: { $ref: '#/components/schemas/StartInput' },
                },
                required: ['start'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Start attestation recorded',
            content: { 'application/json': { schema: { type: 'object', properties: { startId: { type: 'string' } } } } },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Missing or invalid API key' },
          '404': { description: 'Acceptance or recognition not found' },
          '409': { description: 'Domain constraint violated (expired PSV, revoked, sanctions, already started, etc.)' },
        },
      },
    },
    '/status/{subject_id}': {
      get: {
        summary: 'Get subject status',
        description: 'Returns the canonical path status for a clinician (recognized, accepted, started).',
        tags: ['Trust State'],
        parameters: [
          { name: 'subject_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Subject status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SubjectStatus' } } },
          },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/trust-state': {
      get: {
        summary: 'Compute trust state',
        description:
          'Computes the full trust state for a clinician including CRS score, blocking reasons, ' +
          'and timeline preview. Rate-limited, no API key required.',
        tags: ['Trust State'],
        parameters: [
          { name: 'clinician_id', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'employer_id', in: 'query', required: false, schema: { type: 'string' }, description: 'Filter acceptances to this employer' },
          { name: 'simulate_decay', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'] }, description: 'Simulate trust decay' },
        ],
        responses: {
          '200': {
            description: 'Trust state',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TrustState' } } },
          },
          '400': { description: 'clinician_id required' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/trust-state/{clinician_id}': {
      get: {
        summary: 'Compute trust state (path param)',
        description: 'Alias for /trust-state?clinician_id=... using path parameter.',
        tags: ['Trust State'],
        parameters: [
          { name: 'clinician_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Trust state',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TrustState' } } },
          },
          '400': { description: 'clinician_id required' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/verification/request': {
      post: {
        summary: 'Request a verification',
        description: 'Submits a new verification request for a clinician credential.',
        tags: ['Verification'],
        security: [{ ApiKeyAuth: [] }],
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
            description: 'Verification request created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request_id: { type: 'string' },
                    clinician_id: { type: 'string' },
                    lane: { type: 'string' },
                    subject: { type: 'string' },
                    status: { type: 'string', enum: ['PENDING'] },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/ingest/npi': {
      post: {
        summary: 'Ingest clinician identity via NPI',
        description:
          'Looks up the NPPES registry by NPI number and ingests the clinician identity. ' +
          'Idempotent: repeated calls with the same payload return cached results.',
        tags: ['Ingest'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NpiIngestRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Identity ingested (or cached)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clinician_identity: { type: 'object' },
                    conflicts: { type: 'array', items: { type: 'object' } },
                    audit_ref: { type: 'string' },
                    request_hash: { type: 'string' },
                    idempotent: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid NPI or missing field' },
          '401': { description: 'Missing or invalid API key' },
          '502': { description: 'NPPES API unavailable' },
        },
      },
    },
    '/ingest/files': {
      post: {
        summary: 'Ingest credential files',
        description:
          'Parses uploaded credential documents (base64-encoded) and extracts candidate credentials. ' +
          'Idempotent: repeated calls with the same payload return cached results.',
        tags: ['Ingest'],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FileIngestRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Files ingested (or cached)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    candidate_credentials: { type: 'array', items: { type: 'object' } },
                    total_candidate_credentials: { type: 'number' },
                    conflicts: { type: 'array', items: { type: 'object' } },
                    has_unresolved_conflicts: { type: 'boolean' },
                    conflict_ids: { type: 'array', items: { type: 'string' } },
                    audit_ref: { type: 'string' },
                    request_hash: { type: 'string' },
                    idempotent: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Missing or invalid API key' },
          '413': { description: 'File too large' },
          '415': { description: 'Unsupported file type' },
        },
      },
    },
    // ── Wave 154: Wallet Export ─────────────────────────────────────────
    '/api/credentials/export/wallet': {
      post: {
        tags: ['Wallet'],
        summary: 'Export credentials to a wallet-compatible format',
        description: 'Supports CHAPI (VPR/store) and SMART Health Card (file/deeplink/QR) export types.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['exportType'],
                properties: {
                  subject: { type: 'string', description: 'NPI or DID of the credential subject' },
                  credentialIds: { type: 'array', items: { type: 'string' }, description: 'Credential IDs to export' },
                  exportType: {
                    type: 'string',
                    enum: [
                      'chapi_vpr_request',
                      'chapi_store_payload',
                      'smart_health_card_file',
                      'smart_health_card_deeplink',
                      'smart_health_card_qr_payload',
                    ],
                    description: 'Target wallet export format',
                  },
                  reason: { type: 'string', description: 'Reason for presentation request (CHAPI VPR only)' },
                  domain: { type: 'string', description: 'Domain for the wallet interaction' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Wallet export payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    exportType: { type: 'string' },
                    data: { type: 'object', description: 'Format-specific payload' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request parameters' },
          '403': { description: 'Feature disabled' },
          '500': { description: 'Export failed' },
        },
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Health and status endpoints' },
    { name: 'Canonical Path', description: 'Recognition → Acceptance → Start lifecycle' },
    { name: 'Trust State', description: 'Read-only trust state queries (public, rate-limited)' },
    { name: 'Verification', description: 'Verification request management' },
    { name: 'Ingest', description: 'Clinician identity and credential ingestion' },
    { name: 'Wallet', description: 'Credential wallet export (CHAPI + SMART Health Cards)' },
  ],
};

export default spec;
