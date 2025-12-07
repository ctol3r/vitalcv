'use client'

import { useEffect, useState } from 'react'
import { ArrowUpDown, ExternalLink, RefreshCw } from 'lucide-react'
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

interface LedgerEntry {
  id: string
  orgId: string | null
  amount: number
  currency: string
  type: 'credit' | 'debit'
  referenceId: string | null
  relatedEventId: string | null
  metadata: any
  createdAt: string
  relatedPurchase?: {
    id: string
    listingId: string
    status: string
  }
  relatedRecognition?: {
    id: string
    eventType: string
    status: string
  }
  relatedSettlement?: {
    id: string
    txId: string
    status: string
  }
}

interface LedgerViewerProps {
  orgId: string
  startDate: string
  endDate: string
}

type SortField = 'createdAt' | 'amount' | 'type'
type SortDirection = 'asc' | 'desc'

export function LedgerViewer({ orgId, startDate, endDate }: LedgerViewerProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')

  useEffect(() => {
    loadEntries()
  }, [orgId, startDate, endDate, sortField, sortDirection, filterType, filterCurrency])

  async function loadEntries() {
    try {
      const params = new URLSearchParams({
        orgId,
        startDate,
        endDate,
        sortField,
        sortDirection,
        ...(filterType !== 'all' && { filterType }),
        ...(filterCurrency !== 'all' && { filterCurrency }),
        ...(searchTerm && { search: searchTerm }),
      })
      const response = await fetch(`/api/demo/org/finance/ledger?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load ledger entries (${response.status})`)
      }
      const payload = await response.json()
      setEntries(payload.entries || [])
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load ledger entries')
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number, currency: string = 'USD'): string {
    if (currency === 'VITA') {
      return `${amount > 0 ? '+' : ''}${amount.toLocaleString()} VITA`
    }
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Math.abs(amount) / 100)
    return `${amount > 0 ? '+' : ''}${formatted}`
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  function getReferenceLink(entry: LedgerEntry): string | null {
    if (entry.relatedPurchase) {
      return `/demo/org/marketplace/purchases/${entry.relatedPurchase.id}`
    }
    if (entry.relatedRecognition) {
      return `/demo/org/finance/revenue/${entry.relatedRecognition.id}`
    }
    if (entry.relatedSettlement) {
      return `/demo/org/finance/settlements/${entry.relatedSettlement.id}`
    }
    return null
  }

  const filteredEntries = entries.filter((entry) => {
    if (filterType !== 'all' && entry.type !== filterType) return false
    if (filterCurrency !== 'all' && entry.currency !== filterCurrency) return false
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        entry.id.toLowerCase().includes(searchLower) ||
        entry.referenceId?.toLowerCase().includes(searchLower) ||
        entry.relatedEventId?.toLowerCase().includes(searchLower) ||
        JSON.stringify(entry.metadata).toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  if (loading && entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading ledger entries…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error loading ledger</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ledger Entries</CardTitle>
            <CardDescription>
              Double-entry accounting ledger with links to related transactions
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadEntries}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterType">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger id="filterType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterCurrency">Currency</Label>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger id="filterCurrency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="VITA">VITA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('createdAt')}
                  >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Related</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const referenceLink = getReferenceLink(entry)
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.createdAt).toLocaleDateString()}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.type === 'credit' ? 'default' : 'secondary'}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(entry.type === 'credit' ? entry.amount : -entry.amount, entry.currency)}
                    </TableCell>
                    <TableCell>{entry.currency}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.referenceId || '-'}
                    </TableCell>
                    <TableCell>
                      {entry.relatedPurchase && (
                        <Badge variant="outline" className="mr-1">
                          Purchase
                        </Badge>
                      )}
                      {entry.relatedRecognition && (
                        <Badge variant="outline" className="mr-1">
                          Recognition
                        </Badge>
                      )}
                      {entry.relatedSettlement && (
                        <Badge variant="outline" className="mr-1">
                          Settlement
                        </Badge>
                      )}
                      {!entry.relatedPurchase && !entry.relatedRecognition && !entry.relatedSettlement && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {referenceLink && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={referenceLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No ledger entries found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredEntries.length > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>Total entries: {filteredEntries.length}</span>
            <span>
              Net: {formatCurrency(
                filteredEntries.reduce(
                  (sum, e) => sum + (e.type === 'credit' ? e.amount : -e.amount),
                  0
                ),
                filteredEntries[0]?.currency || 'USD'
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

