'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, User, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface VendorReviewWorkflowProps {
  vendorId: string
  workflowId?: string
  onDecision?: (approved: boolean) => void
}

interface ChecklistItem {
  id: string
  label: string
  status: 'pending' | 'passed' | 'failed'
  notes?: string
}

interface Review {
  id: string
  reviewer: string
  reviewerRole: string
  status: 'pending' | 'approved' | 'rejected'
  comments?: string
  reviewedAt?: string
}

interface WorkflowStatus {
  id: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected'
  currentStep: number
  totalSteps: number
  checklist: ChecklistItem[]
  reviews: Review[]
  riskScore?: number
  overallComments?: string
}

export function VendorReviewWorkflow({
  vendorId,
  workflowId,
  onDecision,
}: VendorReviewWorkflowProps) {
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [decisionComments, setDecisionComments] = useState('')

  useEffect(() => {
    fetchWorkflow()
  }, [vendorId, workflowId])

  async function fetchWorkflow() {
    try {
      setLoading(true)
      const endpoint = workflowId
        ? `/api/demo/vendor/workflows/${workflowId}`
        : `/api/demo/vendor/${vendorId}/workflow`
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Failed to fetch workflow')
      const payload = await response.json()
      setWorkflow(payload.workflow || payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(approved: boolean) {
    try {
      const endpoint = workflowId
        ? `/api/demo/vendor/workflows/${workflowId}/decision`
        : `/api/demo/vendor/${vendorId}/workflow/decision`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          comments: decisionComments,
        }),
      })

      if (!response.ok) throw new Error('Failed to submit decision')

      await fetchWorkflow()
      setShowDecisionDialog(false)
      setDecision(null)
      setDecisionComments('')
      onDecision?.(approved)
    } catch (err) {
      alert(`Failed to submit decision: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function updateChecklistItem(itemId: string, status: 'passed' | 'failed', notes?: string) {
    if (!workflow) return

    const updatedChecklist = workflow.checklist.map((item) =>
      item.id === itemId ? { ...item, status, notes } : item
    )
    setWorkflow({ ...workflow, checklist: updatedChecklist })
  }

  function getStatusBadge(status: WorkflowStatus['status']) {
    const configs = {
      pending: { variant: 'outline' as const, icon: Clock, label: 'Pending' },
      in_review: { variant: 'secondary' as const, icon: Clock, label: 'In Review' },
      approved: { variant: 'default' as const, icon: CheckCircle2, label: 'Approved' },
      rejected: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
    }
    const config = configs[status] || configs.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  function getChecklistStatusBadge(status: ChecklistItem['status']) {
    switch (status) {
      case 'passed':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Passed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Loading workflow...</div>
        </CardContent>
      </Card>
    )
  }

  if (error || !workflow) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-destructive">
            Error: {error || 'Workflow not found'}
          </div>
        </CardContent>
      </Card>
    )
  }

  const progress = (workflow.currentStep / workflow.totalSteps) * 100
  const canMakeDecision = workflow.status === 'in_review' || workflow.status === 'pending'
  const allChecklistPassed = workflow.checklist.every((item) => item.status === 'passed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Review & Approval Workflow</h2>
          <p className="text-sm text-muted-foreground">
            Review vendor onboarding and make approval decisions
          </p>
        </div>
        {getStatusBadge(workflow.status)}
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Step {workflow.currentStep} of {workflow.totalSteps}
            </span>
            <span className="font-medium">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      {/* Risk Score */}
      {workflow.riskScore !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">
                {workflow.riskScore}
              </div>
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      workflow.riskScore < 30
                        ? 'bg-green-600'
                        : workflow.riskScore < 70
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${workflow.riskScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {workflow.riskScore < 30
                    ? 'Low Risk'
                    : workflow.riskScore < 70
                    ? 'Medium Risk'
                    : 'High Risk'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Due Diligence Checklist</CardTitle>
          <CardDescription>
            Review checklist items and mark as passed or failed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflow.checklist.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {getChecklistStatusBadge(item.status)}
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground">{item.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateChecklistItem(item.id, 'passed')}
                      disabled={item.status === 'passed'}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Passed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateChecklistItem(item.id, 'failed')}
                      disabled={item.status === 'failed'}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Mark Failed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>
            Reviews from internal reviewers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflow.reviews.length > 0 ? (
            workflow.reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{review.reviewer}</span>
                        {review.reviewerRole && (
                          <span className="text-sm text-muted-foreground">
                            ({review.reviewerRole})
                          </span>
                        )}
                      </div>
                      {review.status === 'approved' ? (
                        <Badge variant="default">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      ) : review.status === 'rejected' ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                    {review.comments && (
                      <p className="text-sm">{review.comments}</p>
                    )}
                    {review.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed: {new Date(review.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No reviews yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Actions */}
      {canMakeDecision && (
        <Card>
          <CardHeader>
            <CardTitle>Make Decision</CardTitle>
            <CardDescription>
              Approve or reject this vendor onboarding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!allChecklistPassed && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>Not all checklist items have been marked as passed</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setDecision('approve')
                  setShowDecisionDialog(true)
                }}
                disabled={!allChecklistPassed}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDecision('reject')
                  setShowDecisionDialog(true)
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === 'approve' ? 'Approve Vendor' : 'Reject Vendor'}
            </DialogTitle>
            <DialogDescription>
              {decision === 'approve'
                ? 'Are you sure you want to approve this vendor onboarding?'
                : 'Are you sure you want to reject this vendor onboarding? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comments (optional)</Label>
              <Textarea
                value={decisionComments}
                onChange={(e) => setDecisionComments(e.target.value)}
                placeholder="Enter any comments about your decision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={decision === 'approve' ? 'default' : 'destructive'}
              onClick={() => decision && handleDecision(decision === 'approve')}
            >
              {decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

