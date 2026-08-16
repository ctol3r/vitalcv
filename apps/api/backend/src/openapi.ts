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
    // ── Wave 157: Compliance Co-Pilot ───────────────────────────────────
    '/api/ai/compliance-check': {
      post: {
        tags: ['Compliance'],
        summary: 'Run a compliance readiness check for a clinician',
        description: 'Evaluates clinician credentials against state + facility compliance rules. Returns findings with citations.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['npi', 'targetState', 'targetFacility'],
                properties: {
                  npi: { type: 'string', description: 'NPI of the clinician' },
                  targetState: { type: 'string', description: 'Target state (e.g., CA, NY, TX)' },
                  targetFacility: { type: 'string', description: 'Facility type (e.g., hospital, clinic)' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Compliance check result with findings and citations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    npi: { type: 'string' },
                    readiness: { type: 'string', enum: ['READY', 'PARTIAL', 'NOT_READY', 'UNKNOWN'] },
                    confidence: { type: 'number' },
                    findings: { type: 'array', items: { type: 'object' } },
                    citations: { type: 'array', items: { type: 'object' } },
                    traceId: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing parameters' },
          '403': { description: 'Feature disabled' },
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
    { name: 'Compliance', description: 'AI-assisted compliance checking (Wave 157)' },
  ],
};

export default spec;
