/**
 * useDecisionInsights.ts — Wave 93
 *
 * Polls GET /api/decision-insights/:npi every 30s.
 * Returns decision readiness, risk factors, and recommended actions.
 */

'use client';

import { useApi } from './useApi';
import type { DecisionInsightsData } from '@/components/decision/DecisionInsightsPanel';

interface ApiDecisionInsights {
  readiness: 'READY' | 'AT_RISK' | 'BLOCKED';
  insights: Array<{
    id: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
  }>;
  actions: Array<{
    id: string;
    priority: 'IMMEDIATE' | 'SOON' | 'ROUTINE';
    target: string;
    action: string;
    reason: string;
  }>;
  blockingCredentials: Array<{
    id: string;
    source: string;
    status: string;
    reason: string;
  }>;
  generatedAt: string;
}

export function useDecisionInsights(npi: string | null, intervalMs = 30_000) {
  const url = npi ? `/api/decision-insights/${npi}` : null;
  const result = useApi<ApiDecisionInsights>(url, { interval: intervalMs });

  // Shape into DecisionInsightsData format expected by the panel
  const data: DecisionInsightsData | null = result.data
    ? {
        readiness: result.data.readiness,
        insights: result.data.insights,
        actions: result.data.actions,
        blockingCredentials: result.data.blockingCredentials,
      }
    : null;

  return {
    ...result,
    data,
  };
}
