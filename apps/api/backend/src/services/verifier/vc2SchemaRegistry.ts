/**
 * Wave 201 — VC2 Schema Registry
 * Canonical VitalCV credential type schemas (JSON Schema subset).
 */

export interface SchemaEntry {
  type: string;
  version: string;
  description: string;
  schema: Record<string, unknown>;
}

const SCHEMAS: SchemaEntry[] = [
  {
    type: 'HEALTHCARE_LICENSE',
    version: '1.0.0',
    description: 'State-issued healthcare professional license',
    schema: {
      type: 'object',
      required: ['npi', 'licenseNumber', 'state', 'licenseType', 'expiresAt', 'issuerDid'],
      properties: {
        npi:          { type: 'string', pattern: '^\\d{10}$' },
        licenseNumber:{ type: 'string', minLength: 1 },
        state:        { type: 'string', minLength: 2, maxLength: 2 },
        licenseType:  { type: 'string' },
        expiresAt:    { type: 'string', format: 'date-time' },
        issuerDid:    { type: 'string', pattern: '^did:' },
      },
    },
  },
  {
    type: 'NPI_BOUND_IDENTITY',
    version: '1.0.0',
    description: 'Cryptographic binding of NPI to a DID',
    schema: {
      type: 'object',
      required: ['npi', 'did', 'fingerprint', 'verifiedAt'],
      properties: {
        npi:         { type: 'string', pattern: '^\\d{10}$' },
        did:         { type: 'string', pattern: '^did:' },
        fingerprint: { type: 'string', minLength: 64, maxLength: 64 },
        verifiedAt:  { type: 'string', format: 'date-time' },
      },
    },
  },
  {
    type: 'EMPLOYMENT_ELIGIBILITY',
    version: '1.0.0',
    description: 'Employer-facing clear-to-start eligibility summary',
    schema: {
      type: 'object',
      required: ['npi', 'clearToStart', 'readinessScore'],
      properties: {
        npi:                { type: 'string', pattern: '^\\d{10}$' },
        clearToStart:       { type: 'boolean' },
        readinessScore:     { type: 'number', minimum: 0, maximum: 100 },
        missingCredentials: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    type: 'PSV_ARTIFACT',
    version: '1.0.0',
    description: 'Primary Source Verification artifact bundle',
    schema: {
      type: 'object',
      required: ['npi', 'source', 'artifactType', 'fetchedAt', 'checksum', 'rawPayloadHash'],
      properties: {
        npi:            { type: 'string', pattern: '^\\d{10}$' },
        source:         { type: 'string' },
        artifactType:   { type: 'string' },
        fetchedAt:      { type: 'string', format: 'date-time' },
        checksum:       { type: 'string', minLength: 64 },
        rawPayloadHash: { type: 'string', minLength: 64 },
      },
    },
  },
];

const schemaIndex = new Map(SCHEMAS.map((s) => [s.type, s]));

export function getSchema(credentialType: string): SchemaEntry | null {
  return schemaIndex.get(credentialType) ?? null;
}

export function listSchemas(): Pick<SchemaEntry, 'type' | 'version' | 'description'>[] {
  return SCHEMAS.map(({ type, version, description }) => ({ type, version, description }));
}

function checkRequired(obj: Record<string, unknown>, required: string[]): string[] {
  return required.filter((k) => !(k in obj)).map((k) => `Missing required field: ${k}`);
}

export function validateAgainstSchema(
  credential: unknown,
  type: string,
): { valid: boolean; errors: string[] } {
  const entry = getSchema(type);
  if (!entry) return { valid: false, errors: [`Unknown credential type: ${type}`] };
  if (typeof credential !== 'object' || credential === null) {
    return { valid: false, errors: ['Credential must be an object'] };
  }

  const obj = credential as Record<string, unknown>;
  const schema = entry.schema as { required?: string[]; properties?: Record<string, { type?: string; pattern?: string; minimum?: number; maximum?: number }> };
  const errors: string[] = [];

  if (schema.required) errors.push(...checkRequired(obj, schema.required));

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (!(key in obj)) continue;
      const val = obj[key];
      if (propSchema.type === 'string' && typeof val !== 'string') {
        errors.push(`${key} must be a string`);
      } else if (propSchema.type === 'number' && typeof val !== 'number') {
        errors.push(`${key} must be a number`);
      } else if (propSchema.type === 'boolean' && typeof val !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
      if (propSchema.pattern && typeof val === 'string') {
        if (!new RegExp(propSchema.pattern).test(val)) {
          errors.push(`${key} does not match pattern ${propSchema.pattern}`);
        }
      }
      if (propSchema.minimum !== undefined && typeof val === 'number' && val < propSchema.minimum) {
        errors.push(`${key} must be >= ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && typeof val === 'number' && val > propSchema.maximum) {
        errors.push(`${key} must be <= ${propSchema.maximum}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
