'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  User,
  XCircle,
  RotateCcw,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type RenewalStatus = 'pending' | 'approved' | 'denied' | 'withdrawn'

type TimelineEvent = {
  id: string
  timestamp: string
  status: RenewalStatus
  message: string
  actor?: string
}

type RenewalRequest = {
  id: string
  credentialId: string
  credentialName: string
  status: RenewalStatus
  submittedAt: string
  reason: string
  approvers: Array<{
    id: string
    name: string
    role: string
    status: 'pending' | 'approved' | 'denied'
  }>
  timeline: TimelineEvent[]
  documents: Array<{
    id: string
    name: string
    uploadedAt: string
  }>
  canWithdraw: boolean
  canResubmit: boolean
  denialReason?: string
}

// Mock data - replace with actual API call
const MOCK_RENEWAL: RenewalRequest = {
  id: 'renewal-1',
  credentialId: 'cred-3',
  credentialName: 'DEA License',
  status: 'pending',
  submittedAt: '2025-01-15T10:30:00Z',
  reason: 'License renewal required for continued practice',
  approvers: [
    {
      id: 'approver-1',
      name: 'Dr. Jane Smith',
      role: 'Medical Director',
      status: 'pending',
    },
    {
      id: 'approver-2',
      name: 'Dr. John Doe',
      role: 'Chief of Staff',
      status: 'pending',
    },
  ],
  timeline: [
    {
      id: 'timeline-1',
      timestamp: '2025-01-15T10:30:00Z',
      status: 'pending',
      message: 'Renewal request submitted',
      actor: 'You',
    },
    {
      id: 'timeline-2',
      timestamp: '2025-01-15T11:00:00Z',
      status: 'pending',
      message: 'Request assigned to approvers',
    },
  ],
  documents: [
    {
      id: 'doc-1',
      name: 'DEA_Application_Form.pdf',
      uploadedAt: '2025-01-15T10:30:00Z',
    },
    {
      id: 'doc-2',
      name: 'Continuing_Education_Certificate.pdf',
      uploadedAt: '2025-01-15T10:31:00Z',
    },
  ],
  canWithdraw: true,
  canResubmit: false,
}

export default function RenewalStatusPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.requestId as string
  const [renewal, setRenewal] = useState<RenewalRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch renewal request data
    const fetchRenewal = async () => {
      setLoading(true)
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500))
        setRenewal(MOCK_RENEWAL)
      } catch (error) {
        console.error('Failed to fetch renewal request:', error)
      } finally {
        setLoading(false)
      }
    }

    if (requestId) {
      fetchRenewal()
    }
  }, [requestId])

  const handleWithdraw = async () => {
    if (!renewal) return

    if (confirm('Are you sure you want to withdraw this renewal request?')) {
      try {
        // Call API to withdraw
        const response = await fetch(`/api/demo/lifecycle/renewals/${requestId}/withdraw`, {
          method: 'POST',
        })

        if (response.ok) {
          setRenewal({ ...renewal, status: 'withdrawn', canWithdraw: false })
        }
      } catch (error) {
        console.error('Failed to withdraw renewal request:', error)
      }
    }
  }

  const handleResubmit = () => {
    router.push(`/demo/lifecycle/renewals/new?credentialId=${renewal?.credentialId}`)
  }

  const getStatusConfig = (status: RenewalStatus) => {
    const configs = {
      pending: {
        label: 'Pending',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
        icon: Clock,
      },
      approved: {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        icon: CheckCircle2,
      },
      denied: {
        label: 'Denied',
        className: 'bg-rose-50 text-rose-900 border-rose-200',
        icon: XCircle,
      },
      withdrawn: {
        label: 'Withdrawn',
        className: 'bg-slate-50 text-slate-900 border-slate-200',
        icon: XCircle,
      },
    }

    return configs[status]
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!renewal) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Renewal request not found</div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(renewal.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Demo • Lifecycle • Renewal Status
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Renewal Request Status</h1>
          </div>
          <Badge variant="outline" className={cn('text-sm flex items-center gap-2', statusConfig.className)}>
            <StatusIcon className="h-4 w-4" />
            {statusConfig.label}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>Renewal request for {renewal.credentialName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Request ID</div>
                  <div className="font-mono text-sm">{renewal.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="text-sm">
                    {new Date(renewal.submittedAt).toLocaleString()}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-sm text-muted-foreground mb-1">Reason</div>
                  <div className="text-sm">{renewal.reason}</div>
                </div>
              </div>

              {renewal.denialReason && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <div className="font-medium text-destructive mb-1">Denial Reason</div>
                      <div className="text-sm">{renewal.denialReason}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Status updates and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                <div className="space-y-4">
                  {renewal.timeline.map((event, index) => {
                    const eventConfig = getStatusConfig(event.status)
                    const EventIcon = eventConfig.icon

                    return (
                      <div key={event.id} className="relative flex gap-4 pl-8">
                        <div className="absolute left-0 top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-primary" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <EventIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{event.message}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.timestamp).toLocaleString()}
                            {event.actor && (
                              <>
                                <span>•</span>
                                <span>{event.actor}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Supporting Documents</CardTitle>
              <CardDescription>Documents submitted with this request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {renewal.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Approvers */}
          <Card>
            <CardHeader>
              <CardTitle>Assigned Approvers</CardTitle>
              <CardDescription>Reviewers for this request</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {renewal.approvers.map((approver) => {
                  const approverStatusConfig = getStatusConfig(approver.status)
                  const ApproverStatusIcon = approverStatusConfig.icon

                  return (
                    <div key={approver.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">{approver.name}</div>
                            <div className="text-xs text-muted-foreground">{approver.role}</div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', approverStatusConfig.className)}
                        >
                          <ApproverStatusIcon className="h-3 w-3 mr-1" />
                          {approverStatusConfig.label}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renewal.canWithdraw && renewal.status === 'pending' && (
                <Button variant="outline" className="w-full" onClick={handleWithdraw}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Withdraw Request
                </Button>
              )}
              {renewal.canResubmit && renewal.status === 'denied' && (
                <Button variant="default" className="w-full" onClick={handleResubmit}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resubmit Request
                </Button>
              )}
              <Button variant="ghost" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

