import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SchemaDocument = Record<string, unknown>;

function loadSchema(fileName: string): SchemaDocument {
  const absolutePath = path.resolve(__dirname, '..', fileName);
  const contents = readFileSync(absolutePath, 'utf8');
  return JSON.parse(contents) as SchemaDocument;
}

const ClinicianIdentityVC = loadSchema('ClinicianIdentityVC.json');
const CompactsStatus = loadSchema('CompactsStatus.json');
const IMLCLicense = loadSchema('IMLCLicense.json');
const JobEligibility = loadSchema('JobEligibility.json');
const PrivilegeGranted = loadSchema('PrivilegeGranted.json');
const PrivilegeGrantedV2 = loadSchema('PrivilegeGranted.v2.json');

export const schemas = {
  ClinicianIdentityVC,
  CompactsStatus,
  IMLCLicense,
  JobEligibility,
  PrivilegeGranted,
  PrivilegeGrantedV2,
} as const;

export type SchemaName = keyof typeof schemas;
export type LoadedSchema = (typeof schemas)[SchemaName];

export function getSchema(name: SchemaName): LoadedSchema {
  return schemas[name];
}

export {
  ClinicianIdentityVC,
  CompactsStatus,
  IMLCLicense,
  JobEligibility,
  PrivilegeGranted,
  PrivilegeGrantedV2
};


