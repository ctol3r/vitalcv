import { TefcaPurposeOfUse } from './models/QhinConfig.js';

export type FhirDirectoryResource = 'Practitioner' | 'PractitionerRole' | 'Organization' | 'Endpoint';

type PouFieldMatrix = Record<FhirDirectoryResource, Partial<Record<TefcaPurposeOfUse, string[]>> & { DEFAULT: string[] }>;

const BASE_FIELDS = ['resourceType', 'id', 'meta', 'contained'];

const PRACTITIONER_CLINICAL_FIELDS = ['identifier', 'name', 'telecom', 'address', 'qualification', 'communication', 'active', 'gender', 'birthDate'];
const PRACTITIONER_DIRECTORY_FIELDS = ['identifier', 'name', 'telecom', 'address', 'active'];

const PRACTITIONER_ROLE_CLINICAL_FIELDS = ['identifier', 'practitioner', 'organization', 'code', 'specialty', 'telecom', 'location', 'availability', 'period', 'extension', 'endpoint'];
const PRACTITIONER_ROLE_DIRECTORY_FIELDS = ['identifier', 'practitioner', 'organization', 'code', 'telecom', 'period', 'endpoint'];

const ORGANIZATION_CLINICAL_FIELDS = ['identifier', 'name', 'type', 'telecom', 'address', 'partOf', 'endpoint'];
const ORGANIZATION_DIRECTORY_FIELDS = ['identifier', 'name', 'telecom', 'address'];

const ENDPOINT_CLINICAL_FIELDS = ['identifier', 'status', 'connectionType', 'name', 'managingOrganization', 'payload', 'address', 'header'];
const ENDPOINT_DIRECTORY_FIELDS = ['identifier', 'status', 'connectionType', 'name', 'address'];

const matrix: PouFieldMatrix = {
  Practitioner: {
    [TefcaPurposeOfUse.TREATMENT]: [...BASE_FIELDS, ...PRACTITIONER_CLINICAL_FIELDS],
    [TefcaPurposeOfUse.OPERATIONS]: [...BASE_FIELDS, ...PRACTITIONER_CLINICAL_FIELDS.filter((field) => field !== 'birthDate')],
    [TefcaPurposeOfUse.PAYMENT]: [...BASE_FIELDS, 'identifier', 'name', 'telecom', 'address', 'active'],
    [TefcaPurposeOfUse.DIRECTORY]: [...BASE_FIELDS, ...PRACTITIONER_DIRECTORY_FIELDS],
    DEFAULT: [...BASE_FIELDS, ...PRACTITIONER_DIRECTORY_FIELDS],
  },
  PractitionerRole: {
    [TefcaPurposeOfUse.TREATMENT]: [...BASE_FIELDS, ...PRACTITIONER_ROLE_CLINICAL_FIELDS],
    [TefcaPurposeOfUse.OPERATIONS]: [...BASE_FIELDS, ...PRACTITIONER_ROLE_CLINICAL_FIELDS.filter((field) => field !== 'availability')],
    [TefcaPurposeOfUse.PAYMENT]: [...BASE_FIELDS, 'identifier', 'practitioner', 'organization', 'code', 'telecom', 'period'],
    [TefcaPurposeOfUse.DIRECTORY]: [...BASE_FIELDS, ...PRACTITIONER_ROLE_DIRECTORY_FIELDS],
    DEFAULT: [...BASE_FIELDS, ...PRACTITIONER_ROLE_DIRECTORY_FIELDS],
  },
  Organization: {
    [TefcaPurposeOfUse.TREATMENT]: [...BASE_FIELDS, ...ORGANIZATION_CLINICAL_FIELDS],
    [TefcaPurposeOfUse.OPERATIONS]: [...BASE_FIELDS, ...ORGANIZATION_CLINICAL_FIELDS.filter((field) => field !== 'partOf')],
    [TefcaPurposeOfUse.PAYMENT]: [...BASE_FIELDS, 'identifier', 'name', 'telecom', 'address'],
    [TefcaPurposeOfUse.DIRECTORY]: [...BASE_FIELDS, ...ORGANIZATION_DIRECTORY_FIELDS],
    DEFAULT: [...BASE_FIELDS, ...ORGANIZATION_DIRECTORY_FIELDS],
  },
  Endpoint: {
    [TefcaPurposeOfUse.TREATMENT]: [...BASE_FIELDS, ...ENDPOINT_CLINICAL_FIELDS],
    [TefcaPurposeOfUse.OPERATIONS]: [...BASE_FIELDS, ...ENDPOINT_CLINICAL_FIELDS.filter((field) => field !== 'header')],
    [TefcaPurposeOfUse.PAYMENT]: [...BASE_FIELDS, 'identifier', 'status', 'connectionType', 'name', 'address'],
    [TefcaPurposeOfUse.DIRECTORY]: [...BASE_FIELDS, ...ENDPOINT_DIRECTORY_FIELDS],
    DEFAULT: [...BASE_FIELDS, ...ENDPOINT_DIRECTORY_FIELDS],
  },
};

