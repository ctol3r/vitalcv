/**
 * GET /api/map/network
 *
 * Returns the geographic trust network graph for the Global Map layer.
 * Nodes: institutions, federation issuers, verification registries.
 * Edges: trust propagation pathways (e.g., NPPES → FSMB → hospital system).
 *
 * Non-decision-grade enrichment — shows network topology and coverage,
 * not individual clinician readiness.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type NetworkNodeType =
  | 'institution'
  | 'verification_registry'
  | 'government_source'
  | 'federation_issuer'
  | 'staffing_network';

export interface MapNetworkNode {
  id: string;
  label: string;
  nodeType: NetworkNodeType;
  lat: number;
  lng: number;
  state: string;
  /** 0–100 trust coverage of this node in the VitalCV graph */
  coverageScore: number;
  providerCount: number;
  isLaunchSpine: boolean;
}

export interface MapNetworkEdge {
  sourceId: string;
  targetId: string;
  edgeType: 'verification_flow' | 'federation_link' | 'data_provider';
  strength: number;
}

export interface MapNetworkLayer {
  nodes: MapNetworkNode[];
  edges: MapNetworkEdge[];
  lastUpdated: string;
}

const NETWORK_NODES: MapNetworkNode[] = [
  // Government / launch spine
  { id: 'nppes', label: 'NPPES (CMS)', nodeType: 'government_source', lat: 38.8951, lng: -77.0364, state: 'DC', coverageScore: 100, providerCount: 7200000, isLaunchSpine: true },
  { id: 'oig-leie', label: 'OIG LEIE', nodeType: 'government_source', lat: 38.9072, lng: -77.0369, state: 'DC', coverageScore: 100, providerCount: 7200000, isLaunchSpine: true },
  { id: 'pecos', label: 'PECOS (CMS)', nodeType: 'government_source', lat: 39.0421, lng: -77.1190, state: 'MD', coverageScore: 98, providerCount: 1800000, isLaunchSpine: true },
  // Staged sources
  { id: 'nursys', label: 'Nursys (NCSBN)', nodeType: 'verification_registry', lat: 41.8827, lng: -87.6233, state: 'IL', coverageScore: 72, providerCount: 4200000, isLaunchSpine: false },
  { id: 'fsmb', label: 'FSMB', nodeType: 'verification_registry', lat: 32.8098, lng: -96.8039, state: 'TX', coverageScore: 65, providerCount: 1100000, isLaunchSpine: false },
  // Regional health systems (institutions)
  { id: 'mayo', label: 'Mayo Clinic System', nodeType: 'institution', lat: 44.0234, lng: -92.4668, state: 'MN', coverageScore: 91, providerCount: 2100, isLaunchSpine: false },
  { id: 'mgb', label: 'Mass General Brigham', nodeType: 'institution', lat: 42.3629, lng: -71.0686, state: 'MA', coverageScore: 88, providerCount: 1240, isLaunchSpine: false },
  { id: 'jhu', label: 'Johns Hopkins Medicine', nodeType: 'institution', lat: 39.2963, lng: -76.5927, state: 'MD', coverageScore: 86, providerCount: 896, isLaunchSpine: false },
  { id: 'stanford', label: 'Stanford Health Care', nodeType: 'institution', lat: 37.4328, lng: -122.1745, state: 'CA', coverageScore: 87, providerCount: 840, isLaunchSpine: false },
  { id: 'intermountain', label: 'Intermountain Health', nodeType: 'institution', lat: 40.7608, lng: -111.8910, state: 'UT', coverageScore: 86, providerCount: 920, isLaunchSpine: false },
  // Staffing networks
  { id: 'amn', label: 'AMN Healthcare (proxy)', nodeType: 'staffing_network', lat: 32.7157, lng: -117.1611, state: 'CA', coverageScore: 58, providerCount: 42000, isLaunchSpine: false },
  { id: 'cross-country', label: 'Cross Country Healthcare (proxy)', nodeType: 'staffing_network', lat: 26.1224, lng: -80.1373, state: 'FL', coverageScore: 52, providerCount: 36000, isLaunchSpine: false },
];

const NETWORK_EDGES: MapNetworkEdge[] = [
  { sourceId: 'nppes', targetId: 'mayo', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'nppes', targetId: 'mgb', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'nppes', targetId: 'jhu', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'nppes', targetId: 'stanford', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'nppes', targetId: 'intermountain', edgeType: 'verification_flow', strength: 0.95 },
  { sourceId: 'oig-leie', targetId: 'nppes', edgeType: 'federation_link', strength: 0.90 },
  { sourceId: 'pecos', targetId: 'nppes', edgeType: 'federation_link', strength: 0.90 },
  { sourceId: 'nursys', targetId: 'nppes', edgeType: 'data_provider', strength: 0.70 },
  { sourceId: 'fsmb', targetId: 'nppes', edgeType: 'data_provider', strength: 0.65 },
  { sourceId: 'nppes', targetId: 'amn', edgeType: 'verification_flow', strength: 0.58 },
  { sourceId: 'nppes', targetId: 'cross-country', edgeType: 'verification_flow', strength: 0.52 },
];

export async function GET() {
  try {
    const response: MapNetworkLayer = {
      nodes: NETWORK_NODES,
      edges: NETWORK_EDGES,
      lastUpdated: new Date().toISOString(),
    };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    return NextResponse.json({ nodes: [], edges: [], lastUpdated: new Date().toISOString() }, { status: 503 });
  }
}
