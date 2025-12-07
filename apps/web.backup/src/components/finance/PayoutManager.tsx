'use client'

import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw, Send, Eye, Building2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface Payout {
  id: string
  vendorId: string
  vendorName: string
  orgId: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  initiatedAt: string | null
  completedAt: string | null
  transactionId: string | null
  metadata: any
  createdAt: string
  updatedAt: string
}

interface PayoutManagerProps {
  orgId: string
  startDate: string
  endDate: string
}

export function PayoutManager({ orgId, startDate, endDate }: PayoutManagerProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showInitiateDialog, setShowInitiateDialog] = useState(false)
  const [initiateForm, setInitiateForm] = useState({
    vendorId: '',
    amount: '',
    currency: 'USD',
  })

  useEffect(() => {
    loadPayouts()
  }, [orgId, startDate, endDate])

  async function loadPayouts() {
    try {
      const params = new URLSearchParams({
        orgId,
        startDate,
        endDate,
      })
      const response = await fetch(`/api/demo/org/finance/payouts?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load payouts (${response.status})`)
      }
      const payload = await response.json()
      setPayouts(payload.payouts || [])
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load payouts')
    } finally {
      setLoading(false)
    }
  }

  async function initiatePayout() {
    try {
      const response = await fetch('/api/demo/org/finance/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: initiateForm.vendorId,
          amount: parseFloat(initiateForm.amount) * 100, // Convert to cents
          currency: initiateForm.currency,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to initiate payout')
      }
      setShowInitiateDialog(false)
      setInitiateForm({ vendorId: '', amount: '', currency: 'USD' })
      await loadPayouts()
    } catch (err: any) {
      setError(err.message)
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

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingPayouts = payouts.filter((p) => p.status === 'pending' || p.status === 'processing')
  const completedPayouts = payouts.filter((p) => p.status === 'completed')
  const failedPayouts = payouts.filter((p) => p.status === 'failed')

  const pendingTotal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0)
  const completedTotal = completedPayouts.reduce((sum, p) => sum + p.amount, 0)

  // Group by vendor
  const payoutsByVendor = payouts.reduce((acc, payout) => {
    if (!acc[payout.vendorId]) {
      acc[payout.vendorId] = {
        vendorName: payout.vendorName,
        payouts: [],
      }
    }
    acc[payout.vendorId].payouts.push(payout)
    return acc
  }, {} as Record<string, { vendorName: string; payouts: Payout[] }>)

  if (loading && payouts.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading payouts…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error loading payouts</CardTitle>
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
              <CardTitle>Payout Management</CardTitle>
              <CardDescription>
                Manage pending and completed payouts per vendor/organization
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadPayouts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowInitiateDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                Initiate Payout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(pendingTotal, payouts[0]?.currency || 'USD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingPayouts.length} payout{pendingPayouts.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(completedTotal, payouts[0]?.currency || 'USD')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completedPayouts.length} payout{completedPayouts.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Payouts</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="by-vendor">By Vendor</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Initiated</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="font-medium">{payout.vendorName}</div>
                          <div className="text-sm text-muted-foreground">{payout.vendorId}</div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(payout.amount, payout.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payout.status === 'completed'
                                ? 'default'
                                : payout.status === 'processing'
                                  ? 'secondary'
                                  : payout.status === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                            }
                          >
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(payout.initiatedAt)}</TableCell>
                        <TableCell>{formatDate(payout.completedAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayout(payout)
                              setShowDetails(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payouts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No payouts found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="font-medium">{payout.vendorName}</div>
                          <div className="text-sm text-muted-foreground">{payout.vendorId}</div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(payout.amount, payout.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payout.status === 'processing' ? 'secondary' : 'outline'}>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(payout.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayout(payout)
                              setShowDetails(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingPayouts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No pending payouts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="font-medium">{payout.vendorName}</div>
                          <div className="text-sm text-muted-foreground">{payout.vendorId}</div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(payout.amount, payout.currency)}
                        </TableCell>
                        <TableCell>{formatDate(payout.completedAt)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {payout.transactionId || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayout(payout)
                              setShowDetails(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {completedPayouts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No completed payouts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="by-vendor" className="space-y-4">
              {Object.entries(payoutsByVendor).map(([vendorId, vendorData]) => {
                const vendorTotal = vendorData.payouts.reduce((sum, p) => sum + p.amount, 0)
                const vendorPending = vendorData.payouts.filter(
                  (p) => p.status === 'pending' || p.status === 'processing'
                ).length
                const vendorCompleted = vendorData.payouts.filter((p) => p.status === 'completed').length

                return (
                  <Card key={vendorId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{vendorData.vendorName}</CardTitle>
                          <CardDescription>{vendorId}</CardDescription>
                        </div>
                        <Badge variant="outline">
                          {formatCurrency(vendorTotal, vendorData.payouts[0]?.currency || 'USD')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Payouts:</span>
                          <span>{vendorData.payouts.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Pending:</span>
                          <span>{vendorPending}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Completed:</span>
                          <span>{vendorCompleted}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {Object.keys(payoutsByVendor).length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No payouts by vendor
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
            <DialogDescription>Detailed information about this payout</DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payout ID</div>
                  <div className="font-mono text-sm">{selectedPayout.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Vendor</div>
                  <div>{selectedPayout.vendorName}</div>
                  <div className="text-xs text-muted-foreground">{selectedPayout.vendorId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Amount</div>
                  <div className="font-mono text-lg font-bold">
                    {formatCurrency(selectedPayout.amount, selectedPayout.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <Badge
                    variant={
                      selectedPayout.status === 'completed'
                        ? 'default'
                        : selectedPayout.status === 'processing'
                          ? 'secondary'
                          : selectedPayout.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                    }
                  >
                    {selectedPayout.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Created At</div>
                  <div>{formatDateTime(selectedPayout.createdAt)}</div>
                </div>
                {selectedPayout.initiatedAt && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Initiated At</div>
                    <div>{formatDateTime(selectedPayout.initiatedAt)}</div>
                  </div>
                )}
                {selectedPayout.completedAt && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Completed At</div>
                    <div>{formatDateTime(selectedPayout.completedAt)}</div>
                  </div>
                )}
                {selectedPayout.transactionId && (
                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">Transaction ID</div>
                    <div className="font-mono text-sm break-all">{selectedPayout.transactionId}</div>
                  </div>
                )}
              </div>
              {selectedPayout.metadata && Object.keys(selectedPayout.metadata).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Metadata</div>
                  <pre className="bg-muted p-4 rounded-md text-xs overflow-auto">
                    {JSON.stringify(selectedPayout.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Initiate Payout Dialog */}
      <Dialog open={showInitiateDialog} onOpenChange={setShowInitiateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Manual Payout</DialogTitle>
            <DialogDescription>
              Create a new payout for a vendor/organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor ID</Label>
              <Input
                id="vendorId"
                value={initiateForm.vendorId}
                onChange={(e) => setInitiateForm({ ...initiateForm, vendorId: e.target.value })}
                placeholder="Enter vendor ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={initiateForm.amount}
                onChange={(e) => setInitiateForm({ ...initiateForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={initiateForm.currency}
                onValueChange={(value) => setInitiateForm({ ...initiateForm, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="VITA">VITA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitiateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={initiatePayout}>Initiate Payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