export function getAllowedFields(resourceType: FhirDirectoryResource, pou: TefcaPurposeOfUse): string[] {
  const allowed = matrix[resourceType];
  return allowed[pou] || allowed.DEFAULT;
}

export function redactResourceFields<T extends Record<string, any>>(
  resource: T,
  resourceType: FhirDirectoryResource,
  pou: TefcaPurposeOfUse
): T {
  const allowedFields = new Set(getAllowedFields(resourceType, pou));
  const clone: Record<string, any> = {};

  for (const [key, value] of Object.entries(resource)) {
    if (allowedFields.has(key)) {
      clone[key] = value;
    }
  }

  return clone as T;
}

export function applyPouRedaction(resource: any, pou: TefcaPurposeOfUse): any {
  if (!resource || typeof resource !== 'object') {
    return resource;
  }

  const resourceType = resource.resourceType as FhirDirectoryResource | undefined;

  if (!resourceType || !(resourceType in matrix)) {
    return resource;
  }

  const redacted = redactResourceFields(resource, resourceType, pou);

  if (Array.isArray(resource.contained)) {
    redacted.contained = resource.contained.map((contained: any) => applyPouRedaction(contained, pou));
  }

  return redacted;
}

export function applyPouRedactionToBundle(bundle: any, pou: TefcaPurposeOfUse): any {
  if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
    return bundle;
  }

  const clone = { ...bundle };
  clone.entry = bundle.entry.map((entry: any) => ({
    ...entry,
    resource: applyPouRedaction(entry.resource, pou),
  }));

  return clone;
}

export const pouFieldMatrix = matrix;
/**
 * B166B-TEFCA-001: PoU matrix v2 (Treatment vs Ops vs Payment vs Directory)
 *
 * Defines allowed FHIR fields for TEFCA directory resources per Purpose of Use.
 * Used by FHIR facade middleware to redact disallowed attributes before returning responses.
 */

import { TefcaPurposeOfUse } from './models/QhinConfig';

export type DirectoryResourceType = 'Practitioner' | 'PractitionerRole' | 'Organization' | 'Endpoint';

type FieldRule = string[] | typeof ALLOW_ALL_TOKEN;

const ALLOW_ALL_TOKEN = '__ALL__';
const ALWAYS_ALLOWED_FIELDS = ['id', 'resourceType', 'meta'];

type PouMatrix = Record<DirectoryResourceType, Record<TefcaPurposeOfUse, FieldRule>>;

