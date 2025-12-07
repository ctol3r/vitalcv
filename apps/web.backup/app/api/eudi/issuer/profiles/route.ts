import { NextResponse } from 'next/server';

import { listEudiIssuerProfiles, listWalletProviders } from '@/apps/api/src/services/eudi/issuer';

export async function GET() {
  const profiles = listEudiIssuerProfiles();
  const providers = listWalletProviders();
  return NextResponse.json({
    rows: profiles,
    providers,
    generatedAt: new Date().toISOString(),
  });
}









