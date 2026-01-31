import { type NextRequest, NextResponse } from 'next/server'

import { runPsvDemo } from '@/lib/psv-integrations'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const npi = typeof body?.npi === 'string' ? body.npi.trim() : ''

    if (!npi) {
      return NextResponse.json({ error: 'NPI is required to run PSV.' }, { status: 400 })
    }

    if (!/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'NPI must be 10 digits.' }, { status: 400 })
    }

    const report = runPsvDemo(npi)
    return NextResponse.json(report, { status: 200 })
  } catch (error) {
    console.error('PSV demo error:', error)
    return NextResponse.json(
      { error: 'Unable to run PSV at this time.' },
      { status: 500 },
    )
  }
}
