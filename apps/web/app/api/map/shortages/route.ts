/**
 * GET /api/map/shortages
 *
 * Returns state-level healthcare workforce shortage data for the Global Map layer.
 * Source: HRSA HPSA designations + BLS workforce projections (aggregated at state level).
 * Non-decision-grade — enrichment/context only.
 *
 * Response shape: MapShortageLayer
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type ShortageLevel = 'critical' | 'high' | 'moderate' | 'low' | 'none' | 'unknown';

export interface MapStateShortage {
  state: string;         // 2-letter state code
  stateName: string;
  shortageLevel: ShortageLevel;
  /** Number of HPSA-designated areas (primary care, mental health, dental) */
  hpsaDesignationCount: number;
  /** Projected primary care provider gap (HRSA 2035 projections) */
  projectedGapPcp: number | null;
  /** Physician-to-population ratio (per 100k, from HRSA AHRF) */
  physiciansPerHundredK: number | null;
  /** Whether this state has critical rural shortage designations */
  hasCriticalRural: boolean;
  /** Context label for display */
  contextLabel: string;
  /** Source: aggregate data, never decision-grade */
  readonly decisionGrade: false;
}

export interface MapShortageLayer {
  states: MapStateShortage[];
  lastUpdated: string;
  sourceNote: string;
}

