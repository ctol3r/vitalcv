/**
 * Unit Detail API Route
 * Phase 3: Backend API for unit detail data
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { unitId: string } }) {
  try {
    const { unitId } = params;

    // Mock data for unit detail
    const mockUnitDetail = {
      unit: {
        id: unitId,
        name: 'ICU - Main',
        type: 'ICU',
        providerCount: 24,
        readinessStatus: 'green',
        specialtyAlignment: ['Critical Care', 'Pulmonology'],
        coverageDeficit: 0,
        averageTrustScore: 0.88,
        chainEvidenceHash: '0x1234...abcd',
      },
      roster: [
        {
          id: 'clinician-1',
          name: 'Dr. Sarah Johnson',
          role: 'MD',
          trustScore: 0.92,
          eligibilityScore: 0.89,
          credentialHealth: 'excellent',
          specialties: ['Critical Care', 'Pulmonology'],
          lastVerified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'clinician-2',
          name: 'Dr. Michael Chen',
          role: 'MD',
          trustScore: 0.85,
          eligibilityScore: 0.82,
          credentialHealth: 'good',
          specialties: ['Critical Care'],
          lastVerified: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'clinician-3',
          name: 'RN Jennifer Martinez',
          role: 'RN',
          trustScore: 0.88,
          eligibilityScore: 0.85,
          credentialHealth: 'excellent',
          specialties: ['Critical Care'],
          lastVerified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      deficiencies: [
        {
          id: 'def-1',
          type: 'expiring_license',
          severity: 'high',
          description: '2 licenses expiring within 30 days',
          affectedClinicians: ['clinician-2'],
          deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      anchorFreshness: {
        'clinician-1': {
          lastAnchored: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceAnchor: 5,
          freshness: 'fresh',
        },
        'clinician-2': {
          lastAnchored: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceAnchor: 45,
          freshness: 'stale',
        },
        'clinician-3': {
          lastAnchored: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceAnchor: 3,
          freshness: 'fresh',
        },
      },
      credentialGaps: [
        {
          id: 'gap-1',
          type: 'license',
          daysUntilGap: 25,
          affectedCount: 2,
          unitId: unitId,
          forecastDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      recommendedHiring: [
        {
          id: 'hire-1',
          role: 'MD',
          specialty: 'Critical Care',
          priority: 'medium',
          reason: 'Projected gap in 60 days due to retirement',
          suggestedJobPosting: '/jobs/critical-care-md',
        },
      ],
    };

    return NextResponse.json(mockUnitDetail);
  } catch (error) {
    console.error('Error fetching unit detail:', error);
    return NextResponse.json({ error: 'Failed to fetch unit detail' }, { status: 500 });
  }
}








