/**
 * Predefined Credential Schemas for VitalCV
 *
 * Common credential schemas following W3C VC Data Model
 */

import { CredentialSchemaDefinition, CREDENTIAL_TYPES } from './types'

/**
 * Driver License Credential Schema
 */
export const DRIVER_LICENSE_SCHEMA: CredentialSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitalcv.app/schemas/driver-license/v1',
  title: 'Driver License Credential',
  description: 'A verifiable credential representing a driver license',
  type: 'object',
  properties: {
    credentialSubject: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'DID of the license holder',
          pattern: '^did:',
        },
        licenseNumber: {
          type: 'string',
          description: 'Unique license number',
          minLength: 5,
          maxLength: 20,
        },
        licenseClass: {
          type: 'string',
          description: 'Class of license (A, B, C, etc.)',
          enum: ['A', 'B', 'C', 'D', 'E'],
        },
        givenName: {
          type: 'string',
          description: 'Given name of the holder',
          minLength: 1,
        },
        familyName: {
          type: 'string',
          description: 'Family name of the holder',
          minLength: 1,
        },
        birthDate: {
          type: 'string',
          description: 'Date of birth',
          format: 'date',
        },
        issuingAuthority: {
          type: 'string',
          description: 'Authority that issued the license',
        },
        issueDate: {
          type: 'string',
          description: 'Date the license was issued',
          format: 'date',
        },
        expiryDate: {
          type: 'string',
          description: 'Date the license expires',
          format: 'date',
        },
        restrictions: {
          type: 'array',
          description: 'Any restrictions on the license',
          items: {
            type: 'string',
          },
        },
        endorsements: {
          type: 'array',
          description: 'Special endorsements',
          items: {
            type: 'string',
          },
        },
      },
      required: ['id', 'licenseNumber', 'licenseClass', 'givenName', 'familyName', 'birthDate'],
    },
  },
  required: ['credentialSubject'],
}

/**
 * Health Pass Credential Schema
 */
export const HEALTH_PASS_SCHEMA: CredentialSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitalcv.app/schemas/health-pass/v1',
  title: 'Health Pass Credential',
  description: 'A verifiable health pass credential',
  type: 'object',
  properties: {
    credentialSubject: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'DID of the pass holder',
          pattern: '^did:',
        },
        passportNumber: {
          type: 'string',
          description: 'Health pass number',
        },
        givenName: {
          type: 'string',
          description: 'Given name',
        },
        familyName: {
          type: 'string',
          description: 'Family name',
        },
        birthDate: {
          type: 'string',
          description: 'Date of birth',
          format: 'date',
        },
        vaccinationStatus: {
          type: 'object',
          properties: {
            vaccine: {
              type: 'string',
              description: 'Vaccine name',
            },
            doses: {
              type: 'integer',
              description: 'Number of doses received',
              minimum: 0,
            },
            lastDoseDate: {
              type: 'string',
              description: 'Date of last dose',
              format: 'date',
            },
            manufacturer: {
              type: 'string',
              description: 'Vaccine manufacturer',
            },
          },
        },
        testResults: {
          type: 'array',
          description: 'COVID-19 test results',
          items: {
            type: 'object',
            properties: {
              testType: {
                type: 'string',
                enum: ['PCR', 'Antigen', 'Antibody'],
              },
              result: {
                type: 'string',
                enum: ['Negative', 'Positive', 'Inconclusive'],
              },
              testDate: {
                type: 'string',
                format: 'date-time',
              },
              laboratory: {
                type: 'string',
              },
            },
          },
        },
      },
      required: ['id', 'givenName', 'familyName', 'birthDate'],
    },
  },
  required: ['credentialSubject'],
}

/**
 * Professional License Credential Schema
 */
export const PROFESSIONAL_LICENSE_SCHEMA: CredentialSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitalcv.app/schemas/professional-license/v1',
  title: 'Professional License Credential',
  description: 'A verifiable professional license credential',
  type: 'object',
  properties: {
    credentialSubject: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'DID of the license holder',
          pattern: '^did:',
        },
        licenseNumber: {
          type: 'string',
          description: 'License number',
        },
        profession: {
          type: 'string',
          description: 'Professional field',
          enum: ['Medicine', 'Law', 'Engineering', 'Nursing', 'Teaching', 'Accounting', 'Other'],
        },
        specialty: {
          type: 'string',
          description: 'Area of specialization',
        },
        givenName: {
          type: 'string',
          description: 'Given name',
        },
        familyName: {
          type: 'string',
          description: 'Family name',
        },
        issuingBoard: {
          type: 'string',
          description: 'Licensing board or authority',
        },
        issueDate: {
          type: 'string',
          description: 'Date issued',
          format: 'date',
        },
        expiryDate: {
          type: 'string',
          description: 'Expiration date',
          format: 'date',
        },
        certifications: {
          type: 'array',
          description: 'Additional certifications',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              issuer: { type: 'string' },
              date: { type: 'string', format: 'date' },
            },
          },
        },
      },
      required: ['id', 'licenseNumber', 'profession', 'givenName', 'familyName', 'issuingBoard'],
    },
  },
  required: ['credentialSubject'],
}

