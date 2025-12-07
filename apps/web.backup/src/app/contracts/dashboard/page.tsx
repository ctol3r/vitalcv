'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Tag,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    id: string
    contactName: string | null
    organizationId: string | null
    partnerId: string | null
    role: 'SIGNER' | 'WITNESS' | 'OBSERVER'
  }>
  tags: string[]
  createdAt: string
  updatedAt: string
}

type SortField = 'title' | 'type' | 'status' | 'effectiveDate' | 'expirationDate' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export default function ContractsDashboard() {
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadContracts()
  }, [statusFilter, typeFilter, tagFilter, sortField, sortDirection, currentPage, searchQuery])

  async function loadContracts() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(tagFilter !== 'all' && { tag: tagFilter }),
        sortBy: sortField,
        sortOrder: sortDirection,
      })

      const response = await fetch(`/api/contracts?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load contracts (${response.status})`)
      }
      const data = await response.json()
      setContracts(data.contracts || [])
      setTotalPages(data.totalPages || 1)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load contracts')
      setContracts([])
    } finally {
      setLoading(false)
    }
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

  function getTypeLabel(type: ContractType) {
    return type.replace('_', ' ')
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function formatDate(date: string | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString()
  }

  const filteredContracts = contracts

  if (loading && contracts.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading contracts…</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
              Contracts Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl mt-2">
              View and manage all contracts. Filter by status, type, or tags, and search for specific contracts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadContracts} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => router.push('/contracts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load contracts</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9"
                  aria-label="Search contracts"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger id="status" aria-label="Filter by status">
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
              <Select value={typeFilter} onValueChange={(value) => {
                setTypeFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger id="type" aria-label="Filter by type">
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
              <Select value={tagFilter} onValueChange={(value) => {
                setTagFilter(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger id="tag" aria-label="Filter by tag">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {/* Tags would be loaded from API */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
          <CardDescription>
            {filteredContracts.length} contract{filteredContracts.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3"
                      onClick={() => handleSort('title')}
                    >
                      Title
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3"
                      onClick={() => handleSort('type')}
                    >
                      Type
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3"
                      onClick={() => handleSort('status')}
                    >
                      Status
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3"
                      onClick={() => handleSort('effectiveDate')}
                    >
                      Effective Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3"
                      onClick={() => handleSort('expirationDate')}
                    >
                      Expiration Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Key Parties</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="hover:underline"
                      >
                        {contract.title}
                      </Link>
                    </TableCell>
                    <TableCell>{getTypeLabel(contract.type)}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(contract.effectiveDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(contract.expirationDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {contract.parties.filter(p => p.role === 'SIGNER').length} signer{contract.parties.filter(p => p.role === 'SIGNER').length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/contracts/${contract.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredContracts.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No contracts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

