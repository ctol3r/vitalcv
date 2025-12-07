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
