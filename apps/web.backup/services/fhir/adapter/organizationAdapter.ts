import { EndpointResource, FhirAddress, FhirContactPoint, OrganizationResource } from '../types/r6';
import { EhrConfig } from '../../ehr/models/EhrConfig';

export interface OrgProfileAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface OrgProfileForFhir {
  orgId: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  address?: OrgProfileAddress | null;
  contactName?: string;
  identifier?: {
    system: string;
    value: string;
  };
}

function toFhirAddress(address?: OrgProfileAddress | null): FhirAddress[] | undefined {
  if (!address) {
    return undefined;
  }

  const line = [address.line1, address.line2].filter(Boolean) as string[];
  return [{
    line: line.length ? line : undefined,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country ?? 'USA',
  }];
}

function buildTelecom(org: OrgProfileForFhir): FhirContactPoint[] {
  const telecom: FhirContactPoint[] = [
    {
      system: 'email',
      value: org.contactEmail,
      use: 'work',
    },
  ];

  if (org.contactPhone) {
    telecom.push({
      system: 'phone',
      value: org.contactPhone,
      use: 'work',
    });
  }

  return telecom;
}

export function orgProfileToOrganization(org: OrgProfileForFhir): OrganizationResource {
  const telecom = buildTelecom(org);
  const address = toFhirAddress(org.address);

  return {
    resourceType: 'Organization',
    id: org.orgId,
    name: org.name,
    active: true,
    telecom,
    address,
    contact: [{
      name: {
        text: org.contactName ?? `${org.name} Contact`,
      },
      telecom,
      address: address?.[0],
    }],
    identifier: org.identifier ? [{
      system: org.identifier.system,
      value: org.identifier.value,
    }] : undefined,
  };
}

export interface EndpointOptions {
  endpointId?: string;
  baseUrl: string;
  status?: EndpointResource['status'];
  payloadResources?: string[];
}

export function buildEndpointFromOrg(
  org: OrgProfileForFhir,
  options: EndpointOptions
): EndpointResource {
  const payloadResources = options.payloadResources ?? ['Bundle'];
  const payload = [
    {
      type: payloadResources.map(resource => ({
        coding: [{
          system: 'http://hl7.org/fhir/resource-types',
          code: resource,
          display: resource,
        }],
      })),
    },
  ];

  return {
    resourceType: 'Endpoint',
    id: options.endpointId ?? `endpoint-${org.orgId}`,
    status: options.status ?? 'active',
    connectionType: {
      system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type',
      code: 'hl7-fhir-rest',
      display: 'HL7 FHIR REST',
    },
    name: `${org.name} FHIR Endpoint`,
    address: options.baseUrl,
    payload,
    contact: [{
      telecom: buildTelecom(org),
    }],
    managingOrganization: {
      reference: `Organization/${org.orgId}`,
      display: org.name,
    },
  };
}

export function buildEndpointFromEhrConfig(
  org: OrgProfileForFhir,
  config: EhrConfig
): EndpointResource {
  return buildEndpointFromOrg(org, {
    baseUrl: config.fhirBaseUrl,
    status: config.isActive ? 'active' : 'suspended',
    endpointId: `endpoint-${org.orgId}`,
    payloadResources: ['Bundle'],
  });
}


