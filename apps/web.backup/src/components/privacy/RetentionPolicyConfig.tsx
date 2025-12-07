'use client'

import { useState, useEffect } from 'react'
import { Calendar, AlertTriangle, Info, Save, Trash2 } from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
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

type DataType = 'credentials' | 'logs' | 'contracts' | 'shares' | 'notifications'
type RetentionPeriod = 'indefinite' | 'custom' | '1year' | '3years' | '5years' | '7years' | '10years'

interface RetentionPolicy {
  id: string
  dataType: DataType
  period: RetentionPeriod
  customDays?: number
  status: 'active' | 'pending' | 'expired'
  lastModified: string
  modifiedBy: string
  regulatoryCompliant: boolean
  warningMessage?: string
}

const DATA_TYPES: { value: DataType; label: string; description: string }[] = [
  {
    value: 'credentials',
    label: 'Credentials',
    description: 'Verifiable credentials and certificates',
  },
  {
    value: 'logs',
    label: 'Audit Logs',
    description: 'Activity and access logs',
  },
  {
    value: 'contracts',
    label: 'Contracts',
    description: 'Signed agreements and contracts',
  },
  {
    value: 'shares',
    label: 'Data Shares',
    description: 'History of data sharing events',
  },
  {
    value: 'notifications',
    label: 'Notifications',
    description: 'System and user notifications',
  },
]

const RETENTION_OPTIONS: { value: RetentionPeriod; label: string; compliant: boolean }[] = [
  { value: 'indefinite', label: 'Indefinite', compliant: true },
  { value: '1year', label: '1 Year', compliant: false },
  { value: '3years', label: '3 Years', compliant: true },
  { value: '5years', label: '5 Years', compliant: true },
  { value: '7years', label: '7 Years', compliant: true },
  { value: '10years', label: '10 Years', compliant: true },
  { value: 'custom', label: 'Custom', compliant: false },
]

const REGULATORY_SUGGESTIONS: Record<DataType, { period: RetentionPeriod; reason: string }> = {
  credentials: {
    period: 'indefinite',
    reason: 'Credentials should be retained indefinitely for verification purposes',
  },
  logs: {
    period: '7years',
    reason: 'HIPAA requires audit logs to be retained for 6 years minimum',
  },
  contracts: {
    period: '10years',
    reason: 'Legal contracts typically require 10-year retention',
  },
  shares: {
    period: '7years',
    reason: 'Data sharing history should match audit log retention',
  },
  notifications: {
    period: '1year',
    reason: 'Notifications can be retained for shorter periods',
  },
}

