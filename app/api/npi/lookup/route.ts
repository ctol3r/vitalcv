/**
 * NPI Lookup API - Fetches public NPI data from NPPES registry
 */

import { NextRequest, NextResponse } from 'next/server';

const NPPES_API_URL = 'https://npiregistry.cms.hhs.gov/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const npi = searchParams.get('npi');

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json(
        { error: 'Invalid NPI format. Must be 10 digits.' },
        { status: 400 },
      );
    }

    // Fetch from NPPES API
    const response = await fetch(`${NPPES_API_URL}/?number=${npi}&version=2.1`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from NPPES registry');
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: 'NPI not found in registry' }, { status: 404 });
    }

    const result = data.results[0];
    const isOrganization = result.enumeration_type === 'NPI-2';

    // Transform NPPES data to our format
    const npiRecord = {
      npi: result.number,
      type: isOrganization ? 2 : 1,
      name: isOrganization
        ? result.basic.organization_name
        : `${result.basic.first_name} ${result.basic.last_name}`,
      firstName: result.basic.first_name,
      lastName: result.basic.last_name,
      organizationName: result.basic.organization_name,
      taxonomyCode: result.taxonomies?.[0]?.code || 'N/A',
      taxonomyDescription: result.taxonomies?.[0]?.desc || 'N/A',
      isOrganization,
      addresses:
        result.addresses?.map((addr: any) => ({
          addressType: addr.address_purpose,
          address1: addr.address_1,
          address2: addr.address_2,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postal_code,
          countryCode: addr.country_code,
          telephoneNumber: addr.telephone_number,
          faxNumber: addr.fax_number,
        })) || [],
      lastUpdated: result.basic.last_updated,
    };

    return NextResponse.json(npiRecord);
  } catch (error) {
    console.error('NPI lookup error:', error);
    return NextResponse.json({ error: 'Failed to lookup NPI' }, { status: 500 });
  }
}
