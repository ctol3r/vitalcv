'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Edit,
  Users,
  History,
  FileCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Tag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ContractStatus = 'DRAFT' | 'UNDER_REVIEW' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED'
type ContractType = 'NDA' | 'SERVICE' | 'PARTNERSHIP' | 'EMPLOYMENT' | 'VENDOR' | 'OTHER'
type SignatureStatus = 'PENDING' | 'SIGNED' | 'DECLINED'
type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type ContractEventType = 'CREATED' | 'SIGNED' | 'REVISED' | 'TERMINATED' | 'EXPIRED' | 'STATUS_CHANGED' | 'PARTY_ADDED' | 'PARTY_REMOVED'

interface Contract {
  id: string
  title: string
  slug: string
  type: ContractType
  status: ContractStatus
  effectiveDate: string | null
  expirationDate: string | null
  currentVersionId: string | null
  authorId: string
  createdAt: string
  updatedAt: string
  currentVersion?: ContractVersion
  parties: ContractParty[]
  changeRequests: ContractChangeRequest[]
  auditLogs: ContractAuditLog[]
  tags: string[]
}

interface ContractVersion {
  id: string
  versionNumber: number
  content: string
  changeSummary: string | null
  authorId: string
  createdAt: string
}

interface ContractParty {
  id: string
  organizationId: string | null
  partnerId: string | null
  contactName: string | null
  contactEmail: string | null
  role: 'SIGNER' | 'WITNESS' | 'OBSERVER'
  signatureStatus: SignatureStatus
  signedAt: string | null
}

interface ContractChangeRequest {
  id: string
  changeSummary: string
  status: ChangeRequestStatus
  requestedBy: string
  decisionBy: string | null
  decisionAt: string | null
  createdAt: string
}

interface ContractAuditLog {
  id: string
  eventType: ContractEventType
  userId: string | null
  timestamp: string
  details: Record<string, any> | null
}

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.contractId as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (contractId) {
      loadContract()
      checkPermissions()
    }
  }, [contractId])

  async function loadContract() {
    try {
      setLoading(true)
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) {
        throw new Error(`Failed to load contract (${response.status})`)
      }
      const data = await response.json()
      setContract(data.contract)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load contract')
    } finally {
      setLoading(false)
    }
  }

  async function checkPermissions() {
    // In a real app, this would check user permissions
    // For now, allow editing if status is DRAFT or UNDER_REVIEW
    if (contract) {
      setCanEdit(contract.status === 'DRAFT' || contract.status === 'UNDER_REVIEW')
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

  function getSignatureStatusBadge(status: SignatureStatus) {
    const variants: Record<SignatureStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any; label: string }> = {
      PENDING: { variant: 'outline', icon: Clock, label: 'Pending' },
      SIGNED: { variant: 'default', icon: CheckCircle2, label: 'Signed' },
      DECLINED: { variant: 'destructive', icon: XCircle, label: 'Declined' },
    }
    const { variant, icon: Icon, label } = variants[status]
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  function getChangeRequestStatusBadge(status: ChangeRequestStatus) {
    const variants: Record<ChangeRequestStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      PENDING: { variant: 'outline', label: 'Pending' },
      APPROVED: { variant: 'default', label: 'Approved' },
      REJECTED: { variant: 'destructive', label: 'Rejected' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  function formatDate(date: string | null) {
    if (!date) return 'Not set'
    return new Date(date).toLocaleString()
  }

  function renderMarkdown(content: string) {
    // Simple markdown rendering - in production, use a proper markdown library
    return (
      <div className="prose prose-sm max-w-none">
        <pre className="whitespace-pre-wrap font-sans">{content}</pre>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading contract…</div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || 'Contract not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/contracts/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/contracts/dashboard"
                className="text-sm text-muted-foreground hover:underline"
              >
                Contracts
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">{contract.title}</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
              {contract.title}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge(contract.status)}
              <Badge variant="outline">{contract.type}</Badge>
              {contract.tags.map(tag => (
                <Badge key={tag} variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => router.push(`/contracts/${contractId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contractId}/parties`)}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Parties
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="versions">Version History</TabsTrigger>
          <TabsTrigger value="changeRequests">Change Requests</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Content</CardTitle>
              <CardDescription>Read-only view of the current contract version</CardDescription>
            </CardHeader>
            <CardContent>
              {contract.currentVersion ? (
                <div className="border rounded-lg p-4 bg-muted/50">
                  {renderMarkdown(contract.currentVersion.content)}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No content available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Effective: </span>
                  <span>{formatDate(contract.effectiveDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Expiration: </span>
                  <span>{formatDate(contract.expirationDate)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Created: </span>
                  {formatDate(contract.createdAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated: </span>
                  {formatDate(contract.updatedAt)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="parties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
              <CardDescription>Organizations and individuals involved in this contract</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Signature Status</TableHead>
                    <TableHead>Signed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contract.parties.map((party) => (
                    <TableRow key={party.id}>
                      <TableCell className="font-medium">
                        {party.contactName || party.organizationId || party.partnerId || 'Unknown'}
                      </TableCell>
                      <TableCell>{party.contactEmail || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{party.role}</Badge>
                      </TableCell>
                      <TableCell>{getSignatureStatusBadge(party.signatureStatus)}</TableCell>
                      <TableCell>{formatDate(party.signedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {contract.parties.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No parties added yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>All versions of this contract</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Versions would be loaded separately */}
              <div className="text-center text-muted-foreground py-8">
                Version history loading...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changeRequests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Requests</CardTitle>
              <CardDescription>Requests to modify this contract</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contract.changeRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getChangeRequestStatusBadge(request.status)}
                            <span className="text-sm text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{request.changeSummary}</p>
                          {request.decisionBy && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Decision by {request.decisionBy} on {formatDate(request.decisionAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {contract.changeRequests.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No change requests
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete history of contract events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contract.auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 border-l-2 pl-4">
                    <div className="mt-1">
                      {log.eventType === 'SIGNED' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      {log.eventType === 'CREATED' && <FileText className="h-5 w-5 text-blue-500" />}
                      {log.eventType === 'REVISED' && <Edit className="h-5 w-5 text-purple-500" />}
                      {log.eventType === 'TERMINATED' && <XCircle className="h-5 w-5 text-red-500" />}
                      {log.eventType === 'STATUS_CHANGED' && <AlertCircle className="h-5 w-5 text-orange-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{log.eventType.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(log.timestamp)}
                        {log.userId && ` • User: ${log.userId}`}
                      </div>
                      {log.details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {contract.auditLogs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No audit log entries
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

