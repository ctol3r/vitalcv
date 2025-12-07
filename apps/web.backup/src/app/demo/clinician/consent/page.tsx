'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Save,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

type ConsentLevel = 'full' | 'conditional' | 'none'
type ActionType = 'issuance' | 'revocation' | 'renewal' | 'update' | 'verification'

interface ConsentPreference {
  actionType: ActionType
  enabled: boolean
  conditions: string[]
  requireNotification: boolean
  requireApproval: boolean
  level: ConsentLevel
}

interface ConsentSettings {
  overallLevel: ConsentLevel
  preferences: ConsentPreference[]
  lastUpdated: string
  updatedBy: string
}

interface Condition {
  id: string
  label: string
  description: string
  enabled: boolean
}

export default function ConsentManagementPage() {
  const [settings, setSettings] = useState<ConsentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadConsentSettings()
  }, [])

  async function loadConsentSettings() {
    try {
      const res = await fetch('/api/demo/clinician/consent')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || mockConsentSettings())
      } else {
        setSettings(mockConsentSettings())
      }
    } catch (err) {
      setSettings(mockConsentSettings())
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // In a real implementation, this would save to the backend
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setHasChanges(false)
      setShowSaveDialog(false)
      // Reload to get updated timestamp
      await loadConsentSettings()
    } catch (err) {
      console.error('Failed to save consent settings', err)
    } finally {
      setSaving(false)
    }
  }

  function handlePreferenceChange(
    actionType: ActionType,
    field: keyof ConsentPreference,
    value: boolean | ConsentLevel | string[]
  ) {
    if (!settings) return
    setHasChanges(true)
    setSettings({
      ...settings,
      preferences: settings.preferences.map((pref) =>
        pref.actionType === actionType ? { ...pref, [field]: value } : pref
      ),
    })
  }

  function handleOverallLevelChange(level: ConsentLevel) {
    if (!settings) return
    setHasChanges(true)
    setSettings({
      ...settings,
      overallLevel: level,
      preferences: settings.preferences.map((pref) => ({
        ...pref,
        level,
        enabled: level !== 'none',
      })),
    })
  }

  function getConsentLevelColor(level: ConsentLevel): string {
    switch (level) {
      case 'full':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'conditional':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'none':
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading consent settings...</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Unable to load consent settings</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Consent Management
          </h1>
          <p className="text-gray-600 mt-1">
            Configure preferences for which credential actions may occur autonomously and under what conditions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="border-orange-300 text-orange-800">
              Unsaved changes
            </Badge>
          )}
          <Button onClick={() => setShowSaveDialog(true)} disabled={!hasChanges || saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Overall Consent Level */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Consent Level</CardTitle>
          <CardDescription>
            Set the default level of autonomy for all credential actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="consent-full" className="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                id="consent-full"
                name="consent-level"
                checked={settings.overallLevel === 'full'}
                onChange={() => handleOverallLevelChange('full')}
                className="w-4 h-4"
              />
              <span>Full Autonomy</span>
            </Label>
            <Label htmlFor="consent-conditional" className="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                id="consent-conditional"
                name="consent-level"
                checked={settings.overallLevel === 'conditional'}
                onChange={() => handleOverallLevelChange('conditional')}
                className="w-4 h-4"
              />
              <span>Conditional</span>
            </Label>
            <Label htmlFor="consent-none" className="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                id="consent-none"
                name="consent-level"
                checked={settings.overallLevel === 'none'}
                onChange={() => handleOverallLevelChange('none')}
                className="w-4 h-4"
              />
              <span>No Autonomy</span>
            </Label>
          </div>
          <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <strong>Full Autonomy:</strong> All actions proceed automatically when conditions are met.
              <br />
              <strong>Conditional:</strong> Actions proceed only when specific conditions are satisfied.
              <br />
              <strong>No Autonomy:</strong> All actions require manual approval.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action-Specific Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Action-Specific Preferences</CardTitle>
          <CardDescription>
            Configure consent settings for each type of credential action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action Type</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Consent Level</TableHead>
                <TableHead>Require Notification</TableHead>
                <TableHead>Require Approval</TableHead>
                <TableHead>Conditions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.preferences.map((pref) => (
                <TableRow key={pref.actionType}>
                  <TableCell className="font-medium capitalize">{pref.actionType}</TableCell>
                  <TableCell>
                    <Switch
                      checked={pref.enabled}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(pref.actionType, 'enabled', checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={pref.level}
                      onChange={(e) =>
                        handlePreferenceChange(
                          pref.actionType,
                          'level',
                          e.target.value as ConsentLevel
                        )
                      }
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      disabled={!pref.enabled}
                    >
                      <option value="full">Full</option>
                      <option value="conditional">Conditional</option>
                      <option value="none">None</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={pref.requireNotification}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(pref.actionType, 'requireNotification', checked)
                      }
                      disabled={!pref.enabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={pref.requireApproval}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange(pref.actionType, 'requireApproval', checked)
                      }
                      disabled={!pref.enabled || pref.level === 'full'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pref.conditions.map((condition, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                      {pref.conditions.length === 0 && (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conditions Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Conditional Rules</CardTitle>
          <CardDescription>
            Define conditions that must be met for autonomous actions to proceed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <ConditionRow
              id="cond-1"
              label="Within Business Hours"
              description="Actions only proceed during standard business hours (9 AM - 5 PM)"
              enabled={true}
            />
            <ConditionRow
              id="cond-2"
              label="No Recent Policy Violations"
              description="Actions blocked if policy violations detected in last 90 days"
              enabled={true}
            />
            <ConditionRow
              id="cond-3"
              label="Competency Threshold Met"
              description="Actions require minimum competency score of 85%"
              enabled={true}
            />
            <ConditionRow
              id="cond-4"
              label="Compliance Check Passed"
              description="All compliance requirements must be satisfied"
              enabled={false}
            />
            <ConditionRow
              id="cond-5"
              label="Peer Review Completed"
              description="Requires peer review for high-risk actions"
              enabled={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Settings History</CardTitle>
          <CardDescription>Recent changes to consent preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Settings updated</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(settings.lastUpdated).toLocaleString()}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">By {settings.updatedBy}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Consent Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these consent preferences? This will affect how
              autonomous credential actions are processed for your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ConditionRow({
  id,
  label,
  description,
  enabled: initialEnabled,
}: {
  id: string
  label: string
  description: string
  enabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)

  return (
    <div className="flex items-start gap-3 p-3 border rounded-md">
      <Switch checked={enabled} onCheckedChange={setEnabled} className="mt-1" />
      <div className="flex-1">
        <Label htmlFor={id} className="font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {enabled ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-1" />
      ) : (
        <ShieldX className="w-5 h-5 text-gray-400 mt-1" />
      )}
    </div>
  )
}

function mockConsentSettings(): ConsentSettings {
  return {
    overallLevel: 'conditional',
    preferences: [
      {
        actionType: 'issuance',
        enabled: true,
        conditions: ['Within Business Hours', 'Compliance Check Passed'],
        requireNotification: true,
        requireApproval: false,
        level: 'conditional',
      },
      {
        actionType: 'revocation',
        enabled: true,
        conditions: ['No Recent Policy Violations', 'Peer Review Completed'],
        requireNotification: true,
        requireApproval: true,
        level: 'conditional',
      },
      {
        actionType: 'renewal',
        enabled: true,
        conditions: ['Competency Threshold Met', 'Compliance Check Passed'],
        requireNotification: false,
        requireApproval: false,
        level: 'conditional',
      },
      {
        actionType: 'update',
        enabled: true,
        conditions: ['Within Business Hours'],
        requireNotification: true,
        requireApproval: false,
        level: 'conditional',
      },
      {
        actionType: 'verification',
        enabled: true,
        conditions: [],
        requireNotification: false,
        requireApproval: false,
        level: 'full',
      },
    ],
    lastUpdated: new Date().toISOString(),
    updatedBy: 'Current User',
  }
}

