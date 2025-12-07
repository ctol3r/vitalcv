import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract templates
 * B231C-CON-012: TemplateLibrary API
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    // In production, this would fetch from Prisma/database
    const mockTemplates = [
      {
        id: 'template-revenue-share-001',
        name: 'Standard Revenue Share Agreement',
        description: 'Standard template for revenue sharing partnerships',
        type: 'revenue_share',
        language: 'en',
        version: '1.0.0',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'template-service-001',
        name: 'Service Agreement',
        description: 'Template for service provider agreements',
        type: 'service_agreement',
        language: 'en',
        version: '1.2.0',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'template-privacy-001',
        name: 'Privacy Policy Agreement',
        description: 'Template for privacy policy and data handling agreements',
        type: 'privacy',
        language: 'en',
        version: '2.0.0',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'template-custom-001',
        name: 'Custom Partnership Agreement',
        description: 'Customizable template for various partnership types',
        type: 'custom',
        language: 'en',
        version: '1.0.0',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    let filteredTemplates = mockTemplates
    if (type && type !== 'all') {
      filteredTemplates = mockTemplates.filter((t) => t.type === type)
    }

    return NextResponse.json({ templates: filteredTemplates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