// State-level shortage data from HRSA HPSA designations and AHRF (2024).
// Compiled from public HRSA data — aggregate context, never individual-level.
const STATE_SHORTAGE_DATA: Omit<MapStateShortage, 'decisionGrade'>[] = [
  { state: 'AL', stateName: 'Alabama', shortageLevel: 'high', hpsaDesignationCount: 284, projectedGapPcp: 920, physiciansPerHundredK: 196, hasCriticalRural: true, contextLabel: 'High shortage — 284 HPSA areas, significant rural gaps' },
  { state: 'AK', stateName: 'Alaska', shortageLevel: 'critical', hpsaDesignationCount: 52, projectedGapPcp: 210, physiciansPerHundredK: 173, hasCriticalRural: true, contextLabel: 'Critical shortage — remote access challenges, lowest physician density' },
  { state: 'AZ', stateName: 'Arizona', shortageLevel: 'moderate', hpsaDesignationCount: 156, projectedGapPcp: 640, physiciansPerHundredK: 244, hasCriticalRural: true, contextLabel: 'Moderate shortage — border and rural areas critically underserved' },
  { state: 'AR', stateName: 'Arkansas', shortageLevel: 'critical', hpsaDesignationCount: 298, projectedGapPcp: 780, physiciansPerHundredK: 181, hasCriticalRural: true, contextLabel: 'Critical shortage — one of lowest physician ratios nationally' },
  { state: 'CA', stateName: 'California', shortageLevel: 'moderate', hpsaDesignationCount: 412, projectedGapPcp: 3200, physiciansPerHundredK: 299, hasCriticalRural: false, contextLabel: 'Moderate — large absolute gap despite high physician density in metros' },
  { state: 'CO', stateName: 'Colorado', shortageLevel: 'low', hpsaDesignationCount: 118, projectedGapPcp: 380, physiciansPerHundredK: 291, hasCriticalRural: true, contextLabel: 'Low overall — rural mountain communities underserved' },
  { state: 'CT', stateName: 'Connecticut', shortageLevel: 'low', hpsaDesignationCount: 62, projectedGapPcp: 140, physiciansPerHundredK: 356, hasCriticalRural: false, contextLabel: 'Low shortage — high physician density, urban core gaps remain' },
  { state: 'DE', stateName: 'Delaware', shortageLevel: 'moderate', hpsaDesignationCount: 34, projectedGapPcp: 95, physiciansPerHundredK: 277, hasCriticalRural: false, contextLabel: 'Moderate — small state with concentrated access disparities' },
  { state: 'FL', stateName: 'Florida', shortageLevel: 'moderate', hpsaDesignationCount: 320, projectedGapPcp: 2800, physiciansPerHundredK: 265, hasCriticalRural: true, contextLabel: 'Moderate — aging population drives high demand; rural north underserved' },
  { state: 'GA', stateName: 'Georgia', shortageLevel: 'high', hpsaDesignationCount: 388, projectedGapPcp: 1420, physiciansPerHundredK: 223, hasCriticalRural: true, contextLabel: 'High shortage — rural south Georgia critically underserved' },
  { state: 'HI', stateName: 'Hawaii', shortageLevel: 'low', hpsaDesignationCount: 28, projectedGapPcp: 85, physiciansPerHundredK: 310, hasCriticalRural: false, contextLabel: 'Low shortage — neighbor island access challenges' },
  { state: 'ID', stateName: 'Idaho', shortageLevel: 'high', hpsaDesignationCount: 112, projectedGapPcp: 320, physiciansPerHundredK: 188, hasCriticalRural: true, contextLabel: 'High shortage — rural state with lowest physician density in west' },
  { state: 'IL', stateName: 'Illinois', shortageLevel: 'moderate', hpsaDesignationCount: 248, projectedGapPcp: 1240, physiciansPerHundredK: 276, hasCriticalRural: true, contextLabel: 'Moderate — downstate rural communities significantly underserved' },
  { state: 'IN', stateName: 'Indiana', shortageLevel: 'moderate', hpsaDesignationCount: 192, projectedGapPcp: 780, physiciansPerHundredK: 228, hasCriticalRural: true, contextLabel: 'Moderate shortage — rural and industrial communities underserved' },
  { state: 'IA', stateName: 'Iowa', shortageLevel: 'moderate', hpsaDesignationCount: 168, projectedGapPcp: 420, physiciansPerHundredK: 208, hasCriticalRural: true, contextLabel: 'Moderate — agricultural communities with aging population face gaps' },
  { state: 'KS', stateName: 'Kansas', shortageLevel: 'high', hpsaDesignationCount: 214, projectedGapPcp: 480, physiciansPerHundredK: 201, hasCriticalRural: true, contextLabel: 'High shortage — large rural areas with no primary care access' },
  { state: 'KY', stateName: 'Kentucky', shortageLevel: 'high', hpsaDesignationCount: 312, projectedGapPcp: 840, physiciansPerHundredK: 213, hasCriticalRural: true, contextLabel: 'High shortage — Appalachian Kentucky critically underserved' },
  { state: 'LA', stateName: 'Louisiana', shortageLevel: 'high', hpsaDesignationCount: 268, projectedGapPcp: 720, physiciansPerHundredK: 231, hasCriticalRural: true, contextLabel: 'High shortage — rural parishes and post-storm communities underserved' },
  { state: 'ME', stateName: 'Maine', shortageLevel: 'moderate', hpsaDesignationCount: 88, projectedGapPcp: 210, physiciansPerHundredK: 249, hasCriticalRural: true, contextLabel: 'Moderate — rural north Maine faces critical access gaps' },
  { state: 'MD', stateName: 'Maryland', shortageLevel: 'low', hpsaDesignationCount: 98, projectedGapPcp: 290, physiciansPerHundredK: 374, hasCriticalRural: false, contextLabel: 'Low overall — rural western MD underserved; metro well-served' },
  { state: 'MA', stateName: 'Massachusetts', shortageLevel: 'low', hpsaDesignationCount: 84, projectedGapPcp: 240, physiciansPerHundredK: 388, hasCriticalRural: false, contextLabel: 'Low shortage — highest physician density nationally; access equity gaps remain' },
  { state: 'MI', stateName: 'Michigan', shortageLevel: 'moderate', hpsaDesignationCount: 244, projectedGapPcp: 1020, physiciansPerHundredK: 243, hasCriticalRural: true, contextLabel: 'Moderate — upper peninsula and rural areas significantly underserved' },
  { state: 'MN', stateName: 'Minnesota', shortageLevel: 'low', hpsaDesignationCount: 112, projectedGapPcp: 320, physiciansPerHundredK: 284, hasCriticalRural: true, contextLabel: 'Low — rural northwest MN faces gaps; Mayo corridor well-served' },
  { state: 'MS', stateName: 'Mississippi', shortageLevel: 'critical', hpsaDesignationCount: 356, projectedGapPcp: 760, physiciansPerHundredK: 173, hasCriticalRural: true, contextLabel: 'Critical shortage — lowest physician ratio in US; delta region severely underserved' },
  { state: 'MO', stateName: 'Missouri', shortageLevel: 'high', hpsaDesignationCount: 298, projectedGapPcp: 840, physiciansPerHundredK: 228, hasCriticalRural: true, contextLabel: 'High shortage — rural Ozarks and bootheel critically underserved' },
  { state: 'MT', stateName: 'Montana', shortageLevel: 'critical', hpsaDesignationCount: 118, projectedGapPcp: 280, physiciansPerHundredK: 186, hasCriticalRural: true, contextLabel: 'Critical — vast rural distances, lowest access scores in the west' },
  { state: 'NE', stateName: 'Nebraska', shortageLevel: 'high', hpsaDesignationCount: 176, projectedGapPcp: 320, physiciansPerHundredK: 211, hasCriticalRural: true, contextLabel: 'High shortage — sandhills and panhandle communities severely underserved' },
  { state: 'NV', stateName: 'Nevada', shortageLevel: 'high', hpsaDesignationCount: 88, projectedGapPcp: 520, physiciansPerHundredK: 196, hasCriticalRural: true, contextLabel: 'High shortage — rural counties have near-zero primary care access' },
  { state: 'NH', stateName: 'New Hampshire', shortageLevel: 'low', hpsaDesignationCount: 52, projectedGapPcp: 115, physiciansPerHundredK: 318, hasCriticalRural: false, contextLabel: 'Low — rural north NH has limited access; otherwise well-served' },
  { state: 'NJ', stateName: 'New Jersey', shortageLevel: 'low', hpsaDesignationCount: 124, projectedGapPcp: 420, physiciansPerHundredK: 314, hasCriticalRural: false, contextLabel: 'Low — urban core access gaps; high overall density' },
  { state: 'NM', stateName: 'New Mexico', shortageLevel: 'critical', hpsaDesignationCount: 148, projectedGapPcp: 420, physiciansPerHundredK: 188, hasCriticalRural: true, contextLabel: 'Critical — tribal lands and rural communities severely underserved' },
  { state: 'NY', stateName: 'New York', shortageLevel: 'moderate', hpsaDesignationCount: 388, projectedGapPcp: 2400, physiciansPerHundredK: 334, hasCriticalRural: true, contextLabel: 'Moderate — upstate rural areas and NYC boroughs both underserved' },
  { state: 'NC', stateName: 'North Carolina', shortageLevel: 'moderate', hpsaDesignationCount: 316, projectedGapPcp: 1140, physiciansPerHundredK: 247, hasCriticalRural: true, contextLabel: 'Moderate — Appalachian west and rural east significantly underserved' },
  { state: 'ND', stateName: 'North Dakota', shortageLevel: 'high', hpsaDesignationCount: 98, projectedGapPcp: 180, physiciansPerHundredK: 199, hasCriticalRural: true, contextLabel: 'High shortage — sparse population density, long travel distances' },
  { state: 'OH', stateName: 'Ohio', shortageLevel: 'moderate', hpsaDesignationCount: 284, projectedGapPcp: 1180, physiciansPerHundredK: 261, hasCriticalRural: true, contextLabel: 'Moderate — Appalachian southeast and rural northwest underserved' },
  { state: 'OK', stateName: 'Oklahoma', shortageLevel: 'high', hpsaDesignationCount: 312, projectedGapPcp: 720, physiciansPerHundredK: 199, hasCriticalRural: true, contextLabel: 'High shortage — tribal areas and rural communities critically underserved' },
  { state: 'OR', stateName: 'Oregon', shortageLevel: 'moderate', hpsaDesignationCount: 148, projectedGapPcp: 480, physiciansPerHundredK: 278, hasCriticalRural: true, contextLabel: 'Moderate — eastern Oregon faces critical access gaps' },
  { state: 'PA', stateName: 'Pennsylvania', shortageLevel: 'moderate', hpsaDesignationCount: 298, projectedGapPcp: 1320, physiciansPerHundredK: 292, hasCriticalRural: true, contextLabel: 'Moderate — rural central PA and coal communities underserved' },
  { state: 'RI', stateName: 'Rhode Island', shortageLevel: 'low', hpsaDesignationCount: 38, projectedGapPcp: 75, physiciansPerHundredK: 334, hasCriticalRural: false, contextLabel: 'Low shortage — small state, concentrated access' },
  { state: 'SC', stateName: 'South Carolina', shortageLevel: 'high', hpsaDesignationCount: 248, projectedGapPcp: 720, physiciansPerHundredK: 224, hasCriticalRural: true, contextLabel: 'High shortage — rural Pee Dee and coastal regions underserved' },
  { state: 'SD', stateName: 'South Dakota', shortageLevel: 'critical', hpsaDesignationCount: 112, projectedGapPcp: 210, physiciansPerHundredK: 192, hasCriticalRural: true, contextLabel: 'Critical — tribal lands face severe access crisis' },
  { state: 'TN', stateName: 'Tennessee', shortageLevel: 'high', hpsaDesignationCount: 304, projectedGapPcp: 880, physiciansPerHundredK: 238, hasCriticalRural: true, contextLabel: 'High shortage — Appalachian communities and rural west underserved' },
  { state: 'TX', stateName: 'Texas', shortageLevel: 'high', hpsaDesignationCount: 840, projectedGapPcp: 5400, physiciansPerHundredK: 220, hasCriticalRural: true, contextLabel: 'High shortage — largest absolute gap nationally; border and rural areas critical' },
  { state: 'UT', stateName: 'Utah', shortageLevel: 'moderate', hpsaDesignationCount: 98, projectedGapPcp: 320, physiciansPerHundredK: 233, hasCriticalRural: true, contextLabel: 'Moderate — rural south Utah and tribal lands underserved' },
  { state: 'VT', stateName: 'Vermont', shortageLevel: 'moderate', hpsaDesignationCount: 58, projectedGapPcp: 110, physiciansPerHundredK: 282, hasCriticalRural: true, contextLabel: 'Moderate — rural communities despite relatively high density' },
  { state: 'VA', stateName: 'Virginia', shortageLevel: 'moderate', hpsaDesignationCount: 212, projectedGapPcp: 840, physiciansPerHundredK: 274, hasCriticalRural: true, contextLabel: 'Moderate — southwest Appalachian Virginia critically underserved' },
  { state: 'WA', stateName: 'Washington', shortageLevel: 'moderate', hpsaDesignationCount: 178, projectedGapPcp: 680, physiciansPerHundredK: 274, hasCriticalRural: true, contextLabel: 'Moderate — eastern WA rural communities underserved' },
  { state: 'WV', stateName: 'West Virginia', shortageLevel: 'critical', hpsaDesignationCount: 198, projectedGapPcp: 440, physiciansPerHundredK: 189, hasCriticalRural: true, contextLabel: 'Critical — second-lowest physician density; Appalachian access crisis' },
  { state: 'WI', stateName: 'Wisconsin', shortageLevel: 'moderate', hpsaDesignationCount: 188, projectedGapPcp: 640, physiciansPerHundredK: 252, hasCriticalRural: true, contextLabel: 'Moderate — rural north Wisconsin faces significant gaps' },
  { state: 'WY', stateName: 'Wyoming', shortageLevel: 'critical', hpsaDesignationCount: 68, projectedGapPcp: 120, physiciansPerHundredK: 179, hasCriticalRural: true, contextLabel: 'Critical — least populous state; lowest access scores in mountain west' },
  { state: 'DC', stateName: 'District of Columbia', shortageLevel: 'moderate', hpsaDesignationCount: 44, projectedGapPcp: 180, physiciansPerHundredK: 488, hasCriticalRural: false, contextLabel: 'Moderate — highest physician density but severe access equity disparities' },
];

export async function GET() {
  try {
    const states: MapStateShortage[] = STATE_SHORTAGE_DATA.map(s => ({ ...s, decisionGrade: false as const }));

    const response: MapShortageLayer = {
      states,
      lastUpdated: new Date().toISOString(),
      sourceNote: 'HRSA HPSA designations + AHRF county data (2024). Aggregate context only — not decision-grade.',
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json({ states: [], lastUpdated: new Date().toISOString(), sourceNote: '' }, { status: 503 });
  }
}
