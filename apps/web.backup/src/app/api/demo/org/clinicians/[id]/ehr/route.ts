import { NextResponse } from 'next/server';
import { fetchEhrSyncStatus } from 'services/ehr/syncStatus';
import { runEhrReconciliationJob } from 'jobs/ehr/reconcile';

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const payload = await fetchEhrSyncStatus(context.params.id);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[EHR Sync API] Failed to load status', error);
    return NextResponse.json(
      {
        error: 'Failed to load EHR sync status',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const result = await runEhrReconciliationJob({ clinicianId: context.params.id, batchSize: 10 });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[EHR Sync API] Failed to trigger sync', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger EHR sync',
      },
      { status: 500 }
    );
  }
}
