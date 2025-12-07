/**
 * B196B-CONTRACT-007
 * Provider domain contracts shared across FHIR facade, ingest pipelines, and VC adapters.
 */

import type { JsonObject, JsonValue } from '@domain/identity/contracts';

// ---------------------------------------------------------------------------
// Normalized provider directory record (NPI / NPPES)
// ---------------------------------------------------------------------------

export interface ProviderAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
  type?: string;
}

export interface ProviderTelecom {
  system: 'phone' | 'email' | 'url' | 'fax' | 'pager' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

export interface ProviderNormalizedRecord {
  id: string;
  clinicianId?: string | null;
  practitionerId?: string | null;
  npi: string;
  source: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  suffix?: string | null;
  primaryTaxonomy?: string | null;
  taxonomyCodes: string[];
  addresses?: ProviderAddress[];
  telecom?: ProviderTelecom[];
  nameMetadata?: JsonObject;
  lastSyncedAt: string;
  rawPayload?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// FHIR R6 Practitioner + PractitionerRole helpers
// ---------------------------------------------------------------------------

export interface FhirCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  system: string;
  value: string;
  type?: {
    coding?: FhirCoding[];
  };
}

export interface FhirHumanName {
  use?: 'official' | 'usual' | 'nickname';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FhirContactPoint {
  system: 'phone' | 'email' | 'url' | 'fax' | 'pager' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

export interface FhirAddress {
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirQualification {
  code: FhirCodeableConcept;
  issuer?: {
    display?: string;
  };
  period?: FhirPeriod;
  identifier?: FhirIdentifier[];
}

export interface PractitionerResource {
  resourceType: 'Practitioner';
  id: string;
  identifier: FhirIdentifier[];
  name: FhirHumanName[];
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
  qualification?: FhirQualification[];
  active?: boolean;
  extension?: JsonObject[];
}

export interface PractitionerRoleResource {
  resourceType: 'PractitionerRole';
  id: string;
  practitioner?: FhirReference;
  organization?: FhirReference;
  code?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
  location?: FhirReference[];
  telecom?: FhirContactPoint[];
  virtualService?: Array<{
    channelType?: FhirCodeableConcept;
    telecom?: FhirContactPoint[];
  }>;
  period?: FhirPeriod;
  active?: boolean;
  identifier?: FhirIdentifier[];
}

export interface OrganizationResource {
  resourceType: 'Organization';
  id: string;
  name: string;
  active?: boolean;
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
  contact?: Array<{
    name?: {
      text?: string;
    };
    telecom?: FhirContactPoint[];
    address?: FhirAddress;
  }>;
  type?: FhirCodeableConcept[];
  identifier?: FhirIdentifier[];
}

export interface EndpointResource {
  resourceType: 'Endpoint';
  id: string;
  status: 'active' | 'suspended' | 'error' | 'off' | 'entered-in-error' | 'test';
  connectionType: {
    system: string;
    code: string;
    display?: string;
  };
  name?: string;
  address: string;
  payload: Array<{
    type: FhirCodeableConcept[];
  }>;
  contact?: Array<{
    telecom?: FhirContactPoint[];
  }>;
  managingOrganization?: FhirReference;
  period?: FhirPeriod;
}

export interface ProvenanceAgent {
  type?: FhirCodeableConcept;
  role?: FhirCodeableConcept[];
  who: FhirReference | { display: string };
}

export interface ProvenanceResource {
  resourceType: 'Provenance';
  id: string;
  recorded: string;
  occurredDateTime?: string;
  target: FhirReference[];
  activity?: FhirCodeableConcept;
  reason?: FhirCodeableConcept[];
  agent: ProvenanceAgent[];
}

export type R6ResourceType =
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Organization'
  | 'Endpoint'
  | 'Provenance';

export type PractitionerR6 = PractitionerResource;
export type PractitionerRoleR6 = PractitionerRoleResource;


