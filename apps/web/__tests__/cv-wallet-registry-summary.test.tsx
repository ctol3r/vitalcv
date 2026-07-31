import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CVWalletRegistrySummary } from '@/components/wallet/CVWalletRegistrySummary';
import { buildClinicianRecord, type NppesReading } from '@/lib/clinician-record/build';

const address = {
  purpose: 'LOCATION',
  address_type: 'DOM',
  address_1: '100 CARE WAY',
  address_2: '',
  city: 'SAN JOSE',
  state: 'CA',
  postal_code: '951130000',
  country_code: 'US',
  country_name: 'United States',
  telephone_number: '',
  fax_number: '',
};

function reading(): NppesReading {
  return {
    npi: '1234567890',
    enumeration_type: 'NPI-1',
    status: 'A',
    first_name: 'CASEY',
    last_name: 'CLINICIAN',
    middle_name: '',
    credential: 'MD',
    name_prefix: '',
    name_suffix: '',
    organization_name: '',
    display_name: 'CASEY CLINICIAN, MD',
    sex: '',
    sole_proprietor: 'NO',
    primary_taxonomy: 'Internal Medicine',
    primary_taxonomy_code: '207R00000X',
    taxonomies: [
      {
        code: '207R00000X',
        taxonomy_group: '',
        desc: 'Internal Medicine',
        state: 'CA',
        license: 'A12345',
        primary: true,
      },
      {
        code: '207R00000X',
        taxonomy_group: '',
        desc: 'Internal Medicine',
        state: 'NV',
        license: 'NV67890',
        primary: false,
      },
      // Duplicate source row must not produce a duplicate wallet card.
      {
        code: '207R00000X',
        taxonomy_group: '',
        desc: 'Internal Medicine',
        state: 'CA',
        license: 'A12345',
        primary: false,
      },
    ],
    practice_address: address,
    mailing_address: null,
    addresses: [address],
    practice_locations: [],
    identifiers: [],
    endpoints: [],
    other_names: [],
    organizational_subpart: '',
    parent_organization_legal_business_name: '',
    authorized_official: null,
    enumeration_date: '2020-01-01',
    last_updated: '2026-07-01',
    certification_date: '2026-07-01',
    deactivation_date: '',
    deactivation_reason_code: '',
    reactivation_date: '',
    created_epoch: '',
    last_updated_epoch: '',
  };
}

describe('CVWalletRegistrySummary', () => {
  it('shows every distinct state/license pair returned by NPPES', () => {
    const record = buildClinicianRecord(reading(), {
      retrievedAt: '2026-07-30T12:00:00.000Z',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    const html = renderToStaticMarkup(<CVWalletRegistrySummary record={record} />);

    expect(html).toContain('State licenses');
    expect(html).toContain('A12345');
    expect(html).toContain('NV67890');
    expect(html.match(/A12345/g)).toHaveLength(1);
    expect(html).toContain('Reported to CMS');
    expect(html).toContain('Status requires a separate state-board check');
    expect(html).not.toContain('License verified');
    expect(html).not.toContain('Active license');
  });
});