/**
 * University Degree Credential Schema
 */
export const UNIVERSITY_DEGREE_SCHEMA: CredentialSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitalcv.app/schemas/university-degree/v1',
  title: 'University Degree Credential',
  description: 'A verifiable university degree credential',
  type: 'object',
  properties: {
    credentialSubject: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'DID of the degree holder',
          pattern: '^did:',
        },
        givenName: {
          type: 'string',
          description: 'Given name',
        },
        familyName: {
          type: 'string',
          description: 'Family name',
        },
        degree: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Degree type',
              enum: ['Bachelor', 'Master', 'Doctorate', 'Associate', 'Certificate'],
            },
            name: {
              type: 'string',
              description: 'Degree name',
            },
            field: {
              type: 'string',
              description: 'Field of study',
            },
          },
          required: ['type', 'name', 'field'],
        },
        university: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'University name',
            },
            location: {
              type: 'string',
              description: 'University location',
            },
          },
          required: ['name'],
        },
        graduationDate: {
          type: 'string',
          description: 'Date of graduation',
          format: 'date',
        },
        honors: {
          type: 'string',
          description: 'Honors received',
          enum: ['Summa Cum Laude', 'Magna Cum Laude', 'Cum Laude', 'None'],
        },
        gpa: {
          type: 'number',
          description: 'Grade point average',
          minimum: 0,
          maximum: 4,
        },
      },
      required: ['id', 'givenName', 'familyName', 'degree', 'university', 'graduationDate'],
    },
  },
  required: ['credentialSubject'],
}

/**
 * Age Verification Credential Schema (Privacy-Preserving)
 */
export const AGE_VERIFICATION_SCHEMA: CredentialSchemaDefinition = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://vitalcv.app/schemas/age-verification/v1',
  title: 'Age Verification Credential',
  description: 'A privacy-preserving age verification credential',
  type: 'object',
  properties: {
    credentialSubject: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'DID of the subject',
          pattern: '^did:',
        },
        over18: {
          type: 'boolean',
          description: 'Over 18 years old',
        },
        over21: {
          type: 'boolean',
          description: 'Over 21 years old',
        },
        over65: {
          type: 'boolean',
          description: 'Over 65 years old',
        },
        birthYear: {
          type: 'integer',
          description: 'Year of birth (optional)',
          minimum: 1900,
          maximum: 2100,
        },
      },
      required: ['id'],
    },
  },
  required: ['credentialSubject'],
}

/**
 * Map of credential types to their schemas
 */
export const CREDENTIAL_SCHEMAS: Record<string, CredentialSchemaDefinition> = {
  [CREDENTIAL_TYPES.DRIVER_LICENSE]: DRIVER_LICENSE_SCHEMA,
  [CREDENTIAL_TYPES.HEALTH_PASS]: HEALTH_PASS_SCHEMA,
  [CREDENTIAL_TYPES.PROFESSIONAL_LICENSE]: PROFESSIONAL_LICENSE_SCHEMA,
  [CREDENTIAL_TYPES.UNIVERSITY_DEGREE]: UNIVERSITY_DEGREE_SCHEMA,
  [CREDENTIAL_TYPES.AGE_VERIFICATION]: AGE_VERIFICATION_SCHEMA,
}

/**
 * Get schema by credential type
 */
export function getSchemaByType(type: string): CredentialSchemaDefinition | undefined {
  return CREDENTIAL_SCHEMAS[type]
}

/**
 * Validate credential subject against schema
 */
export function validateCredentialSubject(
  subject: unknown,
  schema: CredentialSchemaDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!subject || typeof subject !== 'object') {
    return { valid: false, errors: ['Credential subject must be an object'] }
  }

  const subjectSchema = schema.properties.credentialSubject
  if (!subjectSchema || subjectSchema.type !== 'object') {
    return { valid: false, errors: ['Invalid schema: credentialSubject must be object type'] }
  }

  // Check required fields
  const required = subjectSchema.required || []
  for (const field of required) {
    if (!(field in (subject as Record<string, unknown>))) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Basic type checking for properties
  const subjectObj = subject as Record<string, unknown>
  for (const [key, value] of Object.entries(subjectObj)) {
    const propSchema = subjectSchema.properties[key]
    if (propSchema) {
      // Basic type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value
      const expectedType = propSchema.type

      if (typeof expectedType === 'string' && actualType !== expectedType) {
        errors.push(`Field '${key}' should be ${expectedType}, got ${actualType}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
