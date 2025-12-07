'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, RefreshCw, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface VendorContractsProps {
  vendorId: string
}

interface Contract {
  id: string
  name: string
  templateId?: string
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'pending_renewal'
  startDate: string
  endDate?: string
  expiryDate?: string
  renewalDate?: string
  signedAt?: string
  downloadUrl?: string
}

export function VendorContracts({ vendorId }: VendorContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [showRenewalDialog, setShowRenewalDialog] = useState(false)
  const [showTerminationDialog, setShowTerminationDialog] = useState(false)

  useEffect(() => {
    fetchContracts()
  }, [vendorId])

  async function fetchContracts() {
    try {
      setLoading(true)
      const response = await fetch(`/api/demo/vendor/${vendorId}/contracts`)
      if (!response.ok) throw new Error('Failed to fetch contracts')
      const payload = await response.json()
      setContracts(payload.contracts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadTemplate(contractId: string) {
    try {
      const response = await fetch(`/api/demo/vendor/contracts/${contractId}/template`)
      if (!response.ok) throw new Error('Failed to download template')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contract-${contractId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert(`Failed to download: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleInitiateRenewal(contractId: string) {
    try {
      const response = await fetch(`/api/demo/vendor/contracts/${contractId}/renewal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to initiate renewal')
      await fetchContracts()
      setShowRenewalDialog(false)
      setSelectedContract(null)
    } catch (err) {
      alert(`Failed to initiate renewal: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleTerminate(contractId: string, reason: string) {
    try {
      const response = await fetch(`/api/demo/vendor/contracts/${contractId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!response.ok) throw new Error('Failed to terminate contract')
      await fetchContracts()
      setShowTerminationDialog(false)
      setSelectedContract(null)
    } catch (err) {
      alert(`Failed to terminate: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function getStatusBadge(status: Contract['status']) {
    const variants: Record<Contract['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
      active: { variant: 'default', icon: CheckCircle2 },
      draft: { variant: 'outline', icon: FileText },
      expired: { variant: 'secondary', icon: Clock },
      terminated: { variant: 'destructive', icon: X },
      pending_renewal: { variant: 'secondary', icon: RefreshCw },
    }
    const config = variants[status] || { variant: 'outline' as const, icon: AlertCircle }
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    )
  }

  function formatDate(dateString?: string) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  function isExpiringSoon(expiryDate?: string) {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const activeContracts = contracts.filter((c) => c.status === 'active')
  const pastContracts = contracts.filter((c) => c.status === 'expired' || c.status === 'terminated')
  const pendingContracts = contracts.filter((c) => c.status === 'pending_renewal' || c.status === 'draft')

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Loading contracts...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contracts</h2>
          <p className="text-sm text-muted-foreground">
            Manage active and past contracts for this vendor
          </p>
        </div>
        <Button onClick={fetchContracts} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeContracts.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingContracts.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({pastContracts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Contracts</CardTitle>
              <CardDescription>
                Currently active contracts with this vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeContracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.name}</TableCell>
                        <TableCell>
                          {getStatusBadge(contract.status)}
                          {isExpiringSoon(contract.expiryDate) && (
                            <Badge variant="outline" className="ml-2 text-orange-600">
                              Expiring Soon
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>
                          {formatDate(contract.expiryDate)}
                          {isExpiringSoon(contract.expiryDate) && (
                            <span className="text-xs text-orange-600 ml-1">⚠️</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadTemplate(contract.id)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedContract(contract)
                                setShowRenewalDialog(true)
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Renew
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedContract(contract)
                                setShowTerminationDialog(true)
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Terminate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No active contracts
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Contracts</CardTitle>
              <CardDescription>
                Contracts awaiting approval or renewal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingContracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.name}</TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadTemplate(contract.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            View Template
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No pending contracts
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past">
          <Card>
            <CardHeader>
              <CardTitle>Past Contracts</CardTitle>
              <CardDescription>
                Expired or terminated contracts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pastContracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.name}</TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>{formatDate(contract.endDate || contract.expiryDate)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadTemplate(contract.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No past contracts
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Renewal Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Contract Renewal</DialogTitle>
            <DialogDescription>
              Are you sure you want to initiate renewal for {selectedContract?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedContract && handleInitiateRenewal(selectedContract.id)}
            >
              Initiate Renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Termination Dialog */}
      <Dialog open={showTerminationDialog} onOpenChange={setShowTerminationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Contract</DialogTitle>
            <DialogDescription>
              Please provide a reason for terminating {selectedContract?.name}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <textarea
                className="w-full min-h-[100px] rounded-md border p-2"
                placeholder="Enter termination reason..."
                id="termination-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerminationDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const reason = (document.getElementById('termination-reason') as HTMLTextAreaElement)?.value || ''
                if (selectedContract) {
                  handleTerminate(selectedContract.id, reason)
                }
              }}
            >
              Terminate Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