const POUMatrix: PouMatrix = {
  Practitioner: {
    [TefcaPurposeOfUse.TREATMENT]: ALLOW_ALL_TOKEN,
    [TefcaPurposeOfUse.OPERATIONS]: [
      'identifier',
      'name',
      'qualification',
      'telecom',
      'address',
      'communication',
    ],
    [TefcaPurposeOfUse.PAYMENT]: ['identifier', 'name'],
    [TefcaPurposeOfUse.DIRECTORY]: ['identifier', 'name', 'qualification'],
    [TefcaPurposeOfUse.RESEARCH]: ['identifier', 'name', 'telecom'],
    [TefcaPurposeOfUse.PUBLIC_HEALTH]: ['identifier', 'name', 'telecom', 'address'],
  },
  PractitionerRole: {
    [TefcaPurposeOfUse.TREATMENT]: ALLOW_ALL_TOKEN,
    [TefcaPurposeOfUse.OPERATIONS]: [
      'identifier',
      'code',
      'specialty',
      'telecom',
      'organization',
      'endpoint',
      'location',
    ],
    [TefcaPurposeOfUse.PAYMENT]: ['identifier', 'code', 'organization'],
    [TefcaPurposeOfUse.DIRECTORY]: ['identifier', 'code', 'organization', 'endpoint'],
    [TefcaPurposeOfUse.RESEARCH]: ['identifier', 'code', 'specialty', 'organization'],
    [TefcaPurposeOfUse.PUBLIC_HEALTH]: ['identifier', 'code', 'organization', 'location'],
  },
  Organization: {
    [TefcaPurposeOfUse.TREATMENT]: ALLOW_ALL_TOKEN,
    [TefcaPurposeOfUse.OPERATIONS]: ['identifier', 'name', 'telecom', 'address', 'endpoint'],
    [TefcaPurposeOfUse.PAYMENT]: ['identifier', 'name', 'telecom'],
    [TefcaPurposeOfUse.DIRECTORY]: ['identifier', 'name', 'endpoint'],
    [TefcaPurposeOfUse.RESEARCH]: ['identifier', 'name'],
    [TefcaPurposeOfUse.PUBLIC_HEALTH]: ['identifier', 'name', 'telecom', 'address'],
  },
  Endpoint: {
    [TefcaPurposeOfUse.TREATMENT]: ALLOW_ALL_TOKEN,
    [TefcaPurposeOfUse.OPERATIONS]: ['status', 'connectionType', 'payloadType', 'address', 'managingOrganization'],
    [TefcaPurposeOfUse.PAYMENT]: ['status', 'address'],
    [TefcaPurposeOfUse.DIRECTORY]: ['status', 'connectionType', 'payloadType', 'address'],
    [TefcaPurposeOfUse.RESEARCH]: ['status', 'address', 'payloadType'],
    [TefcaPurposeOfUse.PUBLIC_HEALTH]: ['status', 'payloadType', 'address'],
  },
};

/**
 * Returns true if PoU matrix is defined for the resource type.
 */
export function isDirectoryResource(resourceType: string): resourceType is DirectoryResourceType {
  return Object.prototype.hasOwnProperty.call(POUMatrix, resourceType);
}

/**
 * Build allowed field list (including required defaults) for the given resource + PoU.
 */
export function getAllowedFields(resourceType: DirectoryResourceType, pou: TefcaPurposeOfUse): string[] | null {
  const rule = POUMatrix[resourceType][pou];
  if (!rule || rule === ALLOW_ALL_TOKEN) {
    return null;
  }
  const uniqueFields = new Set([...ALWAYS_ALLOWED_FIELDS, ...rule]);
  return Array.from(uniqueFields);
}

/**
 * Apply PoU redaction to a single FHIR resource.
 */
export function applyPouMatrix<T extends Record<string, any>>(
  resource: T,
  pou: TefcaPurposeOfUse
): T {
  const resourceType = resource.resourceType;
  if (!resourceType || !isDirectoryResource(resourceType)) {
    return resource;
  }

  const allowedFields = getAllowedFields(resourceType, pou);

  if (!allowedFields) {
    return resource;
  }

  const redacted: Record<string, any> = {};
  for (const field of allowedFields) {
    if (resource[field] !== undefined) {
      redacted[field] = resource[field];
    }
  }

  return redacted as T;
}

/**
 * Apply PoU redaction to all resources within a Bundle.
 */
export function applyPouMatrixToBundle<T extends Record<string, any>>(
  bundle: T,
  pou: TefcaPurposeOfUse
): T {
  if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
    return bundle;
  }

  const redactedEntries = bundle.entry.map((entry: any) => {
    if (!entry?.resource) {
      return entry;
    }
    return {
      ...entry,
      resource: applyPouMatrix(entry.resource, pou),
    };
  });

  return {
    ...bundle,
    entry: redactedEntries,
  };
}

/**
 * Convenience helper for tests and admin tools to inspect matrix.
 */
export function getPouMatrix(): PouMatrix {
  return POUMatrix;
}


