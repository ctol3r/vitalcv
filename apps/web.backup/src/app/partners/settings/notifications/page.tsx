'use client'

import { useEffect, useState } from 'react'
import { Bell, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface NotificationPreferences {
  opportunities: {
    new: boolean
    statusChange: boolean
    assigned: boolean
  }
  agreements: {
    upload: boolean
    approval: boolean
    expiry: boolean
  }
  tasks: {
    assigned: boolean
    dueDate: boolean
    statusChange: boolean
  }
  campaigns: {
    created: boolean
    statusChange: boolean
    metricsUpdate: boolean
  }
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    opportunities: {
      new: true,
      statusChange: true,
      assigned: true,
    },
    agreements: {
      upload: true,
      approval: true,
      expiry: true,
    },
    tasks: {
      assigned: true,
      dueDate: true,
      statusChange: false,
    },
    campaigns: {
      created: false,
      statusChange: false,
      metricsUpdate: true,
    },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    try {
      const response = await fetch('/api/partners/settings/notifications')
      if (response.ok) {
        const data = await response.json()
        setPreferences(data.preferences || preferences)
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/partners/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })

      if (!response.ok) throw new Error('Failed to save preferences')

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save preferences:', err)
      alert('Failed to save preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (
    category: keyof NotificationPreferences,
    key: string,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }))
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading notification settings...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Notification Settings</h1>
        <p className="text-muted-foreground">
          Manage your notification preferences for partnership activities
        </p>
      </div>

      {saveSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Notification preferences saved successfully!</AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Opportunities Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Opportunities
            </CardTitle>
            <CardDescription>
              Get notified about partnership opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="opp-new">New Opportunities</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when new opportunities are created
                </p>
              </div>
              <Switch
                id="opp-new"
                checked={preferences.opportunities.new}
                onCheckedChange={(checked) =>
                  updatePreference('opportunities', 'new', checked)
                }
                aria-label="New opportunities notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="opp-status">Status Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when opportunity status changes
                </p>
              </div>
              <Switch
                id="opp-status"
                checked={preferences.opportunities.statusChange}
                onCheckedChange={(checked) =>
                  updatePreference('opportunities', 'statusChange', checked)
                }
                aria-label="Status change notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="opp-assigned">Assigned to Me</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when opportunities are assigned to you
                </p>
              </div>
              <Switch
                id="opp-assigned"
                checked={preferences.opportunities.assigned}
                onCheckedChange={(checked) =>
                  updatePreference('opportunities', 'assigned', checked)
                }
                aria-label="Assignment notifications"
              />
            </div>
          </CardContent>
        </Card>

        {/* Agreements Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Agreements
            </CardTitle>
            <CardDescription>
              Get notified about agreement activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="agr-upload">New Uploads</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when new agreements are uploaded
                </p>
              </div>
              <Switch
                id="agr-upload"
                checked={preferences.agreements.upload}
                onCheckedChange={(checked) =>
                  updatePreference('agreements', 'upload', checked)
                }
                aria-label="Upload notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="agr-approval">Approval Status</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when agreements are approved or rejected
                </p>
              </div>
              <Switch
                id="agr-approval"
                checked={preferences.agreements.approval}
                onCheckedChange={(checked) =>
                  updatePreference('agreements', 'approval', checked)
                }
                aria-label="Approval notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="agr-expiry">Expiry Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when agreements are expiring soon
                </p>
              </div>
              <Switch
                id="agr-expiry"
                checked={preferences.agreements.expiry}
                onCheckedChange={(checked) =>
                  updatePreference('agreements', 'expiry', checked)
                }
                aria-label="Expiry notifications"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tasks Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Tasks
            </CardTitle>
            <CardDescription>
              Get notified about collaboration tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-assigned">Assigned to Me</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when tasks are assigned to you
                </p>
              </div>
              <Switch
                id="task-assigned"
                checked={preferences.tasks.assigned}
                onCheckedChange={(checked) =>
                  updatePreference('tasks', 'assigned', checked)
                }
                aria-label="Task assignment notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-due">Due Date Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when tasks are due soon or overdue
                </p>
              </div>
              <Switch
                id="task-due"
                checked={preferences.tasks.dueDate}
                onCheckedChange={(checked) =>
                  updatePreference('tasks', 'dueDate', checked)
                }
                aria-label="Due date notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-status">Status Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when task status changes
                </p>
              </div>
              <Switch
                id="task-status"
                checked={preferences.tasks.statusChange}
                onCheckedChange={(checked) =>
                  updatePreference('tasks', 'statusChange', checked)
                }
                aria-label="Status change notifications"
              />
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Campaigns
            </CardTitle>
            <CardDescription>
              Get notified about co-marketing campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="camp-created">New Campaigns</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when new campaigns are created
                </p>
              </div>
              <Switch
                id="camp-created"
                checked={preferences.campaigns.created}
                onCheckedChange={(checked) =>
                  updatePreference('campaigns', 'created', checked)
                }
                aria-label="Campaign creation notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="camp-status">Status Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when campaign status changes
                </p>
              </div>
              <Switch
                id="camp-status"
                checked={preferences.campaigns.statusChange}
                onCheckedChange={(checked) =>
                  updatePreference('campaigns', 'statusChange', checked)
                }
                aria-label="Campaign status notifications"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="camp-metrics">Metrics Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when campaign metrics are updated
                </p>
              </div>
              <Switch
                id="camp-metrics"
                checked={preferences.campaigns.metricsUpdate}
                onCheckedChange={(checked) =>
                  updatePreference('campaigns', 'metricsUpdate', checked)
                }
                aria-label="Metrics update notifications"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

