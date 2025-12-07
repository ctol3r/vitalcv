import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { CredentialSchemaDefinition, CredentialSchemaId, DisclosureGroup } from './types';

export interface RegisteredSchema extends CredentialSchemaDefinition {
  validator: ValidateFunction;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export class CredentialSchemaRegistry {
  private readonly ajv: Ajv;
  private readonly schemas = new Map<CredentialSchemaId, RegisteredSchema>();

  constructor(definitions: CredentialSchemaDefinition[] = defaultSchemas) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);

    definitions.forEach((definition) => this.register(definition));
  }

  register(definition: CredentialSchemaDefinition): void {
    const validator = this.ajv.compile(definition.schema);
    this.schemas.set(definition.id, {
      ...definition,
      validator,
    });
  }

  get(schemaId: CredentialSchemaId): RegisteredSchema {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema ${schemaId} is not registered`);
    }
    return schema;
  }

  validate(schemaId: CredentialSchemaId, credential: any): ValidationResult {
    const schema = this.get(schemaId);
    const isValid = schema.validator(credential);
    if (isValid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: formatErrors(schema.validator.errors),
    };
  }

  list(): RegisteredSchema[] {
    return Array.from(this.schemas.values());
  }
}

function formatErrors(errors?: ErrorObject[] | null): string[] | undefined {
  if (!errors) {
    return undefined;
  }

  return errors.map((err) => `${err.instancePath || '/'} ${err.message ?? ''}`.trim());
}

const baseVcProperties = {
  '@context': {
    type: 'array',
    minItems: 1,
    items: { type: 'string' },
  },
  type: {
    type: 'array',
    minItems: 1,
    items: { type: 'string' },
  },
  issuer: {
    anyOf: [
      { type: 'string' },
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
        additionalProperties: true,
      },
    ],
  },
  issuanceDate: { type: 'string' },
  expirationDate: { type: 'string', nullable: true },
  credentialStatus: {
    type: 'object',
    additionalProperties: true,
    nullable: true,
  },
};

function buildDisclosureGroup(
  id: string,
  label: string,
  claims: string[],
  options: { description?: string; required?: boolean } = {},
): DisclosureGroup {
  return {
    id,
    label,
    claims,
    description: options.description,
    required: options.required,
  };
}

const clinicianIdentitySchema: CredentialSchemaDefinition = {
  id: 'ClinicianIdentityVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          npi: { type: 'string', pattern: '^[0-9]{10}$' },
          specialty: { type: 'string' },
          degree: { type: 'string', nullable: true },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'identity-core',
      'Identity basics',
      ['credentialSubject.name', 'credentialSubject.npi'],
      { required: true, description: 'Name and NPI are always required for matching' },
    ),
    buildDisclosureGroup('identity-specialty', 'Specialty', ['credentialSubject.specialty']),
    buildDisclosureGroup('identity-degree', 'Degree', ['credentialSubject.degree']),
  ],
};

const licenseSchema: CredentialSchemaDefinition = {
  id: 'LicenseVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          licenseNumber: { type: 'string' },
          state: { type: 'string' },
          status: { type: 'string' },
          issuedOn: { type: 'string' },
          expiresOn: { type: 'string' },
          board: { type: 'string', nullable: true },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'license-core',
      'License identifiers',
      ['credentialSubject.licenseNumber', 'credentialSubject.state'],
      { required: true },
    ),
    buildDisclosureGroup('license-status', 'Status timeline', [
      'credentialSubject.status',
      'credentialSubject.issuedOn',
      'credentialSubject.expiresOn',
    ]),
    buildDisclosureGroup('license-board', 'Issuing board', ['credentialSubject.board']),
  ],
};

const boardSchema: CredentialSchemaDefinition = {
  id: 'BoardCertVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          board: { type: 'string' },
          specialty: { type: 'string' },
          certifiedOn: { type: 'string' },
          expiresOn: { type: 'string' },
          status: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'board-summary',
      'Board certification summary',
      ['credentialSubject.board', 'credentialSubject.specialty'],
      { required: true },
    ),
    buildDisclosureGroup('board-status', 'Certification status', [
      'credentialSubject.certifiedOn',
      'credentialSubject.expiresOn',
      'credentialSubject.status',
    ]),
  ],
};

const deaSchema: CredentialSchemaDefinition = {
  id: 'DEAStatusVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          registrationNumber: { type: 'string' },
          schedules: {
            type: 'array',
            items: { type: 'string' },
          },
          status: { type: 'string' },
          expiresOn: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'dea-registration',
      'DEA registration',
      ['credentialSubject.registrationNumber'],
      { required: true },
    ),
    buildDisclosureGroup('dea-schedules', 'Schedules', ['credentialSubject.schedules']),
    buildDisclosureGroup('dea-status', 'Status', [
      'credentialSubject.status',
      'credentialSubject.expiresOn',
    ]),
  ],
};

const pecosSchema: CredentialSchemaDefinition = {
  id: 'PECOSStatusVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          enrollmentId: { type: 'string' },
          status: { type: 'string' },
          effectiveDate: { type: 'string' },
          lastRevalidated: { type: 'string', nullable: true },
          remarks: { type: 'string', nullable: true },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'pecos-summary',
      'PECOS enrollment',
      ['credentialSubject.enrollmentId', 'credentialSubject.status'],
      { required: true },
    ),
    buildDisclosureGroup('pecos-timeline', 'Coverage timeline', [
      'credentialSubject.effectiveDate',
      'credentialSubject.lastRevalidated',
    ]),
    buildDisclosureGroup('pecos-remarks', 'Remarks', ['credentialSubject.remarks']),
  ],
};

const privilegeSchema: CredentialSchemaDefinition = {
  id: 'PrivilegeVC',
  schema: {
    type: 'object',
    required: ['@context', 'type', 'issuer', 'issuanceDate', 'credentialSubject'],
    properties: {
      ...baseVcProperties,
      credentialSubject: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          facilityId: { type: 'string' },
          facilityName: { type: 'string' },
          privileges: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code', 'description', 'status'],
              properties: {
                code: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
              },
              additionalProperties: true,
            },
          },
          grantedOn: { type: 'string' },
          expiresOn: { type: 'string', nullable: true },
        },
        additionalProperties: true,
      },
    },
    additionalProperties: true,
  },
  disclosureGroups: [
    buildDisclosureGroup(
      'privilege-facility',
      'Facility information',
      ['credentialSubject.facilityId', 'credentialSubject.facilityName'],
      { required: true },
    ),
    buildDisclosureGroup('privilege-assignments', 'Granted privileges', [
      'credentialSubject.privileges',
    ]),
    buildDisclosureGroup('privilege-timeline', 'Privilege timeline', [
      'credentialSubject.grantedOn',
      'credentialSubject.expiresOn',
    ]),
  ],
};

const defaultSchemas: CredentialSchemaDefinition[] = [
  clinicianIdentitySchema,
  licenseSchema,
  boardSchema,
  deaSchema,
  pecosSchema,
  privilegeSchema,
];

export { defaultSchemas };


