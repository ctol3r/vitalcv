import { NextResponse } from 'next/server';
import { buildChainHealthSnapshot } from '@/apps/api/src/chain/health/snapshot';

export async function GET(): Promise<NextResponse> {
  try {
    const snapshot = await buildChainHealthSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api][chain-health] failed', error);
    return NextResponse.json(
      {
        error: 'chain_health_unavailable',
        message: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}









