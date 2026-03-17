import { type NextRequest, NextResponse } from 'next/server';
import {
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';

export const runtime = 'nodejs';

function buildEmptyCalibrationPayload() {
  const generatedAt = new Date().toISOString();

  return {
    schema: 'https://vitalcv.com/calibration/v1',
    stats: [],
    summary: {
      totalOutcomes: 0,
      resolvedTodayCount: 0,
      overallTruePositiveRate: 0,
      overallFalsePositiveRate: 0,
      worstPerformingInvestigators: [],
      bestPerformingInvestigators: [],
      generatedAt,
    },
    generatedAt,
  };
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildEmptyCalibrationPayload());
  }

  try {
    const { ok, payload } = await fetchBackendJson<unknown>('/api/findings/calibration', undefined, 12_000, {
      context: authContext,
    });
    if (!ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildEmptyCalibrationPayload());
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildEmptyCalibrationPayload());
  }
}
