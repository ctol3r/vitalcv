import { NextRequest, NextResponse } from 'next/server';

/**
 * NPPES Lookup API Route
 * Proxies requests to NPPES registry and caches responses
 */

interface NpiRecord {
  npi: string;
  type: 1 | 2;
  name: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  taxonomy?: string | null;
  taxonomyDescription?: string;
  taxonomyCode?: string;
  addresses: Array<{
    addressType: 'LOCATION' | 'MAILING';
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    telephoneNumber?: string;
  }>;
  lastUpdated?: string;
  isOrganization: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const npi = searchParams.get('npi');

  if (!npi || !/^\d{10}$/.test(npi)) {
    return NextResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
  }

  try {
    // Try cache first (localStorage-style for SSR)
    const cacheKey = `npi:${npi}`;
    const cachedData = await fetch(`http://localhost:4000/api/cache/get?key=${cacheKey}`);

    if (cachedData.ok) {
      const cached = await cachedData.json();
      if (cached.value) {
        return NextResponse.json(JSON.parse(cached.value));
      }
    }

    // Fetch from NPPES
    const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const response = await fetch(nppesUrl);

    if (!response.ok) {
      throw new Error('NPPES API request failed');
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: 'NPI not found' }, { status: 404 });
    }

    const result = data.results[0];
    const basic = result.basic;
    const enumType = result.enumeration_type;

    // Transform to our format
    const record: NpiRecord = {
      npi: result.number,
      type: enumType === 'NPI-1' ? 1 : 2,
      isOrganization: enumType === 'NPI-2',
      firstName: basic.first_name,
      lastName: basic.last_name,
      organizationName: basic.organization_name,
      name: basic.organization_name || `${basic.first_name} ${basic.last_name}`,
      taxonomy: result.taxonomies?.[0]?.primary ? result.taxonomies[0].desc : null,
      taxonomyDescription: result.taxonomies?.[0]?.desc || 'N/A',
      taxonomyCode: result.taxonomies?.[0]?.code || 'N/A',
      addresses: result.addresses.map((addr: any) => ({
        addressType: addr.address_type,
        address1: addr.address_1,
        address2: addr.address_2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postal_code,
        telephoneNumber: addr.telephone_number,
      })),
      lastUpdated: basic.last_updated,
    };

    // Cache the result
    await fetch('http://localhost:4000/api/cache/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: cacheKey, value: JSON.stringify(record), ttl: 86400 }),
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('[NPI Lookup Error]', error);
    return NextResponse.json({ error: 'Failed to lookup NPI' }, { status: 500 });
  }
}
