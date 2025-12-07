/**
 * Workforce Predictions API Route
 * Phase 4: Backend API for workforce predictions
 */

import { NextResponse } from 'next/server';
import { WorkforcePredictionEngine } from '@/lib/workforce/prediction-engine';

export async function GET() {
  try {
    // Mock data for predictions
    const mockData = {
      currentCounts: {
        'Emergency Medicine': 156,
        'Internal Medicine': 234,
        'Surgery': 189,
        'Pediatrics': 142,
        'Cardiology': 98,
        'ICU': 24,
      },
      projectedRetirements: {
        'Emergency Medicine': 5,
        'Internal Medicine': 8,
        'Surgery': 3,
        'Pediatrics': 2,
        'Cardiology': 1,
        'ICU': 3,
      },
      licenses: [
        { state: 'CA', expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        { state: 'NY', expirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() },
        { state: 'TX', expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      deaRenewals: [
        { expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        { expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      credentials: [
        { type: 'board_cert', renewalMonth: '2025-03', processingDays: 14 },
        { type: 'license', renewalMonth: '2025-06', processingDays: 21 },
        { type: 'dea', renewalMonth: '2025-09', processingDays: 30 },
      ],
      units: [
        { unitId: 'unit-icu-1', staleAnchors: 2, missingEvidence: 1, hashMismatches: 0 },
        { unitId: 'unit-ed-1', staleAnchors: 5, missingEvidence: 2, hashMismatches: 1 },
      ],
      forecastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const prediction = WorkforcePredictionEngine.generatePrediction(mockData);

    // Add daysUntilGap to shortages for display
    const shortagesWithDays = prediction.forecastedShortages.map((shortage) => ({
      ...shortage,
      daysUntilGap: Math.ceil(
        (new Date(shortage.forecastDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    }));

    return NextResponse.json({
      ...prediction,
      forecastedShortages: shortagesWithDays,
    });
  } catch (error) {
    console.error('Error generating workforce predictions:', error);
    return NextResponse.json({ error: 'Failed to generate predictions' }, { status: 500 });
  }
}








