import { NextResponse } from 'next/server';

import { buildAdapterMatrix } from '@/lib/authority/adapterMatrix';
import { buildDataClassificationFoundation } from '@/lib/security/dataClassificationFoundation';
import { buildRetentionFoundation } from '@/lib/security/retentionFoundation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCLAIMER =
  'This report is a foundation shape for vendor risk assessments. It reflects planned controls, not enforced production policies.';

export async function GET(): Promise<NextResponse> {
  const dataClassification = buildDataClassificationFoundation();
  const retention = buildRetentionFoundation();
  const authority = buildAdapterMatrix();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    superadminGateLive: false,
    complianceReportLive: false,
    reportScope: 'enterprise-vanguard-6a-foundation',
    dataClassification: {
      redactionLive: dataClassification.redactionLive,
      ruleCount: dataClassification.rules.length,
    },
    retention: {
      retentionEnforced: retention.retentionEnforced,
      policyCount: retention.policies.length,
    },
    authority: {
      allAdaptersLive: authority.allAdaptersLive,
      adapterCount: authority.adapters.length,
    },
    disclaimer: DISCLAIMER,
  });
}
