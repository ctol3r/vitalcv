'use client'

import { useEffect, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CreditCard,
  RefreshCw,
  Calendar,
  Building2,
  Filter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LedgerViewer } from '@/components/finance/LedgerViewer'
import { RevenueSchedule } from '@/components/finance/RevenueSchedule'
import { PayoutManager } from '@/components/finance/PayoutManager'

interface FinanceSummary {
  totalRevenue: number
  deferredRevenue: number
  recognizedRevenue: number
  pendingPayouts: number
  completedPayouts: number
  outstandingRecognitionEvents: number
  currency: string
}

interface RevenueBreakdown {
  fiat: number
  vita: number
  pending: number
  recognized: number
  settled: number
}

interface FinanceData {
  summary: FinanceSummary
  revenueBreakdown: RevenueBreakdown
  recentEvents: Array<{
    id: string
    eventType: string
    amount: number
    currency: string
    status: string
    createdAt: string
  }>
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string>('demo-org')
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [orgId, startDate, endDate])

  async function loadData() {
    try {
      const params = new URLSearchParams({
        orgId,
        startDate,
        endDate,
      })
      const response = await fetch(`/api/demo/org/finance?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load finance data (${response.status})`)
      }
      const payload = await response.json()
      setData(payload)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load finance data')
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

  if (loading && !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading finance data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load finance data</CardTitle>
            <CardDescription>{error || 'Unknown error'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Finance</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-primary" aria-hidden="true" />
              Finance Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Monitor revenue, deferred revenue, payouts, and outstanding revenue recognition events.
              Filter by organization and date range.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Organization ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(data.summary.totalRevenue, data.summary.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recognized + Deferred
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deferred Revenue</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(data.summary.deferredRevenue, data.summary.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending recognition
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognized Revenue</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(data.summary.recognizedRevenue, data.summary.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue recognized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(data.summary.pendingPayouts, data.summary.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.outstandingRecognitionEvents} outstanding events
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <CardDescription>Revenue by type and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <div className="text-sm text-muted-foreground mb-1">FIAT</div>
              <div className="text-2xl font-bold">
                {formatCurrency(data.revenueBreakdown.fiat, 'USD')}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">VITA</div>
              <div className="text-2xl font-bold">
                {formatCurrency(data.revenueBreakdown.vita, 'VITA')}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Pending</div>
              <div className="text-2xl font-bold">
                {formatCurrency(data.revenueBreakdown.pending, data.summary.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Recognized</div>
              <div className="text-2xl font-bold">
                {formatCurrency(data.revenueBreakdown.recognized, data.summary.currency)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Settled</div>
              <div className="text-2xl font-bold">
                {formatCurrency(data.revenueBreakdown.settled, data.summary.currency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Schedule</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Latest revenue recognition events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.eventType}</TableCell>
                      <TableCell>{formatCurrency(event.amount, event.currency)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.status === 'settled'
                              ? 'default'
                              : event.status === 'recognized'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(event.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recentEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No recent events
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6">
          <LedgerViewer orgId={orgId} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <RevenueSchedule orgId={orgId} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <PayoutManager orgId={orgId} startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

