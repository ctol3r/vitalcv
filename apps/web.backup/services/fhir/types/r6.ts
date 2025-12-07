/**
 * R6 FHIR core types shared by adapters and validators.
 */

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
  extension?: Record<string, unknown>[];
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

export interface ScheduleResource {
  resourceType: 'Schedule';
  id: string;
  actor: FhirReference[];
  active?: boolean;
  serviceCategory?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
  planningHorizon?: FhirPeriod;
  comment?: string;
  extension?: Record<string, unknown>[];
}

export type SlotStatus =
  | 'busy'
  | 'free'
  | 'busy-unavailable'
  | 'busy-tentative'
  | 'entered-in-error';

export interface SlotResource {
  resourceType: 'Slot';
  id: string;
  schedule: FhirReference;
  status: SlotStatus;
  start: string;
  end: string;
  serviceCategory?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
  actor?: FhirReference[];
  comment?: string;
  extension?: Record<string, unknown>[];
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

export interface VerificationResultResource {
  resourceType: 'VerificationResult';
  id: string;
  status:
    | 'attested'
    | 'validated'
    | 'in-process'
    | 'req-revalid'
    | 'revoked'
    | 'failed'
    | 'entered-in-error';
  date?: string;
  validationType?: FhirCodeableConcept;
  target?: FhirReference[];
  need?: FhirCodeableConcept;
  primarySource?: Array<{
    who?: FhirReference;
    type?: FhirCodeableConcept[];
    validationStatus?: FhirCodeableConcept;
    validationDate?: string;
  }>;
  attestation?: {
    who?: FhirReference;
    onBehalfOf?: FhirReference;
    date?: string;
    proxySignature?: string;
  };
}

export type R6ResourceType =
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Organization'
  | 'Endpoint'
  | 'Schedule'
  | 'Slot'
  | 'Provenance'
  | 'VerificationResult';


