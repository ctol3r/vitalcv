import type { FhirDirectoryResource } from './pouMatrix.js';

export type ParticipantType = 'QHIN' | 'Participant' | 'SubParticipant';

export interface TrustedParticipant {
  id: string;
  type: ParticipantType;
  name: string;
  qhin?: string;
  endpoint: string;
  npis: string[];
}

export interface DirectoryEntry {
  participantId: string;
  practitioner: any;
  practitionerRole: any;
  organization: any;
  endpoint: any;
}

const trustedParticipants: TrustedParticipant[] = [
  {
    id: 'qh-se',
    type: 'QHIN',
    name: 'Southeast Trusted Exchange',
    endpoint: 'https://se-qhin.example.com/fhir/R6',
    npis: ['1234567890', '1122334455'],
  },
  {
    id: 'org-lakeview',
    type: 'Participant',
    qhin: 'qh-se',
    name: 'Lakeview Health Network',
    endpoint: 'https://lakeview.example.com/fhir/R6',
    npis: ['1234567890'],
  },
  {
    id: 'org-aurora',
    type: 'Participant',
    qhin: 'qh-se',
    name: 'Aurora Valley Clinic',
    endpoint: 'https://aurora.example.com/fhir/R6',
    npis: ['1122334455'],
  },
];

