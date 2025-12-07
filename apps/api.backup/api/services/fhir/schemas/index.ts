import practitionerSchema from './practitioner.schema.json';
import practitionerRoleSchema from './practitionerRole.schema.json';
import organizationSchema from './organization.schema.json';
import endpointSchema from './endpoint.schema.json';
import provenanceSchema from './provenance.schema.json';
import { R6ResourceType } from '../types/r6';

export type SchemaRegistry = Record<R6ResourceType, object>;

export const schemaRegistry: SchemaRegistry = {
  Practitioner: practitionerSchema,
  PractitionerRole: practitionerRoleSchema,
  Organization: organizationSchema,
  Endpoint: endpointSchema,
  Provenance: provenanceSchema,
};

export function getSchema(type: R6ResourceType): object {
  return schemaRegistry[type];
}

export const registeredTypes = Object.keys(schemaRegistry) as R6ResourceType[];


