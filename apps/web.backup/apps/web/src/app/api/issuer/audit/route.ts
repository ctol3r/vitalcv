import { NextResponse } from 'next/server'

import { listAuditEvents } from '@/lib/issuer/store'

export async function GET() {
  try {
    const events = listAuditEvents()
    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    console.error('issuer.audit', error)
    return NextResponse.json({ error: 'Failed to load audit events' }, { status: 500 })
  }
}

