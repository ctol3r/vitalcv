'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Filter,
  FileText,
  Calendar,
  Users,
  Tag,
  ArrowUpDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ContractType = 'NDA' | 'SERVICE' | 'PARTNERSHIP' | 'EMPLOYMENT' | 'VENDOR' | 'OTHER'
type ContractStatus = 'DRAFT' | 'UNDER_REVIEW' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED'

interface Contract {
  id: string
  title: string
  type: ContractType
  status: ContractStatus
  effectiveDate: string | null
  expirationDate: string | null
  parties: Array<{
    contactName: string | null
  }>
  tags: string[]
  snippet?: string
}

export default function ContractSearchPage() {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [partyFilter, setPartyFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  useEffect(() => {
    // Load initial results if there's a search query
    if (searchQuery) {
      performSearch()
    }
  }, [currentPage])

  async function performSearch() {
    if (!searchQuery.trim()) {
      setContracts([])
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({
        q: searchQuery,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(tagFilter !== 'all' && { tag: tagFilter }),
        ...(partyFilter && { party: partyFilter }),
      })

      const response = await fetch(`/api/contracts/search?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to search contracts (${response.status})`)
      }
      const data = await response.json()
      setContracts(data.contracts || [])
      setTotalPages(data.totalPages || 1)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to search contracts')
      setContracts([])
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setCurrentPage(1)
    performSearch()
  }

  function getStatusBadge(status: ContractStatus) {
    const variants: Record<ContractStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      DRAFT: { variant: 'outline', label: 'Draft' },
      UNDER_REVIEW: { variant: 'secondary', label: 'Under Review' },
      ACTIVE: { variant: 'default', label: 'Active' },
      TERMINATED: { variant: 'destructive', label: 'Terminated' },
      EXPIRED: { variant: 'outline', label: 'Expired' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  function formatDate(date: string | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString()
  }

  function highlightText(text: string, query: string) {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="h-7 w-7 text-primary" aria-hidden="true" />
          Contract Search
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Search contracts by title, content, parties, or tags. Use filters to narrow down results.
        </p>
      </header>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search contracts"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="NDA">NDA</SelectItem>
                    <SelectItem value="SERVICE">Service</SelectItem>
                    <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                    <SelectItem value="EMPLOYMENT">Employment</SelectItem>
                    <SelectItem value="VENDOR">Vendor</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger id="tag">
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {/* Tags would be loaded from API */}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="party">Party</Label>
                <Input
                  id="party"
                  placeholder="Party name..."
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
          <CardDescription>
            {loading ? 'Searching...' : `${contracts.length} contract${contracts.length !== 1 ? 's' : ''} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Searching...</div>
          ) : contracts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {searchQuery ? 'No contracts found. Try adjusting your search criteria.' : 'Enter a search query to find contracts.'}
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map((contract) => (
                <Card key={contract.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="text-lg font-semibold hover:underline"
                        >
                          {highlightText(contract.title, searchQuery)}
                        </Link>
                        {getStatusBadge(contract.status)}
                      </div>
                      {contract.snippet && (
                        <p className="text-sm text-muted-foreground">
                          {highlightText(contract.snippet, searchQuery)}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {contract.type}
                        </div>
                        {contract.effectiveDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Effective: {formatDate(contract.effectiveDate)}
                          </div>
                        )}
                        {contract.parties.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {contract.parties.length} party{contract.parties.length !== 1 ? 'ies' : ''}
                          </div>
                        )}
                        {contract.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            {contract.tags.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

