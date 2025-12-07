export type AllowedTemplateType = 'license' | 'board-cert' | 'employment' | 'cme';

interface TemplateValidationError {
  field: string;
  message: string;
}

export interface TemplateValidationResult {
  valid: boolean;
  templateType?: AllowedTemplateType;
  errors?: TemplateValidationError[];
}

interface TemplateGuardrail {
  id: AllowedTemplateType;
  vcTypes: string[];
  requiredFields: string[];
}

const TEMPLATE_GUARDRAILS: TemplateGuardrail[] = [
  {
    id: 'license',
    vcTypes: ['MedicalLicenseCredential', 'LicenseCredential'],
    requiredFields: [
      'credentialSubject.license.number',
      'credentialSubject.license.state',
      'credentialSubject.license.expiresOn',
    ],
  },
  {
    id: 'board-cert',
    vcTypes: ['BoardCertificationCredential', 'BoardCredential'],
    requiredFields: [
      'credentialSubject.board.name',
      'credentialSubject.board.specialty',
      'credentialSubject.board.certificateId',
    ],
  },
  {
    id: 'employment',
    vcTypes: ['EmploymentCredential', 'ClinicianEmploymentCredential'],
    requiredFields: [
      'credentialSubject.organization.name',
      'credentialSubject.position.title',
      'credentialSubject.position.startDate',
    ],
  },
  {
    id: 'cme',
    vcTypes: ['CmeCredential', 'ContinuingEducationCredential'],
    requiredFields: [
      'credentialSubject.program.name',
      'credentialSubject.program.hours',
      'credentialSubject.program.completedOn',
    ],
  },
];

export function validateTemplateSchema(schema: unknown): TemplateValidationResult {
  if (!schema || typeof schema !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'schema', message: 'Schema payload must be a JSON object' }],
    };
  }

  const normalizedTypes = normalizeTypes((schema as Record<string, any>).type ?? (schema as any)?.credentialType);
  const guardrail = TEMPLATE_GUARDRAILS.find((candidate) =>
    candidate.vcTypes.some((type) => normalizedTypes.includes(type)),
  );

  if (!guardrail) {
    return {
      valid: false,
      errors: [
        {
          field: 'type',
          message: `Schema type must be one of: ${TEMPLATE_GUARDRAILS.flatMap((g) => g.vcTypes).join(', ')}`,
        },
      ],
    };
  }

  const errors: TemplateValidationError[] = [];
  for (const path of guardrail.requiredFields) {
    if (!hasPath(schema as Record<string, any>, path)) {
      errors.push({
        field: path,
        message: 'Required field missing in schema',
      });
    }
  }

  return {
    valid: errors.length === 0,
    templateType: guardrail.id,
    errors: errors.length ? errors : undefined,
  };
}

function normalizeTypes(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasPath(source: Record<string, any>, path: string): boolean {
  const segments = path.split('.');
  let cursor: any = source;
  for (const segment of segments) {
    if (cursor == null) {
      return false;
    }
    cursor = cursor[segment];
  }
  return cursor !== undefined && cursor !== null && cursor !== '';
}










