import { NextResponse } from 'next/server'

import { listAuditEvents } from '@/lib/issuer/store'

export async function GET(
  _request: Request,
  { params }: { params: { issuerId: string } },
) {
  try {
    const events = listAuditEvents({ issuerId: params.issuerId })
    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    console.error('issuer.audit.timeline', error)
    return NextResponse.json({ error: 'Failed to load issuer audit timeline' }, { status: 500 })
  }
}










