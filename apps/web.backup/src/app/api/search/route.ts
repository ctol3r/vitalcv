import { NextRequest, NextResponse } from 'next/server'

/**
 * Unified search API endpoint
 * B232C-SEARCH-012: SearchResultsPage API
 *
 * Supports searching across providers, credentials, modules, and contracts
 */

interface SearchResult {
  id: string
  type: 'provider' | 'credential' | 'module' | 'contract'
  title: string
  description?: string
  metadata?: Record<string, any>
  relevanceScore: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
    const sortBy = searchParams.get('sort') || 'relevance'

    // Filter parameters
    const specialty = searchParams.get('specialty')?.split(',') || []
    const region = searchParams.get('region')?.split(',') || []
    const credentialType = searchParams.get('credentialType')?.split(',') || []
    const language = searchParams.get('language')?.split(',') || []
    const priceRange = searchParams.get('priceRange')

    if (!query.trim()) {
      return NextResponse.json({
        results: [],
        total: 0,
        page: 1,
        pageSize,
        facets: {},
      })
    }

    // In production, this would query the database/search index
    // For now, return mock data that matches the expected structure
    const mockResults: SearchResult[] = [
      // Providers
      {
        id: 'provider-001',
        type: 'provider',
        title: 'Dr. Sarah Johnson, MD',
        description: 'Cardiologist with 15 years of experience. Board certified in Cardiology.',
        metadata: {
          specialty: 'Cardiology',
          region: 'Northeast',
          npi: '1234567890',
          credentials: ['MD', 'FACC'],
        },
        relevanceScore: 0.95,
      },
      {
        id: 'provider-002',
        type: 'provider',
        title: 'Dr. Michael Chen, DO',
        description: 'Orthopedic surgeon specializing in sports medicine.',
        metadata: {
          specialty: 'Orthopedics',
          region: 'West',
          npi: '0987654321',
          credentials: ['DO', 'FAOA'],
        },
        relevanceScore: 0.87,
      },
      // Credentials
      {
        id: 'credential-001',
        type: 'credential',
        title: 'Board Certification - Cardiology',
        description: 'American Board of Internal Medicine - Cardiovascular Disease',
        metadata: {
          credentialType: 'board-certification',
          specialty: 'Cardiology',
          issuer: 'ABIM',
          expiryDate: '2026-12-31',
        },
        relevanceScore: 0.92,
      },
      {
        id: 'credential-002',
        type: 'credential',
        title: 'Medical License - California',
        description: 'Active medical license in the state of California',
        metadata: {
          credentialType: 'license',
          region: 'West',
          issuer: 'California Medical Board',
          expiryDate: '2025-06-30',
        },
        relevanceScore: 0.85,
      },
      // Modules
      {
        id: 'module-001',
        type: 'module',
        title: 'Credential Verification Module',
        description: 'Automated credential verification and background check module',
        metadata: {
          specialty: 'General',
          price: '$299/month',
          rating: 4.8,
          provider: 'VitalCV',
        },
        relevanceScore: 0.90,
      },
      {
        id: 'module-002',
        type: 'module',
        title: 'Privilege Management System',
        description: 'Comprehensive privilege management and tracking system',
        metadata: {
          specialty: 'General',
          price: '$499/month',
          rating: 4.6,
          provider: 'HealthTech Solutions',
        },
        relevanceScore: 0.88,
      },
      // Contracts
      {
        id: 'contract-001',
        type: 'contract',
        title: 'Revenue Share Agreement - Acme Healthcare',
        description: 'Standard revenue share agreement with Acme Healthcare Inc.',
        metadata: {
          counterparty: 'Acme Healthcare Inc.',
          status: 'signed',
          effectiveDate: '2024-01-01',
        },
        relevanceScore: 0.82,
      },
    ]

    // Apply filters
    let filteredResults = mockResults.filter((result) => {
      if (specialty.length > 0 && result.metadata?.specialty) {
        const resultSpecialty = result.metadata.specialty.toLowerCase()
        if (!specialty.some(s => resultSpecialty.includes(s.toLowerCase()))) {
          return false
        }
      }
      if (region.length > 0 && result.metadata?.region) {
        const resultRegion = result.metadata.region.toLowerCase()
        if (!region.some(r => resultRegion.includes(r.toLowerCase()))) {
          return false
        }
      }
      if (credentialType.length > 0 && result.metadata?.credentialType) {
        if (!credentialType.includes(result.metadata.credentialType)) {
          return false
        }
      }
      if (language.length > 0 && result.metadata?.language) {
        if (!language.includes(result.metadata.language)) {
          return false
        }
      }
      return true
    })

    // Sort results
    filteredResults.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return b.relevanceScore - a.relevanceScore
        case 'newest':
          return (b.metadata?.createdAt || '').localeCompare(a.metadata?.createdAt || '')
        case 'oldest':
          return (a.metadata?.createdAt || '').localeCompare(b.metadata?.createdAt || '')
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'title-desc':
          return b.title.localeCompare(a.title)
        default:
          return b.relevanceScore - a.relevanceScore
      }
    })

    // Paginate
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedResults = filteredResults.slice(startIndex, endIndex)

    // Generate facets (for filter counts)
    const facets = {
      specialty: [
        { value: 'cardiology', label: 'Cardiology', count: filteredResults.filter(r => r.metadata?.specialty === 'Cardiology').length },
        { value: 'orthopedics', label: 'Orthopedics', count: filteredResults.filter(r => r.metadata?.specialty === 'Orthopedics').length },
        { value: 'pediatrics', label: 'Pediatrics', count: filteredResults.filter(r => r.metadata?.specialty === 'Pediatrics').length },
        { value: 'surgery', label: 'Surgery', count: filteredResults.filter(r => r.metadata?.specialty === 'Surgery').length },
        { value: 'internal-medicine', label: 'Internal Medicine', count: filteredResults.filter(r => r.metadata?.specialty === 'Internal Medicine').length },
      ],
      region: [
        { value: 'northeast', label: 'Northeast', count: filteredResults.filter(r => r.metadata?.region === 'Northeast').length },
        { value: 'southeast', label: 'Southeast', count: filteredResults.filter(r => r.metadata?.region === 'Southeast').length },
        { value: 'midwest', label: 'Midwest', count: filteredResults.filter(r => r.metadata?.region === 'Midwest').length },
        { value: 'west', label: 'West', count: filteredResults.filter(r => r.metadata?.region === 'West').length },
      ],
      credentialType: [
        { value: 'license', label: 'License', count: filteredResults.filter(r => r.metadata?.credentialType === 'license').length },
        { value: 'certification', label: 'Certification', count: filteredResults.filter(r => r.metadata?.credentialType === 'certification').length },
        { value: 'board-certification', label: 'Board Certification', count: filteredResults.filter(r => r.metadata?.credentialType === 'board-certification').length },
        { value: 'privilege', label: 'Privilege', count: filteredResults.filter(r => r.metadata?.credentialType === 'privilege').length },
      ],
    }

    return NextResponse.json({
      results: paginatedResults,
      total: filteredResults.length,
      page,
      pageSize,
      facets,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