export default function RetentionPolicyConfig() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ open: boolean; policy: RetentionPolicy | null }>(
    { open: false, policy: null }
  )

  useEffect(() => {
    loadPolicies()
  }, [])

  async function loadPolicies() {
    try {
      const res = await fetch('/api/demo/privacy/retention')
      if (res.ok) {
        const data = await res.json()
        setPolicies(data.policies || mockRetentionPolicies())
      } else {
        setPolicies(mockRetentionPolicies())
      }
    } catch (err) {
      setPolicies(mockRetentionPolicies())
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(policy: RetentionPolicy) {
    setEditingPolicy({ ...policy })
  }

  function handleSave() {
    if (!editingPolicy) return

    setPolicies((prev) =>
      prev.map((p) => (p.id === editingPolicy.id ? { ...editingPolicy, status: 'active' } : p))
    )
    setEditingPolicy(null)
  }

  function handleDelete(policy: RetentionPolicy) {
    setPolicies((prev) => prev.filter((p) => p.id !== policy.id))
    setShowDeleteDialog({ open: false, policy: null })
  }

  function applyRegulatorySuggestion(dataType: DataType) {
    const suggestion = REGULATORY_SUGGESTIONS[dataType]
    if (editingPolicy) {
      setEditingPolicy({
        ...editingPolicy,
        period: suggestion.period,
        regulatoryCompliant: true,
        warningMessage: undefined,
      })
    }
  }

  function getPeriodDays(period: RetentionPeriod, customDays?: number): number | null {
    if (period === 'indefinite') return null
    if (period === 'custom') return customDays || null
    const yearMap: Record<string, number> = {
      '1year': 365,
      '3years': 1095,
      '5years': 1825,
      '7years': 2555,
      '10years': 3650,
    }
    return yearMap[period] || null
  }

  function formatPeriod(period: RetentionPeriod, customDays?: number): string {
    if (period === 'indefinite') return 'Indefinite'
    if (period === 'custom' && customDays) return `${customDays} days`
    const label = RETENTION_OPTIONS.find((opt) => opt.value === period)?.label
    return label || period
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading retention policies...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Retention Policy Configuration
          </CardTitle>
          <CardDescription>
            Set retention periods for different data types. Policies help ensure compliance with
            regulations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Type</TableHead>
                <TableHead>Retention Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => {
                const isEditing = editingPolicy?.id === policy.id
                return (
                  <TableRow key={policy.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {DATA_TYPES.find((dt) => dt.value === policy.dataType)?.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {DATA_TYPES.find((dt) => dt.value === policy.dataType)?.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Select
                            value={editingPolicy.period}
                            onValueChange={(value) =>
                              setEditingPolicy({
                                ...editingPolicy,
                                period: value as RetentionPeriod,
                                customDays: value === 'custom' ? editingPolicy.customDays : undefined,
                              })
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RETENTION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {editingPolicy.period === 'custom' && (
                            <Input
                              type="number"
                              placeholder="Days"
                              value={editingPolicy.customDays || ''}
                              onChange={(e) =>
                                setEditingPolicy({
                                  ...editingPolicy,
                                  customDays: parseInt(e.target.value) || undefined,
                                })
                              }
                              className="w-32"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{formatPeriod(policy.period, policy.customDays)}</span>
                          {policy.regulatoryCompliant && (
                            <Badge variant="default" className="text-xs">
                              Compliant
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          policy.status === 'active'
                            ? 'default'
                            : policy.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {policy.regulatoryCompliant ? (
                        <Badge variant="default" className="text-xs">
                          <Info className="w-3 h-3 mr-1" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Review
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={handleSave}>
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPolicy(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(policy)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDeleteDialog({ open: true, policy })}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editing Panel */}
      {editingPolicy && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Retention Policy</CardTitle>
            <CardDescription>
              Configure retention period for{' '}
              {DATA_TYPES.find((dt) => dt.value === editingPolicy.dataType)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Regulatory Suggestion */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Regulatory Suggestion</div>
                <div className="text-sm">
                  {REGULATORY_SUGGESTIONS[editingPolicy.dataType].reason}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => applyRegulatorySuggestion(editingPolicy.dataType)}
                >
                  Apply Suggested Period ({formatPeriod(REGULATORY_SUGGESTIONS[editingPolicy.dataType].period)})
                </Button>
              </AlertDescription>
            </Alert>

            {/* Warning for Deletions */}
            {editingPolicy.period !== 'indefinite' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Data Deletion Warning</div>
                  <div className="text-sm">
                    Data older than {formatPeriod(editingPolicy.period, editingPolicy.customDays)}{' '}
                    will be automatically deleted. This action cannot be undone.
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Policy Details */}
            <div className="space-y-2">
              <Label>Retention Period</Label>
              <Select
                value={editingPolicy.period}
                onValueChange={(value) =>
                  setEditingPolicy({
                    ...editingPolicy,
                    period: value as RetentionPeriod,
                    customDays: value === 'custom' ? editingPolicy.customDays : undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingPolicy.period === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Period (Days)</Label>
                <Input
                  type="number"
                  placeholder="Enter number of days"
                  value={editingPolicy.customDays || ''}
                  onChange={(e) =>
                    setEditingPolicy({
                      ...editingPolicy,
                      customDays: parseInt(e.target.value) || undefined,
                    })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4" />
            About Retention Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">What are retention policies?</div>
              <div className="text-muted-foreground">
                Retention policies define how long different types of data are stored in your vault.
                After the retention period expires, data is automatically deleted.
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Regulatory compliance</div>
              <div className="text-muted-foreground">
                Some data types have minimum retention requirements based on regulations like HIPAA,
                GDPR, or industry standards. The system provides suggestions to help ensure
                compliance.
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Data deletion</div>
              <div className="text-muted-foreground">
                When data exceeds the retention period, it is permanently deleted and cannot be
                recovered. Make sure to export important data before it expires.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog.open} onOpenChange={(open) => setShowDeleteDialog({ open, policy: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retention Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the retention policy for{' '}
              <strong>
                {DATA_TYPES.find((dt) => dt.value === showDeleteDialog.policy?.dataType)?.label}
              </strong>
              ? This will revert to the default retention period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog.policy && handleDelete(showDeleteDialog.policy)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function mockRetentionPolicies(): RetentionPolicy[] {
  return [
    {
      id: 'policy-1',
      dataType: 'credentials',
      period: 'indefinite',
      status: 'active',
      lastModified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      modifiedBy: 'User',
      regulatoryCompliant: true,
    },
    {
      id: 'policy-2',
      dataType: 'logs',
      period: '7years',
      status: 'active',
      lastModified: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      modifiedBy: 'Admin',
      regulatoryCompliant: true,
    },
    {
      id: 'policy-3',
      dataType: 'contracts',
      period: '10years',
      status: 'active',
      lastModified: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      modifiedBy: 'User',
      regulatoryCompliant: true,
    },
    {
      id: 'policy-4',
      dataType: 'shares',
      period: '7years',
      status: 'active',
      lastModified: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      modifiedBy: 'User',
      regulatoryCompliant: true,
    },
    {
      id: 'policy-5',
      dataType: 'notifications',
      period: '1year',
      status: 'active',
      lastModified: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
      modifiedBy: 'User',
      regulatoryCompliant: false,
      warningMessage: 'Consider longer retention for compliance',
    },
  ]
}

