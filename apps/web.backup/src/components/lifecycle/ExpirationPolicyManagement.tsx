/**
 * B238B-LIFE-011: ExpirationPolicyManagement UI
 *
 * Allows admins to define and update expiry policies per credential type:
 * validity period, grace period, renewal requirements; includes validation and preview.
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar, Clock, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExpirationPolicy {
  id?: string
  credentialType: string
  validityPeriodDays: number
  gracePeriodDays: number
  renewalRequired: boolean
  renewalNoticeDays: number
  autoRenewalEnabled: boolean
  metadata?: Record<string, unknown>
}

interface ExpirationPolicyManagementProps {
  orgId?: string
  onSave?: (policy: ExpirationPolicy) => Promise<void>
  existingPolicies?: ExpirationPolicy[]
  className?: string
}

const CREDENTIAL_TYPES = [
  'LICENSE',
  'BOARD_CERTIFICATION',
  'DEA',
  'PECOS',
  'CAQH',
  'MALPRACTICE_INSURANCE',
  'CONTINUING_EDUCATION',
  'OTHER',
]

export function ExpirationPolicyManagement({
  orgId,
  onSave,
  existingPolicies = [],
  className,
}: ExpirationPolicyManagementProps) {
  const [selectedCredentialType, setSelectedCredentialType] = useState<string>('')
  const [policies, setPolicies] = useState<Map<string, ExpirationPolicy>>(
    new Map(existingPolicies.map(p => [p.credentialType, p]))
  )
  const [formData, setFormData] = useState<Partial<ExpirationPolicy>>({
    validityPeriodDays: 365,
    gracePeriodDays: 30,
    renewalRequired: true,
    renewalNoticeDays: 90,
    autoRenewalEnabled: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const currentPolicy = selectedCredentialType
    ? policies.get(selectedCredentialType)
    : undefined

  useEffect(() => {
    if (currentPolicy) {
      setFormData(currentPolicy)
    } else {
      setFormData({
        validityPeriodDays: 365,
        gracePeriodDays: 30,
        renewalRequired: true,
        renewalNoticeDays: 90,
        autoRenewalEnabled: false,
      })
    }
    setErrors({})
    setSaveSuccess(false)
  }, [selectedCredentialType, currentPolicy])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selectedCredentialType) {
      newErrors.credentialType = 'Credential type is required'
    }

    if (!formData.validityPeriodDays || formData.validityPeriodDays < 1) {
      newErrors.validityPeriodDays = 'Validity period must be at least 1 day'
    }

    if (formData.gracePeriodDays === undefined || formData.gracePeriodDays < 0) {
      newErrors.gracePeriodDays = 'Grace period must be 0 or greater'
    }

    if (formData.renewalNoticeDays === undefined || formData.renewalNoticeDays < 0) {
      newErrors.renewalNoticeDays = 'Renewal notice days must be 0 or greater'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    setSaveSuccess(false)

    try {
      const policy: ExpirationPolicy = {
        id: currentPolicy?.id,
        credentialType: selectedCredentialType,
        validityPeriodDays: formData.validityPeriodDays!,
        gracePeriodDays: formData.gracePeriodDays!,
        renewalRequired: formData.renewalRequired ?? true,
        renewalNoticeDays: formData.renewalNoticeDays!,
        autoRenewalEnabled: formData.autoRenewalEnabled ?? false,
        metadata: formData.metadata,
      }

      if (onSave) {
        await onSave(policy)
      }

      // Update local state
      setPolicies(new Map(policies.set(selectedCredentialType, policy)))
      setSaveSuccess(true)

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to save policy',
      })
    } finally {
      setSaving(false)
    }
  }

  const calculateExpirationDate = (): Date | null => {
    if (!formData.validityPeriodDays) return null
    const date = new Date()
    date.setDate(date.getDate() + formData.validityPeriodDays)
    return date
  }

  const calculateGracePeriodEnd = (): Date | null => {
    const expirationDate = calculateExpirationDate()
    if (!expirationDate || !formData.gracePeriodDays) return null
    const date = new Date(expirationDate)
    date.setDate(date.getDate() + formData.gracePeriodDays)
    return date
  }

  const calculateRenewalNoticeDate = (): Date | null => {
    const expirationDate = calculateExpirationDate()
    if (!expirationDate || !formData.renewalNoticeDays) return null
    const date = new Date(expirationDate)
    date.setDate(date.getDate() - formData.renewalNoticeDays)
    return date
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Expiration Policy Management</CardTitle>
          <CardDescription>
            Define and update expiry policies per credential type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credential Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="credentialType">Credential Type</Label>
            <Select
              value={selectedCredentialType}
              onValueChange={(value) => {
                setSelectedCredentialType(value)
                setFormData({ ...formData, credentialType: value })
              }}
            >
              <SelectTrigger id="credentialType">
                <SelectValue placeholder="Select credential type" />
              </SelectTrigger>
              <SelectContent>
                {CREDENTIAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.credentialType && (
              <p className="text-sm text-destructive">{errors.credentialType}</p>
            )}
          </div>

          {selectedCredentialType && (
            <>
              {/* Validity Period */}
              <div className="space-y-2">
                <Label htmlFor="validityPeriodDays">Validity Period (days)</Label>
                <Input
                  id="validityPeriodDays"
                  type="number"
                  min="1"
                  value={formData.validityPeriodDays || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      validityPeriodDays: parseInt(e.target.value, 10),
                    })
                  }
                />
                {errors.validityPeriodDays && (
                  <p className="text-sm text-destructive">{errors.validityPeriodDays}</p>
                )}
              </div>

              {/* Grace Period */}
              <div className="space-y-2">
                <Label htmlFor="gracePeriodDays">Grace Period (days)</Label>
                <Input
                  id="gracePeriodDays"
                  type="number"
                  min="0"
                  value={formData.gracePeriodDays || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gracePeriodDays: parseInt(e.target.value, 10),
                    })
                  }
                />
                {errors.gracePeriodDays && (
                  <p className="text-sm text-destructive">{errors.gracePeriodDays}</p>
                )}
              </div>

              {/* Renewal Notice Days */}
              <div className="space-y-2">
                <Label htmlFor="renewalNoticeDays">Renewal Notice (days before expiration)</Label>
                <Input
                  id="renewalNoticeDays"
                  type="number"
                  min="0"
                  value={formData.renewalNoticeDays || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      renewalNoticeDays: parseInt(e.target.value, 10),
                    })
                  }
                />
                {errors.renewalNoticeDays && (
                  <p className="text-sm text-destructive">{errors.renewalNoticeDays}</p>
                )}
              </div>

              {/* Renewal Required */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="renewalRequired">Renewal Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Require renewal before expiration
                  </p>
                </div>
                <Switch
                  id="renewalRequired"
                  checked={formData.renewalRequired ?? true}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, renewalRequired: checked })
                  }
                />
              </div>

              {/* Auto Renewal */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoRenewalEnabled">Auto Renewal</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically renew credentials when possible
                  </p>
                </div>
                <Switch
                  id="autoRenewalEnabled"
                  checked={formData.autoRenewalEnabled ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoRenewalEnabled: checked })
                  }
                />
              </div>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Policy Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Expiration Date:</span>
                    <span className="font-medium">
                      {calculateExpirationDate()?.toLocaleDateString() || 'N/A'}
                    </span>
                  </div>
                  {formData.gracePeriodDays && formData.gracePeriodDays > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Grace Period Ends:</span>
                      <span className="font-medium">
                        {calculateGracePeriodEnd()?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                  )}
                  {formData.renewalNoticeDays && formData.renewalNoticeDays > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Renewal Notice Date:</span>
                      <span className="font-medium">
                        {calculateRenewalNoticeDate()?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {currentPolicy ? 'Update Policy' : 'Create Policy'}
                    </>
                  )}
                </Button>
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Policy saved successfully
                  </div>
                )}
              </div>

              {errors.submit && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.submit}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Existing Policies List */}
      {policies.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Policies</CardTitle>
            <CardDescription>Policies already configured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(policies.values()).map((policy) => (
                <div
                  key={policy.credentialType}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{policy.credentialType.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-muted-foreground">
                      Validity: {policy.validityPeriodDays} days • Grace: {policy.gracePeriodDays}{' '}
                      days
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {policy.autoRenewalEnabled && (
                      <Badge variant="secondary">Auto Renewal</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCredentialType(policy.credentialType)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

