import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { getSchema, registeredTypes } from './schemas';
import { R6ResourceType } from './types/r6';

export interface ValidationIssue {
  message: string;
  path?: string;
  keyword?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});
addFormats(ajv);

const compiledValidators = new Map<R6ResourceType, ValidateFunction>();

for (const type of registeredTypes) {
  const schema = getSchema(type);
  ajv.addSchema(schema, type);
  compiledValidators.set(type, ajv.getSchema(type)!);
}

function formatError(error: ErrorObject): ValidationIssue {
  const path = error.instancePath || error.schemaPath;
  return {
    message: error.message ?? 'Invalid resource',
    path,
    keyword: error.keyword,
  };
}

export function validateResource(resource: unknown, type: R6ResourceType): ValidationResult {
  const validator = compiledValidators.get(type);
  if (!validator) {
    throw new Error(`No schema registered for resource type ${type}`);
  }

  const valid = validator(resource);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validator.errors ?? []).map(formatError);
  return {
    valid: false,
    errors,
  };
}


