import { NextResponse } from 'next/server'

import { IssuerStoreError, issueClaim } from '@/lib/issuer/store'

interface IssueRequestBody {
  templateId?: string
}

export async function POST(request: Request, { params }: { params: { claimId: string } }) {
  try {
    const payload = (await request.json().catch(() => ({}))) as IssueRequestBody
    const result = issueClaim(params.claimId, { templateId: payload.templateId })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      )
    }

    console.error('issuer.issue', error)
    return NextResponse.json({ error: 'Failed to issue credential' }, { status: 500 })
  }
}

