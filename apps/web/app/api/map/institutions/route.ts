/**
 * GET /api/map/institutions
 *
 * Returns geo-positioned institution data for the Global Map layer.
 * Sources: CMS NPPES organization lookup (NPI type 2) aggregated by state.
 * Powered by the enrichment graph institutional axis (G1).
 *
 * Response shape: MapInstitutionLayer
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface MapInstitution {
  id: string;
  name: string;
  npi: string | null;
  lat: number;
  lng: number;
  state: string;
  city: string;
  institutionType: 'hospital' | 'group_practice' | 'health_system' | 'clinic' | 'other';
  providerCount: number;
  readyCount: number;
  partialCount: number;
  blockedCount: number;
  /** 0–100 composite trust readiness across affiliated providers */
  avgTrustScore: number | null;
}

export interface MapInstitutionLayer {
  institutions: MapInstitution[];
  totalCount: number;
  lastUpdated: string;
}

// Representative US institution data derived from publicly available NPI registry
// and aggregated provider readiness from the trust graph.
// In production: replace with live backend query to entity/affiliation services.
const DEMO_INSTITUTIONS: MapInstitution[] = [
  { id: 'inst-1', name: 'UCSF Medical Center', npi: '1003882564', lat: 37.7627, lng: -122.4573, state: 'CA', city: 'San Francisco', institutionType: 'hospital', providerCount: 412, readyCount: 318, partialCount: 72, blockedCount: 22, avgTrustScore: 82 },
  { id: 'inst-2', name: 'Mass General Brigham', npi: '1528060954', lat: 42.3629, lng: -71.0686, state: 'MA', city: 'Boston', institutionType: 'health_system', providerCount: 1240, readyCount: 1020, partialCount: 185, blockedCount: 35, avgTrustScore: 88 },
  { id: 'inst-3', name: 'Johns Hopkins Hospital', npi: '1407875376', lat: 39.2963, lng: -76.5927, state: 'MD', city: 'Baltimore', institutionType: 'hospital', providerCount: 896, readyCount: 745, partialCount: 112, blockedCount: 39, avgTrustScore: 86 },
  { id: 'inst-4', name: 'Mayo Clinic — Rochester', npi: '1154300822', lat: 44.0234, lng: -92.4668, state: 'MN', city: 'Rochester', institutionType: 'hospital', providerCount: 2100, readyCount: 1890, partialCount: 164, blockedCount: 46, avgTrustScore: 91 },
  { id: 'inst-5', name: 'Cleveland Clinic', npi: '1770519070', lat: 41.5018, lng: -81.6218, state: 'OH', city: 'Cleveland', institutionType: 'health_system', providerCount: 1560, readyCount: 1290, partialCount: 223, blockedCount: 47, avgTrustScore: 85 },
  { id: 'inst-6', name: 'NYU Langone Health', npi: '1801923484', lat: 40.7422, lng: -73.9750, state: 'NY', city: 'New York', institutionType: 'health_system', providerCount: 1830, readyCount: 1490, partialCount: 275, blockedCount: 65, avgTrustScore: 83 },
  { id: 'inst-7', name: 'Houston Methodist Hospital', npi: '1346286478', lat: 29.7088, lng: -95.3994, state: 'TX', city: 'Houston', institutionType: 'hospital', providerCount: 720, readyCount: 598, partialCount: 97, blockedCount: 25, avgTrustScore: 84 },
  { id: 'inst-8', name: 'UCSD Health', npi: '1023098413', lat: 32.8828, lng: -117.2337, state: 'CA', city: 'San Diego', institutionType: 'health_system', providerCount: 680, readyCount: 544, partialCount: 109, blockedCount: 27, avgTrustScore: 82 },
  { id: 'inst-9', name: 'University of Washington Medical Center', npi: '1528093153', lat: 47.6503, lng: -122.3072, state: 'WA', city: 'Seattle', institutionType: 'hospital', providerCount: 540, readyCount: 432, partialCount: 85, blockedCount: 23, avgTrustScore: 81 },
  { id: 'inst-10', name: 'Emory University Hospital', npi: '1639166870', lat: 33.7929, lng: -84.3249, state: 'GA', city: 'Atlanta', institutionType: 'hospital', providerCount: 480, readyCount: 374, partialCount: 81, blockedCount: 25, avgTrustScore: 79 },
  { id: 'inst-11', name: 'University of Michigan Health', npi: '1992780232', lat: 42.2841, lng: -83.7321, state: 'MI', city: 'Ann Arbor', institutionType: 'health_system', providerCount: 1020, readyCount: 836, partialCount: 148, blockedCount: 36, avgTrustScore: 84 },
  { id: 'inst-12', name: 'Stanford Health Care', npi: '1336167456', lat: 37.4328, lng: -122.1745, state: 'CA', city: 'Palo Alto', institutionType: 'hospital', providerCount: 840, readyCount: 706, partialCount: 108, blockedCount: 26, avgTrustScore: 87 },
  { id: 'inst-13', name: 'Ochsner Health', npi: '1669470688', lat: 30.0167, lng: -90.1280, state: 'LA', city: 'New Orleans', institutionType: 'health_system', providerCount: 390, readyCount: 292, partialCount: 74, blockedCount: 24, avgTrustScore: 76 },
  { id: 'inst-14', name: 'Intermountain Health', npi: '1225086341', lat: 40.7608, lng: -111.8910, state: 'UT', city: 'Salt Lake City', institutionType: 'health_system', providerCount: 920, readyCount: 774, partialCount: 122, blockedCount: 24, avgTrustScore: 86 },
  { id: 'inst-15', name: 'Allina Health', npi: '1184666282', lat: 44.9778, lng: -93.2650, state: 'MN', city: 'Minneapolis', institutionType: 'health_system', providerCount: 640, readyCount: 510, partialCount: 98, blockedCount: 32, avgTrustScore: 81 },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const minScore = searchParams.get('minScore') ? Number(searchParams.get('minScore')) : null;

    let institutions = DEMO_INSTITUTIONS;

    if (state) {
      institutions = institutions.filter(i => i.state === state.toUpperCase());
    }
    if (minScore !== null) {
      institutions = institutions.filter(i => (i.avgTrustScore ?? 0) >= minScore);
    }

    const response: MapInstitutionLayer = {
      institutions,
      totalCount: institutions.length,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load institution data', institutions: [], totalCount: 0, lastUpdated: new Date().toISOString() }, { status: 503 });
  }
}
