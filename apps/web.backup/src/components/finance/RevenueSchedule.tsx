'use client'

import { useEffect, useState } from 'react'
import { Calendar, ChevronRight, RefreshCw, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RevenueRecognitionEntry {
  id: string
  eventId: string
  eventType: string
  orgId: string | null
  revenueType: 'VITA' | 'FIAT'
  amount: number
  recognizedAt: string
  cashSettledAt: string | null
  settlementTxId: string | null
  status: 'pending' | 'recognized' | 'settled'
  metadata: any
  createdAt: string
  updatedAt: string
}

interface RevenueScheduleProps {
  orgId: string
  startDate: string
  endDate: string
}

export function RevenueSchedule({ orgId, startDate, endDate }: RevenueScheduleProps) {
  const [entries, setEntries] = useState<RevenueRecognitionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<RevenueRecognitionEntry | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadSchedule()
  }, [orgId, startDate, endDate])

  async function loadSchedule() {
    try {
      const params = new URLSearchParams({
        orgId,
        startDate,
        endDate,
      })
      const response = await fetch(`/api/demo/org/finance/revenue-schedule?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load revenue schedule (${response.status})`)
      }
      const payload = await response.json()
      setEntries(payload.entries || [])
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load revenue schedule')
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number, currency: string = 'USD'): string {
    if (currency === 'VITA') {
      return `${amount.toLocaleString()} VITA`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100) // Amount is in cents
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Group entries by status
  const pendingEntries = entries.filter((e) => e.status === 'pending')
  const recognizedEntries = entries.filter((e) => e.status === 'recognized')
  const settledEntries = entries.filter((e) => e.status === 'settled')

  // Calculate totals
  const pendingTotal = pendingEntries.reduce((sum, e) => sum + e.amount, 0)
  const recognizedTotal = recognizedEntries.reduce((sum, e) => sum + e.amount, 0)
  const settledTotal = settledEntries.reduce((sum, e) => sum + e.amount, 0)

  // Group by event type
  const entriesByEventType = entries.reduce((acc, entry) => {
    if (!acc[entry.eventType]) {
      acc[entry.eventType] = []
    }
    acc[entry.eventType].push(entry)
    return acc
  }, {} as Record<string, RevenueRecognitionEntry[]>)

  if (loading && entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading revenue schedule…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error loading revenue schedule</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Revenue Recognition Schedule</CardTitle>
              <CardDescription>
                Visualize pending vs recognized revenue by event and time
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadSchedule}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(pendingTotal, entries[0]?.revenueType === 'VITA' ? 'VITA' : 'USD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingEntries.length} entries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recognized</CardTitle>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(recognizedTotal, entries[0]?.revenueType === 'VITA' ? 'VITA' : 'USD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {recognizedEntries.length} entries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Settled</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(settledTotal, entries[0]?.revenueType === 'VITA' ? 'VITA' : 'USD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {settledEntries.length} entries
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline View */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">By Event Type</h3>
            {Object.entries(entriesByEventType).map(([eventType, eventEntries]) => {
              const eventTotal = eventEntries.reduce((sum, e) => sum + e.amount, 0)
              const eventPending = eventEntries.filter((e) => e.status === 'pending').length
              const eventRecognized = eventEntries.filter((e) => e.status === 'recognized').length
              const eventSettled = eventEntries.filter((e) => e.status === 'settled').length

              return (
                <Card key={eventType}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{eventType}</CardTitle>
                      <Badge variant="outline">
                        {formatCurrency(eventTotal, eventEntries[0]?.revenueType === 'VITA' ? 'VITA' : 'USD')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pending:</span>
                        <span>{eventPending}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Recognized:</span>
                        <span>{eventRecognized}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Settled:</span>
                        <span>{eventSettled}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Detailed Table */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">All Entries</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Revenue Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recognized At</TableHead>
                    <TableHead>Settled At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.eventType}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.revenueType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(entry.amount, entry.revenueType)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.status === 'settled'
                              ? 'default'
                              : entry.status === 'recognized'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(entry.recognizedAt)}</TableCell>
                      <TableCell>
                        {entry.cashSettledAt ? formatDate(entry.cashSettledAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEntry(entry)
                            setShowDetails(true)
                          }}
                        >
                          View Details
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No revenue recognition entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revenue Recognition Details</DialogTitle>
            <DialogDescription>
              Detailed information about this revenue recognition entry
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Entry ID</div>
                  <div className="font-mono text-sm">{selectedEntry.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Event ID</div>
                  <div className="font-mono text-sm">{selectedEntry.eventId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Event Type</div>
                  <div>{selectedEntry.eventType}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Revenue Type</div>
                  <Badge variant="outline">{selectedEntry.revenueType}</Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Amount</div>
                  <div className="font-mono text-lg font-bold">
                    {formatCurrency(selectedEntry.amount, selectedEntry.revenueType)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <Badge
                    variant={
                      selectedEntry.status === 'settled'
                        ? 'default'
                        : selectedEntry.status === 'recognized'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {selectedEntry.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Recognized At</div>
                  <div>{formatDateTime(selectedEntry.recognizedAt)}</div>
                </div>
                {selectedEntry.cashSettledAt && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Settled At</div>
                    <div>{formatDateTime(selectedEntry.cashSettledAt)}</div>
                  </div>
                )}
                {selectedEntry.settlementTxId && (
                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">Settlement TX ID</div>
                    <div className="font-mono text-sm break-all">{selectedEntry.settlementTxId}</div>
                  </div>
                )}
              </div>
              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Metadata</div>
                  <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

