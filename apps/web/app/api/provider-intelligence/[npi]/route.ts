import {
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  resolveIntelligenceAuthContext,
} from '../../intelligence/_shared';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const NPI_RE = /^\d{10}$/;

function buildProviderIntelligenceFallback(npi: string) {
  const generatedAt = new Date().toISOString();
  const emptyExplanation = 'Active investigation context is required to load provider intelligence.';

  return {
    schema: 'https://vitalcv.com/intelligence/provider/v1',
    npi,
    providerId: npi,
    providerLabel: npi,
    specialty: null,
    geography: null,
    trust: {
      score: null,
      tier: 'UNKNOWN',
      confidence: 0,
      drivers: [],
      sourceSignals: [],
      last_updated: generatedAt,
      explanation: emptyExplanation,
      insufficientSignal: true,
    },
    influence: {
      score: null,
      percentile: null,
      tier: 'UNKNOWN',
      confidence: 0,
      drivers: [],
      sourceSignals: [],
      centrality_delta: null,
      last_updated: generatedAt,
      explanation: emptyExplanation,
      insufficientSignal: true,
    },
    workforcePressure: {
      state: 'UNKNOWN',
      score: null,
      confidence: 0,
      drivers: [],
      sourceSignals: [],
      geography: null,
      specialty: null,
      last_updated: generatedAt,
      explanation: emptyExplanation,
      insufficientSignal: true,
    },
    institutionMomentum: null,
    earlyWarnings: [],
    feed: {
      generatedAt,
      total: 0,
      counts: {
        finding: 0,
        storyline: 0,
        prediction: 0,
        insight: 0,
        early_warning: 0,
      },
      items: [],
    },
    summary: 'Provider intelligence requires active investigation context.',
    generatedAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const authContext = await resolveIntelligenceAuthContext();
  const { npi } = await params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (authContext.status !== 'authenticated') {
    logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'read_fallback');
    return NextResponse.json(buildProviderIntelligenceFallback(npi));
  }

  try {
    const upstream = await fetchBackendJson(
      `/api/provider-intelligence/${npi}`,
      undefined,
      20_000,
      { context: authContext },
    );

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'backend_fallback');
      return NextResponse.json(buildProviderIntelligenceFallback(npi));
    }

    return NextResponse.json(upstream.payload, { status: 200 });
  } catch (error) {
    logIntelligenceFallbackUsage(`/api/provider-intelligence/${npi}`, authContext, 'backend_fallback');
    return NextResponse.json(
      buildProviderIntelligenceFallback(npi),
    );
  }
}