export const directoryEntries: DirectoryEntry[] = [
  {
    participantId: 'org-lakeview',
    practitioner: {
      resourceType: 'Practitioner',
      id: 'pract-001',
      meta: { versionId: '1', lastUpdated: '2025-11-01T10:00:00Z' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      name: [{ family: 'Adams', given: ['Avery'], suffix: ['MD'] }],
      telecom: [{ system: 'phone', value: '555-010-2000' }],
      address: [{ line: ['100 Lakeview Pkwy'], city: 'Nashville', state: 'TN', postalCode: '37209' }],
      qualification: [{ code: { text: 'Cardiology' } }],
      gender: 'female',
      birthDate: '1982-04-03',
      active: true,
    },
    practitionerRole: {
      resourceType: 'PractitionerRole',
      id: 'role-001',
      practitioner: { reference: 'Practitioner/pract-001' },
      organization: { reference: 'Organization/org-001' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      code: [{ text: 'Cardiology' }],
      specialty: [{ text: 'Interventional Cardiology' }],
      telecom: [{ system: 'phone', value: '555-010-2100' }],
      location: [{ display: 'Lakeview Heart Institute' }],
      period: { start: '2019-01-01' },
      endpoint: [{ reference: 'Endpoint/ep-001' }],
    },
    organization: {
      resourceType: 'Organization',
      id: 'org-001',
      name: 'Lakeview Heart Institute',
      telecom: [{ system: 'phone', value: '555-010-2150' }],
      address: [{ line: ['100 Lakeview Pkwy'], city: 'Nashville', state: 'TN', postalCode: '37209' }],
    },
    endpoint: {
      resourceType: 'Endpoint',
      id: 'ep-001',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest' },
      name: 'Lakeview TEFCA Endpoint',
      address: 'https://lakeview.example.com/fhir/R6',
    },
  },
  {
    participantId: 'org-aurora',
    practitioner: {
      resourceType: 'Practitioner',
      id: 'pract-002',
      meta: { versionId: '1', lastUpdated: '2025-11-02T09:30:00Z' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1122334455' }],
      name: [{ family: 'Barton', given: ['Leo'] }],
      telecom: [{ system: 'email', value: 'leo.barton@aurora.example.com' }],
      address: [{ line: ['200 Aurora Way'], city: 'Atlanta', state: 'GA', postalCode: '30303' }],
      qualification: [{ code: { text: 'Family Medicine' } }],
      gender: 'male',
      birthDate: '1978-07-22',
      active: true,
    },
    practitionerRole: {
      resourceType: 'PractitionerRole',
      id: 'role-002',
      practitioner: { reference: 'Practitioner/pract-002' },
      organization: { reference: 'Organization/org-002' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1122334455' }],
      code: [{ text: 'Primary Care' }],
      telecom: [{ system: 'phone', value: '555-010-3300' }],
      location: [{ display: 'Aurora Valley Clinic' }],
      period: { start: '2015-05-01' },
      endpoint: [{ reference: 'Endpoint/ep-002' }],
    },
    organization: {
      resourceType: 'Organization',
      id: 'org-002',
      name: 'Aurora Valley Clinic',
      telecom: [{ system: 'phone', value: '555-010-3310' }],
      address: [{ line: ['200 Aurora Way'], city: 'Atlanta', state: 'GA', postalCode: '30303' }],
    },
    endpoint: {
      resourceType: 'Endpoint',
      id: 'ep-002',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest' },
      name: 'Aurora TEFCA Endpoint',
      address: 'https://aurora.example.com/fhir/R6',
    },
  },
];

export function getTrustedParticipants(): TrustedParticipant[] {
  return trustedParticipants;
}

export function isTrustedEndpoint(endpointUrl: string): boolean {
  return trustedParticipants.some((participant) => participant.endpoint === endpointUrl);
}

export function findDirectoryEntriesByIdentifier(identifier: string): DirectoryEntry[] {
  return directoryEntries.filter((entry) =>
    entry.practitioner.identifier?.some((id: any) => id.value === identifier)
  );
}

export function findDirectoryEntriesByNamePrefix(namePrefix: string): DirectoryEntry[] {
  const prefix = namePrefix.toLowerCase();
  return directoryEntries.filter((entry) => {
    return entry.practitioner.name?.some((name: any) => {
      const fullName = `${name.given?.join(' ') || ''} ${name.family || ''}`.trim().toLowerCase();
      return fullName.startsWith(prefix);
    });
  });
}

export function buildPractitionerPayload(entry: DirectoryEntry): any {
  return {
    ...entry.practitioner,
    contained: [entry.practitionerRole, entry.organization, entry.endpoint],
  };
}

export function searchTrustedDirectory(params: { identifier?: string; name?: string }): any[] {
  let matches: DirectoryEntry[] = [];

  if (params.identifier) {
    matches = findDirectoryEntriesByIdentifier(params.identifier);
  } else if (params.name) {
    matches = findDirectoryEntriesByNamePrefix(params.name);
  }

  return matches.map(buildPractitionerPayload);
}

export function listDirectoryResources(entry: DirectoryEntry): Record<FhirDirectoryResource, any> {
  return {
    Practitioner: entry.practitioner,
    PractitionerRole: entry.practitionerRole,
    Organization: entry.organization,
    Endpoint: entry.endpoint,
  };
}
import type { FhirDirectoryResource } from './pouMatrix.js';

export type ParticipantType = 'QHIN' | 'Participant' | 'SubParticipant';

export interface TrustedParticipant {
  id: string;
  type: ParticipantType;
  name: string;
  qhin?: string;
  endpoint: string;
  npis: string[];
}

export interface DirectoryEntry {
  participantId: string;
  practitioner: any;
  practitionerRole: any;
  organization: any;
  endpoint: any;
}

const trustedParticipants: TrustedParticipant[] = [
  {
    id: 'qh-se',
    type: 'QHIN',
    name: 'Southeast Trusted Exchange',
    endpoint: 'https://se-qhin.example.com/fhir/R6',
    npis: ['1234567890', '1122334455'],
  },
  {
    id: 'org-lakeview',
    type: 'Participant',
    qhin: 'qh-se',
    name: 'Lakeview Health Network',
    endpoint: 'https://lakeview.example.com/fhir/R6',
    npis: ['1234567890'],
  },
  {
    id: 'org-aurora',
    type: 'Participant',
    qhin: 'qh-se',
    name: 'Aurora Valley Clinic',
    endpoint: 'https://aurora.example.com/fhir/R6',
    npis: ['1122334455'],
  },
];

const directoryEntries: DirectoryEntry[] = [
  {
    participantId: 'org-lakeview',
    practitioner: {
      resourceType: 'Practitioner',
      id: 'pract-001',
      meta: { versionId: '1', lastUpdated: '2025-11-01T10:00:00Z' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      name: [{ family: 'Adams', given: ['Avery'], suffix: ['MD'] }],
      telecom: [{ system: 'phone', value: '555-010-2000' }],
      address: [{ line: ['100 Lakeview Pkwy'], city: 'Nashville', state: 'TN', postalCode: '37209' }],
      qualification: [{ code: { text: 'Cardiology' } }],
      gender: 'female',
      birthDate: '1982-04-03',
      active: true,
    },
    practitionerRole: {
      resourceType: 'PractitionerRole',
      id: 'role-001',
      practitioner: { reference: 'Practitioner/pract-001' },
      organization: { reference: 'Organization/org-001' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      code: [{ text: 'Cardiology' }],
      specialty: [{ text: 'Interventional Cardiology' }],
      telecom: [{ system: 'phone', value: '555-010-2100' }],
      location: [{ display: 'Lakeview Heart Institute' }],
      period: { start: '2019-01-01' },
      endpoint: [{ reference: 'Endpoint/ep-001' }],
    },
    organization: {
      resourceType: 'Organization',
      id: 'org-001',
      name: 'Lakeview Heart Institute',
      telecom: [{ system: 'phone', value: '555-010-2150' }],
      address: [{ line: ['100 Lakeview Pkwy'], city: 'Nashville', state: 'TN', postalCode: '37209' }],
    },
    endpoint: {
      resourceType: 'Endpoint',
      id: 'ep-001',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest' },
      name: 'Lakeview TEFCA Endpoint',
      address: 'https://lakeview.example.com/fhir/R6',
    },
  },
  {
    participantId: 'org-aurora',
    practitioner: {
      resourceType: 'Practitioner',
      id: 'pract-002',
      meta: { versionId: '1', lastUpdated: '2025-11-02T09:30:00Z' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1122334455' }],
      name: [{ family: 'Barton', given: ['Leo'] }],
      telecom: [{ system: 'email', value: 'leo.barton@aurora.example.com' }],
      address: [{ line: ['200 Aurora Way'], city: 'Atlanta', state: 'GA', postalCode: '30303' }],
      qualification: [{ code: { text: 'Family Medicine' } }],
      gender: 'male',
      birthDate: '1978-07-22',
      active: true,
    },
    practitionerRole: {
      resourceType: 'PractitionerRole',
      id: 'role-002',
      practitioner: { reference: 'Practitioner/pract-002' },
      organization: { reference: 'Organization/org-002' },
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1122334455' }],
      code: [{ text: 'Primary Care' }],
      telecom: [{ system: 'phone', value: '555-010-3300' }],
      location: [{ display: 'Aurora Valley Clinic' }],
      period: { start: '2015-05-01' },
      endpoint: [{ reference: 'Endpoint/ep-002' }],
    },
    organization: {
      resourceType: 'Organization',
      id: 'org-002',
      name: 'Aurora Valley Clinic',
      telecom: [{ system: 'phone', value: '555-010-3310' }],
      address: [{ line: ['200 Aurora Way'], city: 'Atlanta', state: 'GA', postalCode: '30303' }],
    },
    endpoint: {
      resourceType: 'Endpoint',
      id: 'ep-002',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest' },
      name: 'Aurora TEFCA Endpoint',
      address: 'https://aurora.example.com/fhir/R6',
    },
  },
];

export function getTrustedParticipants(): TrustedParticipant[] {
  return trustedParticipants;
}

export function isTrustedEndpoint(endpointUrl: string): boolean {\n  return trustedParticipants.some((participant) => participant.endpoint === endpointUrl);\n}\n\nexport function findDirectoryEntriesByIdentifier(identifier: string): DirectoryEntry[] {\n  return directoryEntries.filter((entry) =>\n    entry.practitioner.identifier?.some((id: any) => id.value === identifier)\n  );\n}\n\nexport function findDirectoryEntriesByNamePrefix(namePrefix: string): DirectoryEntry[] {\n  const prefix = namePrefix.toLowerCase();\n  return directoryEntries.filter((entry) => {\n    return entry.practitioner.name?.some((name: any) => {\n      const fullName = `${name.given?.join(' ') || ''} ${name.family || ''}`.trim().toLowerCase();\n      return fullName.startsWith(prefix);\n    });\n  });\n}\n\nexport function buildPractitionerPayload(entry: DirectoryEntry): any {\n  return {\n    ...entry.practitioner,\n    contained: [entry.practitionerRole, entry.organization, entry.endpoint],\n  };\n}\n\nexport function searchTrustedDirectory(params: { identifier?: string; name?: string }): any[] {\n  let matches: DirectoryEntry[] = [];\n\n  if (params.identifier) {\n    matches = findDirectoryEntriesByIdentifier(params.identifier);\n  } else if (params.name) {\n    matches = findDirectoryEntriesByNamePrefix(params.name);\n  }\n\n  return matches.map(buildPractitionerPayload);\n}\n\nexport function listDirectoryResources(entry: DirectoryEntry): Record<FhirDirectoryResource, any> {\n  return {\n    Practitioner: entry.practitioner,\n    PractitionerRole: entry.practitionerRole,\n    Organization: entry.organization,\n    Endpoint: entry.endpoint,\n  };\n}\n\Nexport { directoryEntries };\n*** End Patch
/**
 * B166B-TEFCA-004: Endpoint directory for TEFCA (trusted participants list)
 *
 * Provides a mock directory of TEFCA participants used by the FHIR facade.
 */

export interface FhirIdentifier {
  system: string;
  value: string;
}

export interface FhirHumanName {
  text: string;
  family?: string;
  given?: string[];
}

export interface FhirTelecom {
  system: string;
  value: string;
  use?: string;
}

export interface FhirAddress {
  line: string[];
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  identifier: FhirIdentifier[];
  name: FhirHumanName[];
  telecom?: FhirTelecom[];
  address?: FhirAddress[];
  qualification?: Array<{
    code: { text: string };
    issuer?: FhirReference;
  }>;
}

export interface FhirPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  practitioner: FhirReference;
  organization: FhirReference;
  specialty?: Array<{ text: string }>;
  code?: Array<{ text: string }>;
  telecom?: FhirTelecom[];
  location?: Array<{ display: string }>;
  endpoint?: FhirReference[];
}

export interface FhirOrganization {
  resourceType: 'Organization';
  id: string;
  identifier?: FhirIdentifier[];
  name: string;
  telecom?: FhirTelecom[];
  address?: FhirAddress[];
  endpoint?: FhirReference[];
}

export interface FhirEndpoint {
  resourceType: 'Endpoint';
  id: string;
  status: string;
  connectionType: { code: string; display?: string };
  payloadType: Array<{ text: string }>;
  address: string;
  managingOrganization?: FhirReference;
}

export interface TrustedDirectory {
  practitioners: FhirPractitioner[];
  practitionerRoles: FhirPractitionerRole[];
  organizations: FhirOrganization[];
  endpoints: FhirEndpoint[];
}

export const trustedParticipants: TrustedDirectory = {
  practitioners: [
    {
      resourceType: 'Practitioner',
      id: 'practitioner-1',
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      name: [{ text: 'Dr. Alice Carter', family: 'Carter', given: ['Alice'] }],
      telecom: [{ system: 'phone', value: '555-123-0001', use: 'work' }],
      address: [
        { line: ['100 Sunrise Blvd'], city: 'Austin', state: 'TX', postalCode: '73301', country: 'USA' },
      ],
      qualification: [
        { code: { text: 'MD' }, issuer: { reference: 'Organization/org-1', display: 'Sunrise Credentialing' } },
      ],
    },
    {
      resourceType: 'Practitioner',
      id: 'practitioner-2',
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '9876543210' }],
      name: [{ text: 'Dr. Brian Singh', family: 'Singh', given: ['Brian'] }],
      telecom: [{ system: 'email', value: 'brian.singh@example.org', use: 'work' }],
      qualification: [{ code: { text: 'DO' } }],
    },
  ],
  practitionerRoles: [
    {
      resourceType: 'PractitionerRole',
      id: 'role-1',
      practitioner: { reference: 'Practitioner/practitioner-1', display: 'Dr. Alice Carter' },
      organization: { reference: 'Organization/org-1', display: 'Sunrise Medical Center' },
      specialty: [{ text: 'Family Medicine' }],
      telecom: [{ system: 'phone', value: '555-123-1000' }],
      endpoint: [{ reference: 'Endpoint/endpoint-1' }],
      location: [{ display: 'Sunrise Medical Center - Austin' }],
    },
    {
      resourceType: 'PractitionerRole',
      id: 'role-2',
      practitioner: { reference: 'Practitioner/practitioner-2', display: 'Dr. Brian Singh' },
      organization: { reference: 'Organization/org-2', display: 'Northwind Cardiology' },
      specialty: [{ text: 'Cardiology' }],
      telecom: [{ system: 'phone', value: '512-222-9000' }],
      endpoint: [{ reference: 'Endpoint/endpoint-2' }],
      location: [{ display: 'Northwind Cardiology - Downtown' }],
    },
  ],
  organizations: [
    {
      resourceType: 'Organization',
      id: 'org-1',
      identifier: [{ system: 'urn:oid:2.16.840.1.113883.4.2', value: 'ORG1001' }],
      name: 'Sunrise Medical Center',
      telecom: [{ system: 'phone', value: '512-000-1000' }],
      address: [{ line: ['100 Sunrise Blvd'], city: 'Austin', state: 'TX', postalCode: '73301' }],
      endpoint: [{ reference: 'Endpoint/endpoint-1' }],
    },
    {
      resourceType: 'Organization',
      id: 'org-2',
      identifier: [{ system: 'urn:oid:2.16.840.1.113883.4.2', value: 'ORG2002' }],
      name: 'Northwind Cardiology',
      telecom: [{ system: 'phone', value: '512-333-2000' }],
      address: [{ line: ['50 Northwind Way'], city: 'Austin', state: 'TX', postalCode: '73344' }],
      endpoint: [{ reference: 'Endpoint/endpoint-2' }],
    },
  ],
  endpoints: [
    {
      resourceType: 'Endpoint',
      id: 'endpoint-1',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest', display: 'FHIR R6 REST' },
      payloadType: [{ text: 'application/fhir+json' }],
      address: 'https://sunrise.example.org/fhir',
      managingOrganization: { reference: 'Organization/org-1', display: 'Sunrise Medical Center' },
    },
    {
      resourceType: 'Endpoint',
      id: 'endpoint-2',
      status: 'active',
      connectionType: { code: 'hl7-fhir-rest', display: 'FHIR R6 REST' },
      payloadType: [{ text: 'application/fhir+json' }],
      address: 'https://northwind.example.org/fhir',
      managingOrganization: { reference: 'Organization/org-2', display: 'Northwind Cardiology' },
    },
  ],
};

export function findPractitionersByIdentifier(identifier: string) {
  return trustedParticipants.practitioners.filter(practitioner =>
    practitioner.identifier.some(id => id.value === identifier)
  );
}

export function searchPractitionersByName(prefix: string) {
  const normalized = prefix.toLowerCase();
  return trustedParticipants.practitioners.filter(practitioner =>
    practitioner.name.some(name => name.text.toLowerCase().startsWith(normalized))
  );
}

export function rolesForPractitioner(practitionerId: string) {
  return trustedParticipants.practitionerRoles.filter(role =>
    role.practitioner.reference === `Practitioner/${practitionerId}`
  );
}

export function findOrganizationByReference(reference?: FhirReference): FhirOrganization | undefined {
  if (!reference?.reference) {
    return undefined;
  }
  const id = reference.reference.split('/')[1];
  return trustedParticipants.organizations.find(org => org.id === id);
}

export function findEndpointByReference(reference?: FhirReference): FhirEndpoint | undefined {
  if (!reference?.reference) {
    return undefined;
  }
  const id = reference.reference.split('/')[1];
  return trustedParticipants.endpoints.find(endpoint => endpoint.id === id);
}


