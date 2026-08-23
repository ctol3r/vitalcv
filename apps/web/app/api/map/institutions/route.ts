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

// No curated institution set is served here.
//
// Until 2026-08-16 this constant held fifteen real, named US health systems —
// UCSF, Mass General Brigham, Johns Hopkins, Mayo, Cleveland Clinic, Ochsner,
// Intermountain and others, three of them carrying check-digit-VALID
// organisation NPIs — each with an invented providerCount, readyCount,
// blockedCount and avgTrustScore. It was served publicly, unauthenticated,
// from this route whenever the backend graph was unreachable.
//
// `dataSource: 'demo'` labelled the payload but not the claim: the numbers
// were assertions about named real institutions that no source produced. That
// is the seeded-real-NPI incident applied to organisations, and the truth
// contract answers it the same way — an unavailable source is not a licence
// to invent a value.
//
// If the live graph cannot answer, this route now returns nothing and says so.
// Do not reintroduce a fallback that names an institution VitalCV cannot
// measure.

function getBackendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  );
}

/** Attempt to pull live institution affiliation data from the backend graph API. */
async function fetchLiveInstitutions(): Promise<MapInstitution[] | null> {
  const base = getBackendBase();
  if (!base) return null;
  try {
    const resp = await fetch(`${base}/api/network/global`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { nodes?: Array<Record<string, unknown>> };
    const nodes = data.nodes ?? [];
    // Map backend graph nodes that look like institutions to MapInstitution shape
    const institutions: MapInstitution[] = nodes
      .filter(n => n.type === 'institution' || n.type === 'health_system')
      .map((n, idx) => ({
        id: String(n.id ?? `live-${idx}`),
        name: String(n.label ?? n.name ?? 'Unknown Institution'),
        npi: typeof n.npi === 'string' ? n.npi : null,
        lat: typeof n.lat === 'number' ? n.lat : 0,
        lng: typeof n.lng === 'number' ? n.lng : 0,
        state: String(n.state ?? 'XX'),
        city: String(n.city ?? ''),
        institutionType: 'hospital' as const,
        providerCount: typeof n.providerCount === 'number' ? n.providerCount : 0,
        readyCount: typeof n.readyCount === 'number' ? n.readyCount : 0,
        partialCount: typeof n.partialCount === 'number' ? n.partialCount : 0,
        blockedCount: typeof n.blockedCount === 'number' ? n.blockedCount : 0,
        avgTrustScore: typeof n.trustScore === 'number' ? n.trustScore : null,
      }))
      .filter(i => i.lat !== 0 && i.lng !== 0);
    return institutions.length > 0 ? institutions : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const minScore = searchParams.get('minScore') ? Number(searchParams.get('minScore')) : null;

    // Live graph, or nothing. There is no curated fallback.
    const liveData = await fetchLiveInstitutions();
    let institutions = liveData ?? [];
    const isLive = liveData !== null;

    if (state) {
      institutions = institutions.filter(i => i.state === state.toUpperCase());
    }
    if (minScore !== null) {
      institutions = institutions.filter(i => (i.avgTrustScore ?? 0) >= minScore);
    }

    const response: MapInstitutionLayer & { dataSource: string } = {
      institutions,
      totalCount: institutions.length,
      lastUpdated: new Date().toISOString(),
      dataSource: isLive ? 'live_graph' : 'unavailable',
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': isLive ? 's-maxage=60, stale-while-revalidate=30' : 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load institution data', institutions: [], totalCount: 0, lastUpdated: new Date().toISOString(), dataSource: 'error' }, { status: 503 });
  }
}
