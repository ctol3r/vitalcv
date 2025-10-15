import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', app: 'vitalcv-frontend', ts: new Date().toISOString() });
}
