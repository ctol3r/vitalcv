/**
 * Workforce Units API Route
 * Phase 2: Backend API for workforce units/heatmap data
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Mock data for units
    const mockUnits = [
      {
        id: 'unit-icu-1',
        name: 'ICU - Main',
        type: 'ICU',
        providerCount: 24,
        readinessStatus: 'green',
        specialtyAlignment: ['Critical Care', 'Pulmonology'],
        coverageDeficit: 0,
        averageTrustScore: 0.88,
        chainEvidenceHash: '0x1234...abcd',
      },
      {
        id: 'unit-icu-2',
        name: 'ICU - Cardiac',
        type: 'ICU',
        providerCount: 18,
        readinessStatus: 'amber',
        specialtyAlignment: ['Cardiology', 'Critical Care'],
        coverageDeficit: 2,
        averageTrustScore: 0.82,
        chainEvidenceHash: '0x5678...efgh',
      },
      {
        id: 'unit-ed-1',
        name: 'ED - Main',
        type: 'ED',
        providerCount: 42,
        readinessStatus: 'green',
        specialtyAlignment: ['Emergency Medicine', 'Trauma'],
        coverageDeficit: 0,
        averageTrustScore: 0.85,
        chainEvidenceHash: '0x9abc...ijkl',
      },
      {
        id: 'unit-ed-2',
        name: 'ED - Pediatric',
        type: 'ED',
        providerCount: 16,
        readinessStatus: 'red',
        specialtyAlignment: ['Pediatrics', 'Emergency Medicine'],
        coverageDeficit: 4,
        averageTrustScore: 0.75,
        chainEvidenceHash: null,
      },
      {
        id: 'unit-medsurg-1',
        name: 'Med/Surg - 3rd Floor',
        type: 'Med/Surg',
        providerCount: 38,
        readinessStatus: 'green',
        specialtyAlignment: ['Internal Medicine', 'General Surgery'],
        coverageDeficit: 0,
        averageTrustScore: 0.83,
        chainEvidenceHash: '0xdef0...mnop',
      },
      {
        id: 'unit-medsurg-2',
        name: 'Med/Surg - 4th Floor',
        type: 'Med/Surg',
        providerCount: 35,
        readinessStatus: 'amber',
        specialtyAlignment: ['Internal Medicine'],
        coverageDeficit: 1,
        averageTrustScore: 0.79,
        chainEvidenceHash: '0x1234...qrst',
      },
      {
        id: 'unit-or-1',
        name: 'OR - Main',
        type: 'OR',
        providerCount: 28,
        readinessStatus: 'green',
        specialtyAlignment: ['Anesthesiology', 'Surgery'],
        coverageDeficit: 0,
        averageTrustScore: 0.87,
        chainEvidenceHash: '0x5678...uvwx',
      },
      {
        id: 'unit-or-2',
        name: 'OR - Outpatient',
        type: 'OR',
        providerCount: 12,
        readinessStatus: 'amber',
        specialtyAlignment: ['Surgery'],
        coverageDeficit: 1,
        averageTrustScore: 0.81,
        chainEvidenceHash: '0x9abc...yzab',
      },
      {
        id: 'unit-ld-1',
        name: 'L&D - Main',
        type: 'L&D',
        providerCount: 22,
        readinessStatus: 'green',
        specialtyAlignment: ['Obstetrics', 'Gynecology'],
        coverageDeficit: 0,
        averageTrustScore: 0.84,
        chainEvidenceHash: '0xcdef...cdef',
      },
      {
        id: 'unit-psych-1',
        name: 'Psych - Inpatient',
        type: 'Psych',
        providerCount: 18,
        readinessStatus: 'amber',
        specialtyAlignment: ['Psychiatry'],
        coverageDeficit: 2,
        averageTrustScore: 0.78,
        chainEvidenceHash: '0x0123...4567',
      },
      {
        id: 'unit-tele-1',
        name: 'Telemedicine - Virtual',
        type: 'Telemedicine',
        providerCount: 45,
        readinessStatus: 'green',
        specialtyAlignment: ['Telemedicine', 'Primary Care'],
        coverageDeficit: 0,
        averageTrustScore: 0.86,
        chainEvidenceHash: '0x89ab...cdef',
      },
    ];

    return NextResponse.json({ units: mockUnits });
  } catch (error) {
    console.error('Error fetching workforce units:', error);
    return NextResponse.json({ error: 'Failed to fetch workforce units' }, { status: 500 });
  }
}








