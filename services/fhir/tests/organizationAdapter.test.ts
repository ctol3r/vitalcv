import { describe, expect, it } from 'vitest';
import { buildEndpointFromEhrConfig, buildEndpointFromOrg, orgProfileToOrganization } from '../../fhir/adapter/organizationAdapter';
import { validateResource } from '../../fhir/validator';

const org = {
  orgId: 'org-1',
  name: 'Vital Health',
  contactEmail: 'it@vitalhealth.org',
  contactPhone: '555-555-5555',
  address: {
    line1: '400 Mission St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
  },
  contactName: 'IT Desk',
};

describe('organization adapters', () => {
  it('maps OrgProfile to Organization', () => {
    const resource = orgProfileToOrganization(org);
    const validation = validateResource(resource, 'Organization');
    expect(validation.valid).toBe(true);
    expect(resource.telecom?.[0].value).toBe('it@vitalhealth.org');
  });

  it('creates Endpoint from Org metadata', () => {
    const endpoint = buildEndpointFromOrg(org, {
      baseUrl: 'https://fhir.vitalhealth.org/R6',
    });

    const validation = validateResource(endpoint, 'Endpoint');
    expect(validation.valid).toBe(true);
    expect(endpoint.address).toContain('vitalhealth');
  });

  it('uses EhrConfig helper', () => {
    const endpoint = buildEndpointFromEhrConfig(org, {
      orgId: org.orgId,
      ehrType: 'generic',
      fhirBaseUrl: 'https://ehr.example.org/fhir',
      authType: 'client_credentials',
      clientId: 'client',
      clientSecret: 'secret',
      metadata: {},
      isActive: false,
    });

    expect(endpoint.status).toBe('suspended');
  });
});

import { describe, expect, it } from 'vitest';
import { buildEndpointFromOrg, buildEndpointFromEhrConfig, orgProfileToOrganization } from '../../fhir/adapter/organizationAdapter';
import { validateResource } from '../../fhir/validator';

describe('organization adapters', () => {
  const org = {
    orgId: 'org-123',
    name: 'Vital Health',
    contactEmail: 'it@vitalhealth.org',
    contactPhone: '555-555-5555',
    address: {
      line1: '400 Mission St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
    },
    contactName: 'IT Desk',
  };

  it('maps OrgProfile to Organization resource', () => {
    const resource = orgProfileToOrganization(org);
    expect(resource.telecom?.[0].value).toBe('it@vitalhealth.org');
    expect(resource.address?.[0].state).toBe('CA');

    const validation = validateResource(resource, 'Organization');
    expect(validation.valid).toBe(true);
  });

  it('builds Endpoint from org metadata', () => {
    const endpoint = buildEndpointFromOrg(org, {
      baseUrl: 'https://fhir.vitalhealth.org/R6',
    });

    expect(endpoint.address).toContain('https://fhir.vitalhealth.org');
    expect(endpoint.managingOrganization?.reference).toBe('Organization/org-123');

    const validation = validateResource(endpoint, 'Endpoint');
    expect(validation.valid).toBe(true);
  });

  it('creates endpoint from EHR config helper', () => {
    const endpoint = buildEndpointFromEhrConfig(org, {
      orgId: org.orgId,
      ehrType: 'generic',
      fhirBaseUrl: 'https://ehr.example.com/fhir',
      authType: 'client_credentials',
      clientId: 'client',
      clientSecret: 'secret',
      metadata: {},
      isActive: false,
    });

    expect(endpoint.status).toBe('suspended');
  });
});


