'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Snowflake,
  AlertCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type CredentialSuspensionProps = {
  credentialId: string
  credentialName: string
  currentFreezeStatus?: {
    frozen: boolean
    reason?: string
    frozenAt?: string
    frozenUntil?: string
    frozenBy?: string
  }
  onFreeze?: (data: FreezeData) => Promise<void>
  onLift?: () => Promise<void>
}

type FreezeData = {
  credentialId: string
  reason: string
  frozenUntil?: string
}

export function CredentialSuspension({
  credentialId,
  credentialName,
  currentFreezeStatus,
  onFreeze,
  onLift,
}: CredentialSuspensionProps) {
  const [reason, setReason] = useState('')
  const [frozenUntil, setFrozenUntil] = useState('')
  const [showFreezeDialog, setShowFreezeDialog] = useState(false)
  const [showLiftDialog, setShowLiftDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFreeze = async () => {
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const freezeData: FreezeData = {
        credentialId,
        reason,
        frozenUntil: frozenUntil || undefined,
      }

      if (onFreeze) {
        await onFreeze(freezeData)
      } else {
        // Default freeze - call CredentialFreeze service
        const response = await fetch(`/api/demo/lifecycle/credentials/${credentialId}/freeze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(freezeData),
        })

        if (!response.ok) {
          throw new Error('Failed to freeze credential')
        }
      }

      setShowFreezeDialog(false)
      setReason('')
      setFrozenUntil('')
      // Refresh page or update state
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to freeze credential')
    } finally {
      setLoading(false)
    }
  }

  const handleLift = async () => {
    setLoading(true)
    setError(null)

    try {
      if (onLift) {
        await onLift()
      } else {
        const response = await fetch(`/api/demo/lifecycle/credentials/${credentialId}/lift-freeze`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to lift freeze')
        }
      }

      setShowLiftDialog(false)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lift freeze')
    } finally {
      setLoading(false)
    }
  }

  const isFrozen = currentFreezeStatus?.frozen ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Snowflake className="h-5 w-5" />
          Credential Suspension
        </CardTitle>
        <CardDescription>
          Apply or lift a credential freeze for <strong>{credentialName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Freeze Status */}
        {isFrozen && currentFreezeStatus && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                    <Snowflake className="h-3 w-3 mr-1" />
                    Currently Frozen
                  </Badge>
                </div>
                {currentFreezeStatus.reason && (
                  <div>
                    <div className="text-sm font-medium mb-1">Reason</div>
                    <div className="text-sm text-muted-foreground">{currentFreezeStatus.reason}</div>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  {currentFreezeStatus.frozenAt && (
                    <div>
                      <div className="text-muted-foreground">Frozen At</div>
                      <div className="font-medium">
                        {new Date(currentFreezeStatus.frozenAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {currentFreezeStatus.frozenUntil && (
                    <div>
                      <div className="text-muted-foreground">Frozen Until</div>
                      <div className="font-medium">
                        {new Date(currentFreezeStatus.frozenUntil).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {currentFreezeStatus.frozenBy && (
                    <div className="sm:col-span-2">
                      <div className="text-muted-foreground">Frozen By</div>
                      <div className="font-medium">{currentFreezeStatus.frozenBy}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Freeze Form */}
        {!isFrozen && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Freeze <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for freezing this credential..."
                rows={4}
                className={cn(error && 'border-destructive')}
              />
              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frozenUntil">Frozen Until (Optional)</Label>
              <Input
                id="frozenUntil"
                type="datetime-local"
                value={frozenUntil}
                onChange={(e) => setFrozenUntil(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for indefinite freeze. Can be lifted manually later.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-muted-foreground">
                  Freezing a credential temporarily suspends its use. The credential remains in the
                  system but cannot be verified or used until the freeze is lifted.
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowFreezeDialog(true)}
              className="w-full"
            >
              <Snowflake className="h-4 w-4 mr-2" />
              Apply Freeze
            </Button>
          </div>
        )}

        {/* Lift Freeze */}
        {isFrozen && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-muted-foreground">
                  Lifting the freeze will restore the credential to active status. This action will
                  be logged in the audit trail.
                </p>
              </div>
            </div>

            <Button
              variant="default"
              onClick={() => setShowLiftDialog(true)}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Lift Freeze
            </Button>
          </div>
        )}

        {/* Freeze Confirmation Dialog */}
        <AlertDialog open={showFreezeDialog} onOpenChange={setShowFreezeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Credential Freeze</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to freeze <strong>{credentialName}</strong>? This action
                will prevent the credential from being verified or used.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Reason:</div>
                <div className="text-sm text-muted-foreground">{reason || 'Not specified'}</div>
              </div>
              {frozenUntil && (
                <div className="space-y-2 mt-4">
                  <div className="text-sm font-medium">Frozen Until:</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(frozenUntil).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleFreeze} disabled={loading}>
                {loading ? 'Freezing...' : 'Confirm Freeze'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lift Freeze Confirmation Dialog */}
        <AlertDialog open={showLiftDialog} onOpenChange={setShowLiftDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Lift Freeze</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to lift the freeze on <strong>{credentialName}</strong>? The
                credential will be restored to active status.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLift} disabled={loading}>
                {loading ? 'Lifting...' : 'Confirm Lift'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

