'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar'
import { FacetFilters } from '@/components/search/FacetFilters'
import { SavedSearches } from '@/components/search/SavedSearches'
import { RecommendationsWidget } from '@/components/search/RecommendationsWidget'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'provider' | 'credential' | 'module' | 'contract'
  title: string
  description?: string
  metadata?: Record<string, any>
  relevanceScore?: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  facets?: Record<string, Array<{ value: string; label: string; count: number }>>
}

export default function SearchResultsPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const sortBy = searchParams.get('sort') || 'relevance'
  const [results, setResults] = React.useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [showFilters, setShowFilters] = React.useState(false)

  // Fetch search results
  React.useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', page.toString())
        params.set('sort', sortBy)

        const response = await fetch(`/api/search?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
        }
      } catch (error) {
        console.error('Failed to fetch search results:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [query, page, sortBy, searchParams])

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    window.location.href = `/search?${params.toString()}`
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'provider':
        return 'default'
      case 'credential':
        return 'secondary'
      case 'module':
        return 'outline'
      case 'contract':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'provider':
        return 'Provider'
      case 'credential':
        return 'Credential'
      case 'module':
        return 'Module'
      case 'contract':
        return 'Contract'
      default:
        return type
    }
  }

  const getResultUrl = (result: SearchResult) => {
    switch (result.type) {
      case 'provider':
        return `/demo/org/providers/${result.id}`
      case 'credential':
        return `/demo/org/credentials/${result.id}`
      case 'module':
        return `/demo/org/marketplace/${result.id}`
      case 'contract':
        return `/demo/org/contracts/${result.id}`
      default:
        return '#'
    }
  }

  const totalPages = results ? Math.ceil(results.total / results.pageSize) : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Search Bar */}
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <GlobalSearchBar />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Filters */}
          <aside className={cn(
            'w-64 shrink-0 transition-all duration-200',
            'hidden lg:block',
            showFilters && 'block absolute lg:relative inset-0 lg:inset-auto bg-background z-50 lg:z-auto p-4 lg:p-0'
          )}>
            <div className="sticky top-20 space-y-6">
              <FacetFilters facets={results?.facets ? Object.entries(results.facets).map(([id, options]) => ({
                id,
                label: id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1'),
                type: 'multiselect' as const,
                options: options.map(opt => ({ value: opt.value, label: opt.label, count: opt.count })),
              })) : undefined} />

              {query && <SavedSearches query={query} className="mt-8" />}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden mb-4">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>

            {/* Results Header */}
            {query && (
              <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">
                      Search Results
                      {results && (
                        <span className="text-muted-foreground font-normal ml-2">
                          ({results.total.toLocaleString()} {results.total === 1 ? 'result' : 'results'})
                        </span>
                      )}
                    </h1>
                    {query && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Results for &quot;<span className="font-medium">{query}</span>&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={(value) => {
                      const params = new URLSearchParams(searchParams.toString())
                      params.set('sort', value)
                      params.delete('page')
                      window.location.href = `/search?${params.toString()}`
                    }}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relevance">Relevance</SelectItem>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="title-asc">Title A-Z</SelectItem>
                        <SelectItem value="title-desc">Title Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !query && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Start Searching</h2>
                <p className="text-muted-foreground">
                  Enter a search query above to find providers, credentials, modules, and contracts
                </p>
              </div>
            )}

            {/* No Results */}
            {!isLoading && query && results && results.results.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No results found</h2>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or filters
                </p>
                <Button variant="outline" onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('specialty')
                  params.delete('region')
                  params.delete('credentialType')
                  params.delete('language')
                  params.delete('priceRange')
                  window.location.href = `/search?${params.toString()}`
                }}>
                  Clear Filters
                </Button>
              </div>
            )}

            {/* Results List */}
            {!isLoading && results && results.results.length > 0 && (
              <>
                <div className="space-y-4 mb-6">
                  {results.results.map((result) => (
                    <Card key={result.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getTypeBadgeVariant(result.type)}>
                                {getTypeLabel(result.type)}
                              </Badge>
                              {result.relevanceScore && (
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(result.relevanceScore * 100)}% match
                                </span>
                              )}
                            </div>
                            <CardTitle className="text-lg">
                              <Link
                                href={getResultUrl(result)}
                                className="hover:underline"
                              >
                                {result.title}
                              </Link>
                            </CardTitle>
                            {result.description && (
                              <CardDescription className="mt-2 line-clamp-2">
                                {result.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(result.metadata).slice(0, 5).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Recommendations */}
            {!isLoading && query && results && results.results.length > 0 && (
              <div className="mt-8">
                <RecommendationsWidget query={query} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

