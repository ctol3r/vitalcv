'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  Upload,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TemplateLibrary } from '@/components/contracts/TemplateLibrary'
import { PartnerOnboardingWizard } from '@/components/contracts/PartnerOnboardingWizard'
import { SignedContractViewer } from '@/components/contracts/SignedContractViewer'

interface Contract {
  id: string
  counterpartyId: string
  counterpartyName: string
  templateId?: string
  templateName?: string
  status: 'draft' | 'negotiating' | 'signed' | 'terminated'
  effectiveDate?: string
  expiryDate?: string
  revenueShareId?: string
  createdAt: string
  updatedAt: string
  commentCount?: number
}

interface ContractComment {
  id: string
  contractId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

interface ContractTimelineEvent {
  id: string
  contractId: string
  eventType: 'created' | 'status_changed' | 'comment_added' | 'signed' | 'terminated'
  description: string
  userId: string
  userName: string
  timestamp: string
  metadata?: Record<string, any>
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string>('demo-org')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false)
  const [comments, setComments] = useState<Record<string, ContractComment[]>>({})
  const [timeline, setTimeline] = useState<Record<string, ContractTimelineEvent[]>>({})

  useEffect(() => {
    loadContracts()
    const interval = setInterval(loadContracts, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [orgId, statusFilter])

  async function loadContracts() {
    try {
      const params = new URLSearchParams({
        orgId,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const response = await fetch(`/api/demo/org/contracts?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load contracts (${response.status})`)
      }
      const payload = await response.json()
      setContracts(payload.contracts || [])

      // Load comments and timeline for each contract
      for (const contract of payload.contracts || []) {
        await loadContractDetails(contract.id)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load contracts')
    } finally {
      setLoading(false)
    }
  }

  async function loadContractDetails(contractId: string) {
    try {
      const [commentsRes, timelineRes] = await Promise.all([
        fetch(`/api/demo/org/contracts/${contractId}/comments`),
        fetch(`/api/demo/org/contracts/${contractId}/timeline`),
      ])

      if (commentsRes.ok) {
        const commentsData = await commentsRes.json()
        setComments((prev) => ({ ...prev, [contractId]: commentsData.comments || [] }))
      }

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json()
        setTimeline((prev) => ({ ...prev, [contractId]: timelineData.events || [] }))
      }
    } catch (err) {
      console.error('Failed to load contract details:', err)
    }
  }

  function getStatusBadge(status: Contract['status']) {
    const variants: Record<Contract['status'], { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
      draft: { variant: 'outline', icon: FileText },
      negotiating: { variant: 'secondary', icon: Clock },
      signed: { variant: 'default', icon: CheckCircle2 },
      terminated: { variant: 'destructive', icon: XCircle },
    }
    const { variant, icon: Icon } = variants[status]
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      searchQuery === '' ||
      contract.counterpartyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.templateName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Contracts</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
              Contract Manager
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              View, create, negotiate, and sign contracts with partners. Track status, manage terms, and collaborate through commentary threads.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showTemplateLibrary} onOpenChange={setShowTemplateLibrary}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Contract Template Library</DialogTitle>
                  <DialogDescription>
                    Browse and select contract templates to create new contracts
                  </DialogDescription>
                </DialogHeader>
                <TemplateLibrary
                  onSelectTemplate={(templateId) => {
                    setShowTemplateLibrary(false)
                    setShowOnboardingWizard(true)
                  }}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showOnboardingWizard} onOpenChange={setShowOnboardingWizard}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Partner Onboarding</DialogTitle>
                  <DialogDescription>
                    Create a new contract with a partner organization
                  </DialogDescription>
                </DialogHeader>
                <PartnerOnboardingWizard
                  orgId={orgId}
                  onComplete={(contractId) => {
                    setShowOnboardingWizard(false)
                    loadContracts()
                  }}
                  onCancel={() => setShowOnboardingWizard(false)}
                />
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={loadContracts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
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
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by partner or template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="negotiating">Negotiating</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Organization ID"
              />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.counterpartyName}</TableCell>
                  <TableCell>{contract.templateName || 'Custom'}</TableCell>
                  <TableCell>{getStatusBadge(contract.status)}</TableCell>
                  <TableCell>
                    {contract.effectiveDate
                      ? new Date(contract.effectiveDate).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {contract.expiryDate
                      ? new Date(contract.expiryDate).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>{comments[contract.id]?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedContract(contract)}
                      >
                        View
                      </Button>
                      {contract.status === 'signed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedContract(contract)
                          }}
                        >
                          <FileCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No contracts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Contract Detail Dialog */}
      {selectedContract && (
        <Dialog open={!!selectedContract} onOpenChange={(open) => !open && setSelectedContract(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contract Details</DialogTitle>
              <DialogDescription>
                {selectedContract.counterpartyName} - {selectedContract.templateName || 'Custom Contract'}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                {selectedContract.status === 'signed' && (
                  <TabsTrigger value="document">Signed Document</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {getStatusBadge(selectedContract.status)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Dates</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Effective: </span>
                        {selectedContract.effectiveDate
                          ? new Date(selectedContract.effectiveDate).toLocaleDateString()
                          : 'Not set'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expiry: </span>
                        {selectedContract.expiryDate
                          ? new Date(selectedContract.expiryDate).toLocaleDateString()
                          : 'Not set'}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <div className="space-y-4">
                  {(timeline[selectedContract.id] || []).map((event) => (
                    <Card key={event.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="mt-1">
                            {event.eventType === 'signed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {event.eventType === 'status_changed' && <Clock className="h-5 w-5 text-blue-500" />}
                            {event.eventType === 'comment_added' && <MessageSquare className="h-5 w-5 text-purple-500" />}
                            {event.eventType === 'created' && <FileText className="h-5 w-5 text-gray-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{event.description}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {event.userName} • {new Date(event.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!timeline[selectedContract.id] || timeline[selectedContract.id].length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No timeline events
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <div className="space-y-4">
                  {(comments[selectedContract.id] || []).map((comment) => (
                    <Card key={comment.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                          <div className="flex-1">
                            <div className="font-medium">{comment.authorName}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {new Date(comment.createdAt).toLocaleString()}
                            </div>
                            <div className="mt-2">{comment.content}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!comments[selectedContract.id] || comments[selectedContract.id].length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No comments yet
                    </div>
                  )}
                </div>
              </TabsContent>

              {selectedContract.status === 'signed' && (
                <TabsContent value="document">
                  <SignedContractViewer contractId={selectedContract.id} />
                </TabsContent>
              )}
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedContract(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

